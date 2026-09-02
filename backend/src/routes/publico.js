import express from 'express';
import crypto from 'crypto';
import { query, withTx } from '../lib/db.js';
import { eventoPublico, puedeReservar, validarReserva } from '../services/agenda.js';
import { enviar, correoConfirmacion } from '../services/mailer.js';

// ============================================================
// Rutas públicas: ver la agenda, tomar una fecha, soltarla.
//
// Nadie necesita cuenta para inscribirse. La credencial de quien reserva
// es el token que le llega por correo, y sirve para una sola cosa:
// cancelar SU reserva.
// ============================================================

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/eventos — las fechas publicadas que todavía no ocurren.
//
// Un solo viaje a la base: las reservas se cuentan con un LEFT JOIN
// agregado en vez de una consulta por evento. Con veinte fechas en
// cartelera, la versión ingenua serían veintiuna consultas por visita.
router.get('/eventos', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.*, COALESCE(r.tomados, 0)::int AS tomados
         FROM eventos e
         LEFT JOIN (
           SELECT evento_id, COUNT(*) AS tomados
             FROM reservas WHERE estado <> 'cancelada'
            GROUP BY evento_id
         ) r ON r.evento_id = e.id
        WHERE e.publicado = true
          AND COALESCE(e.termina_at, e.inicia_at) >= now()
        ORDER BY e.inicia_at ASC`
    );
    // `eventoPublico` espera la lista de reservas; acá solo se tiene el
    // conteo, así que se le pasa un arreglo del largo justo. Es lo mismo
    // para lo único que hace con él —contarlo— y evita traer filas con
    // datos personales que esta ruta no debe ni tocar.
    res.json({ eventos: rows.map((e) => eventoPublico(e, new Array(e.tomados).fill({ estado: 'reservada' }))) });
  } catch (err) { next(err); }
});

// POST /api/eventos/:id/reservar — tomar un cupo.
//
// ACÁ ESTÁ LA CARRERA, Y ACÁ SE CIERRA. Dos personas tomando el último
// cupo al mismo tiempo leen las dos «queda 1» y las dos insertan. Por eso
// la fila del evento se bloquea con SELECT … FOR UPDATE antes de contar:
// la segunda transacción espera, cuenta DESPUÉS de la primera y ve 0.
//
// El índice único parcial es la segunda línea de defensa, para el caso de
// la misma persona apretando dos veces.
router.post('/eventos/:id/reservar', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(404).json({ error: 'Esta fecha no existe.' });
    }

    const v = validarReserva(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });

    const resultado = await withTx(async (cliente) => {
      const { rows: eventos } = await cliente.query(
        'SELECT * FROM eventos WHERE id = $1 FOR UPDATE', [req.params.id]
      );
      const evento = eventos[0];

      // Un evento que no existe y uno sin publicar responden IGUAL. Si el
      // no publicado dijera «todavía no está abierto», cualquiera podría
      // averiguar qué fechas se están preparando probando identificadores.
      if (!evento || !evento.publicado) {
        return { estado: 404, cuerpo: { error: 'Esta fecha no existe.' } };
      }

      const { rows: tomadas } = await cliente.query(
        "SELECT estado FROM reservas WHERE evento_id = $1 AND estado <> 'cancelada'",
        [evento.id]
      );

      const decision = puedeReservar(evento, tomadas);
      if (!decision.puede) return { estado: 409, cuerpo: { error: decision.motivo } };

      const token = crypto.randomBytes(24).toString('base64url');
      try {
        const { rows } = await cliente.query(
          `INSERT INTO reservas (evento_id, nombre, email, empresa, telefono, token)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, nombre, email, token, estado, created_at`,
          [evento.id, v.datos.nombre, v.datos.email, v.datos.empresa, v.datos.telefono, token]
        );
        return { estado: 201, cuerpo: { reserva: rows[0] }, evento, reserva: rows[0] };
      } catch (err) {
        // 23505 = el índice único parcial. Es la misma persona
        // inscribiéndose de nuevo, no un error que haya que gritar.
        if (err.code === '23505') {
          return { estado: 409, cuerpo: { error: 'Ese correo ya tiene un cupo tomado para esta fecha.' } };
        }
        throw err;
      }
    });

    // El correo va DESPUÉS del COMMIT. Enviarlo dentro de la transacción
    // significaría avisar de una reserva que todavía podría revertirse.
    if (resultado.estado === 201) {
      const envio = await enviar(correoConfirmacion({ reserva: resultado.reserva, evento: resultado.evento }));
      // Se le dice a la persona si el correo salió o no. Callarlo la
      // dejaría esperando un mensaje que nunca va a llegar.
      resultado.cuerpo.correo_enviado = envio.enviado;
      // El token no sale en la respuesta: viaja por correo y solo por
      // correo. Devolverlo acá lo dejaría en el historial del navegador y
      // en cualquier registro intermedio.
      delete resultado.cuerpo.reserva.token;
      delete resultado.cuerpo.reserva.email;
    }

    res.status(resultado.estado).json(resultado.cuerpo);
  } catch (err) { next(err); }
});

// POST /api/reservas/:token/cancelar — soltar el cupo.
//
// Idempotente: cancelar dos veces responde lo mismo. Un token que no
// existe responde igual que uno ya cancelado, por la misma razón de
// siempre — no se confirma qué tokens son reales.
router.post('/reservas/:token/cancelar', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `UPDATE reservas SET estado = 'cancelada', cancelada_at = now()
        WHERE token = $1 AND estado <> 'cancelada'`,
      [req.params.token]
    );
    res.json({
      ok: true,
      liberado: rowCount > 0,
      mensaje: 'Listo. Si tenías un cupo tomado, quedó libre para otra persona.',
    });
  } catch (err) { next(err); }
});

export default router;
