import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';
import { firmarToken, requiereAdmin } from '../middleware/auth.js';
import { validarEvento, cuposDisponibles, estadoEvento, textoCupo } from '../services/agenda.js';

// ============================================================
// Panel de Antai: crear fechas, ver quién viene, marcar asistencia.
//
// Todo lo de acá abajo de `requiereAdmin` menos el login, que por
// definición no puede exigir sesión.
// ============================================================

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/admin/login
//
// La respuesta es la MISMA para "no existe ese correo" y "la clave está
// mala". Distinguirlas convierte el formulario en un buscador de correos
// válidos, que es el primer paso de cualquiera que quiera entrar.
//
// El hash se compara IGUAL cuando el usuario no existe, contra un hash de
// descarte. Sin eso, la respuesta para un correo inexistente vuelve al
// instante y la de uno real se demora lo que tarda bcrypt: el tiempo de
// respuesta delataría lo que el mensaje se cuida de no decir.
const HASH_DESCARTE = bcrypt.hashSync('descarte', 10);

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const clave = String(req.body?.clave || '');
    if (!email || !clave) return res.status(400).json({ error: 'Faltan el correo y la clave.' });

    const { rows } = await query(
      'SELECT * FROM usuarios WHERE lower(email) = $1 AND activo = true', [email]
    );
    const usuario = rows[0];
    const calza = await bcrypt.compare(clave, usuario?.clave_hash || HASH_DESCARTE);

    if (!usuario || !calza) return res.status(401).json({ error: 'Correo o clave incorrectos.' });

    await query('UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1', [usuario.id]);
    res.json({
      token: firmarToken(usuario),
      usuario: { nombre: usuario.nombre, email: usuario.email, debe_cambiar: usuario.debe_cambiar },
    });
  } catch (err) { next(err); }
});

router.use(requiereAdmin);

// POST /api/admin/clave — cambiar la propia.
router.post('/clave', async (req, res, next) => {
  try {
    const nueva = String(req.body?.nueva || '');
    if (nueva.length < 12) {
      return res.status(400).json({ error: 'La clave nueva tiene que tener al menos 12 caracteres.' });
    }
    await query('UPDATE usuarios SET clave_hash = $1, debe_cambiar = false WHERE id = $2',
      [await bcrypt.hash(nueva, 12), req.usuario.sub]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/admin/eventos — todos, publicados o no, con los cupos tomados.
router.get('/eventos', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.*, COALESCE(r.tomados, 0)::int AS tomados
         FROM eventos e
         LEFT JOIN (
           SELECT evento_id, COUNT(*) AS tomados
             FROM reservas WHERE estado <> 'cancelada' GROUP BY evento_id
         ) r ON r.evento_id = e.id
        ORDER BY e.inicia_at DESC`
    );
    res.json({
      eventos: rows.map((e) => {
        const falsas = new Array(e.tomados).fill({ estado: 'reservada' });
        return {
          ...e,
          tomados: e.tomados,
          cupos_disponibles: cuposDisponibles(e, falsas),
          texto_cupo: textoCupo(e, falsas),
          estado: estadoEvento(e),
        };
      }),
    });
  } catch (err) { next(err); }
});

router.post('/eventos', async (req, res, next) => {
  try {
    const v = validarEvento(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const d = v.datos;
    const { rows } = await query(
      `INSERT INTO eventos (titulo, descripcion, ciudad, lugar, modalidad, inicia_at, termina_at, cupo, publicado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [d.titulo, d.descripcion, d.ciudad, d.lugar, d.modalidad, d.inicia_at, d.termina_at, d.cupo, d.publicado]
    );
    res.status(201).json({ evento: rows[0] });
  } catch (err) { next(err); }
});

router.put('/eventos/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'No existe.' });
    const v = validarEvento(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const d = v.datos;

    // Bajar el cupo por debajo de lo ya reservado se RECHAZA. Aceptarlo
    // dejaría gente con una reserva confirmada y sin lugar, y el sistema
    // no tendría cómo decidir a quién sacar. Si hay que achicar la sala,
    // eso se habla con las personas, no se resuelve con un UPDATE.
    if (d.cupo !== null) {
      const { rows } = await query(
        "SELECT COUNT(*)::int AS n FROM reservas WHERE evento_id = $1 AND estado <> 'cancelada'",
        [req.params.id]
      );
      if (d.cupo < rows[0].n) {
        return res.status(409).json({
          error: `Ya hay ${rows[0].n} personas inscritas: el cupo no puede quedar en ${d.cupo}.`,
        });
      }
    }

    const { rows } = await query(
      `UPDATE eventos SET titulo=$1, descripcion=$2, ciudad=$3, lugar=$4, modalidad=$5,
              inicia_at=$6, termina_at=$7, cupo=$8, publicado=$9, updated_at=now()
        WHERE id=$10 RETURNING *`,
      [d.titulo, d.descripcion, d.ciudad, d.lugar, d.modalidad, d.inicia_at, d.termina_at,
        d.cupo, d.publicado, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No existe.' });
    res.json({ evento: rows[0] });
  } catch (err) { next(err); }
});

// DELETE — solo si nadie se inscribió. Con reservas, se despublica.
//
// Borrar un evento con gente adentro se lleva por CASCADE las reservas, y
// con ellas la única constancia de a quién hay que avisarle.
router.delete('/eventos/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'No existe.' });
    const { rows } = await query(
      "SELECT COUNT(*)::int AS n FROM reservas WHERE evento_id = $1 AND estado <> 'cancelada'",
      [req.params.id]
    );
    if (rows[0].n > 0) {
      return res.status(409).json({
        error: `Hay ${rows[0].n} personas inscritas. Despublica la fecha en vez de borrarla, `
          + 'así no se pierde a quién había que avisarle.',
      });
    }
    const { rowCount } = await query('DELETE FROM eventos WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'No existe.' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/admin/eventos/:id/reservas — la lista de asistencia.
// Con ?formato=csv sale el archivo para imprimir.
router.get('/eventos/:id/reservas', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'No existe.' });
    const { rows } = await query(
      `SELECT id, nombre, email, empresa, telefono, estado, created_at
         FROM reservas WHERE evento_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );

    if (String(req.query.formato) === 'csv') {
      // Se antepone un apóstrofo a lo que empiece con = + - @: sin eso,
      // un nombre como "=1+1" se ejecuta como fórmula al abrir el archivo
      // en una planilla.
      const seguro = (v) => {
        const s = String(v ?? '');
        const limpio = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
        return `"${limpio.replace(/"/g, '""')}"`;
      };
      const csv = [
        ['Nombre', 'Correo', 'Empresa', 'Teléfono', 'Estado', 'Inscrito'].map(seguro).join(','),
        ...rows.map((r) => [r.nombre, r.email, r.empresa, r.telefono, r.estado,
          new Date(r.created_at).toLocaleString('es-CL')].map(seguro).join(',')),
      ].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="asistencia.csv"');
      // BOM para que Excel en Windows lea los acentos.
      return res.send(`﻿${csv}`);
    }

    res.json({ reservas: rows });
  } catch (err) { next(err); }
});

// PUT /api/admin/reservas/:id — marcar asistencia o cancelar.
router.put('/reservas/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'No existe.' });
    const estado = String(req.body?.estado || '');
    if (!['reservada', 'asistio', 'no_asistio', 'cancelada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido.' });
    }
    const { rows } = await query(
      `UPDATE reservas SET estado = $1,
              cancelada_at = CASE WHEN $1 = 'cancelada' THEN now() ELSE NULL END
        WHERE id = $2 RETURNING id, nombre, estado`,
      [estado, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No existe.' });
    res.json({ reserva: rows[0] });
  } catch (err) { next(err); }
});

export default router;
