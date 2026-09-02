import express from 'express';
import crypto from 'crypto';
import { query, withTx } from '../lib/db.js';
import { eventoPublico, puedeReservar, validarReserva } from '../services/agenda.js';
import { enviarPlantilla } from '../services/correo.js';
import { cotizacionPublica, puedeAceptar, estadoVigente } from '../services/cotizacion.js';
import { config } from '../lib/config.js';

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

      // Quien se inscribe ENTRA AL CRM en el mismo movimiento. Copiarlo
      // después a mano es la clase de tarea que nadie hace, y entonces la
      // agenda y el embudo cuentan gente distinta.
      //
      // Si el contacto ya existe no se pisa: sus datos del CRM —cargo,
      // etapa, notas— valen más que lo que escribió apurado en un
      // formulario de inscripción. Solo se completan los huecos.
      const { rows: contactos } = await cliente.query(
        `INSERT INTO contactos (nombre, email, telefono, empresa, origen)
         VALUES ($1, $2, $3, $4, 'agenda')
         ON CONFLICT (lower(email)) DO UPDATE
            SET telefono = COALESCE(contactos.telefono, EXCLUDED.telefono),
                empresa  = COALESCE(contactos.empresa,  EXCLUDED.empresa),
                updated_at = now()
         RETURNING id`,
        [v.datos.nombre, v.datos.email, v.datos.telefono, v.datos.empresa]
      );
      const contactoId = contactos[0]?.id || null;

      try {
        const { rows } = await cliente.query(
          `INSERT INTO reservas (evento_id, nombre, email, empresa, telefono, token, contacto_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, nombre, email, token, estado, created_at`,
          [evento.id, v.datos.nombre, v.datos.email, v.datos.empresa, v.datos.telefono, token, contactoId]
        );
        if (contactoId) {
          await cliente.query(
            'INSERT INTO interacciones (contacto_id, tipo, detalle) VALUES ($1, $2, $3)',
            [contactoId, 'nota', `Se inscribió en «${evento.titulo}».`]
          );
        }
        return { estado: 201, cuerpo: { reserva: rows[0] }, evento, reserva: rows[0], contactoId };
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
      const e = resultado.evento;
      const registro = await enviarPlantilla('reserva_confirmada', {
        para: resultado.reserva.email,
        valores: {
          nombre: resultado.reserva.nombre,
          actividad: e.titulo,
          cuando: new Date(e.inicia_at).toLocaleString('es-CL', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago',
          }),
          donde: [e.lugar, e.ciudad].filter(Boolean).join(', '),
          modalidad: e.modalidad,
          enlace_cancelar: `${config.urlPublica}/cancelar/${resultado.reserva.token}`,
        },
        vinculos: { contactoId: resultado.contactoId, reservaId: resultado.reserva.id },
      });
      // Se le dice a la persona si el correo salió o no. Callarlo la
      // dejaría esperando un mensaje que nunca va a llegar.
      resultado.cuerpo.correo_enviado = registro.estado === 'enviado';
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

// ---------------- Cotizaciones ----------------
//
// La otra parte no tiene cuenta. Su credencial es el token del enlace que
// le llegó por correo, igual que en las reservas.

// GET /api/cotizacion/:token
router.get('/cotizacion/:token', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM cotizaciones WHERE token = $1', [req.params.token]);
    const c = rows[0];

    // Una cotización en BORRADOR responde igual que una que no existe.
    // Mostrarla dejaría ver precios que todavía se están discutiendo
    // internamente a quien adivine —o reenvíe— un enlace.
    if (!c || c.estado === 'borrador') {
      return res.status(404).json({ error: 'Esta cotización no existe.' });
    }

    const [items, pagos] = await Promise.all([
      query('SELECT * FROM cotizacion_items WHERE cotizacion_id = $1 ORDER BY orden', [c.id]),
      query('SELECT * FROM pagos WHERE cotizacion_id = $1', [c.id]),
    ]);

    res.json({
      cotizacion: cotizacionPublica(c, items.rows, pagos.rows),
      puede_aceptar: puedeAceptar(c),
      // Los datos para transferir se muestran solo si están configurados.
      // Inventar una cuenta bancaria sería peor que no ofrecer el dato.
      transferencia: config.transferencia,
    });
  } catch (err) { next(err); }
});

// POST /api/cotizacion/:token/aceptar
//
// La aceptación es un hecho con nombre, fecha y origen. Sin quién aceptó,
// «aceptada» es una casilla que alguien marcó y no una constancia que se
// pueda mostrar si después hay desacuerdo.
router.post('/cotizacion/:token/aceptar', async (req, res, next) => {
  try {
    const quien = String(req.body?.nombre || '').trim();
    if (quien.length < 3) {
      return res.status(400).json({ error: 'Escribe tu nombre para dejar constancia de quién acepta.' });
    }

    const resultado = await withTx(async (cliente) => {
      // FOR UPDATE por la misma razón que en las reservas: dos pestañas
      // abiertas apretando «Aceptar» no pueden dejar dos aceptaciones con
      // nombres distintos sobre el mismo documento.
      const { rows } = await cliente.query(
        'SELECT * FROM cotizaciones WHERE token = $1 FOR UPDATE', [req.params.token]
      );
      const c = rows[0];
      if (!c || c.estado === 'borrador') {
        return { estado: 404, cuerpo: { error: 'Esta cotización no existe.' } };
      }

      const decision = puedeAceptar(c);
      if (!decision.puede) return { estado: 409, cuerpo: { error: decision.motivo } };

      await cliente.query(
        `UPDATE cotizaciones SET estado = 'aceptada', aceptada_at = now(),
                aceptada_por = $1, aceptada_ip = $2, updated_at = now()
          WHERE id = $3`,
        [quien, req.ip || null, c.id]
      );
      await cliente.query(
        'INSERT INTO interacciones (contacto_id, tipo, detalle) VALUES ($1, $2, $3)',
        [c.contacto_id, 'cotizacion', `${quien} aceptó la cotización ${c.folio}.`]
      );
      return { estado: 200, cuerpo: { ok: true, folio: c.folio } };
    });

    res.status(resultado.estado).json(resultado.cuerpo);
  } catch (err) { next(err); }
});

// POST /api/cotizacion/:token/informar-pago
//
// La otra parte avisa que transfirió. Entra como PENDIENTE: darlo por
// pagado con solo el aviso sería registrar en la caja algo que nadie vio
// en la cuenta. Alguien de Antai lo confirma después.
router.post('/cotizacion/:token/informar-pago', async (req, res, next) => {
  try {
    const monto = Number(req.body?.monto);
    if (!Number.isInteger(monto) || monto <= 0) {
      return res.status(400).json({ error: 'Indica el monto transferido, en pesos.' });
    }

    const { rows } = await query('SELECT * FROM cotizaciones WHERE token = $1', [req.params.token]);
    const c = rows[0];
    if (!c || c.estado === 'borrador') return res.status(404).json({ error: 'Esta cotización no existe.' });

    await query(
      `INSERT INTO pagos (cotizacion_id, monto, medio, estado, referencia, pagado_at, nota)
       VALUES ($1, $2, 'transferencia', 'pendiente', $3, now(), $4)`,
      [c.id, monto, String(req.body?.referencia || '').trim() || null,
        'Informado por el cliente desde el enlace de la cotización.']
    );
    await query(
      'INSERT INTO interacciones (contacto_id, tipo, detalle) VALUES ($1, $2, $3)',
      [c.contacto_id, 'pago', `El cliente informó una transferencia por la cotización ${c.folio}.`]
    );

    res.status(201).json({
      ok: true,
      mensaje: 'Gracias. Lo revisamos contra la cuenta y te confirmamos.',
    });
  } catch (err) { next(err); }
});

export default router;
