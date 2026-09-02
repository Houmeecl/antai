import express from 'express';
import crypto from 'crypto';
import { query, withTx } from '../lib/db.js';
import { requiereAdmin } from '../middleware/auth.js';
import { config } from '../lib/config.js';
import {
  validarContacto, resumenEmbudo, NOMBRE_ESTADO as NOMBRE_ESTADO_CRM,
  ESTADOS as ESTADOS_CRM, ORIGENES, TIPOS_INTERACCION, normalizarRut,
} from '../services/crm.js';
import {
  validarCotizacion, totales, estadoVigente, saldo, estadoCobro, folioDe,
  cotizacionPublica, pesos, TASA_IVA, MEDIOS_PAGO, NOMBRE_ESTADO,
} from '../services/cotizacion.js';
import { enviarPlantilla, enviarSuelto, plantilla } from '../services/correo.js';

// ============================================================
// Lo comercial: contactos, cotizaciones, pagos y correo.
// Todo bajo sesión de panel.
// ============================================================

const router = express.Router();
router.use(requiereAdmin);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esUuid = (v) => UUID_RE.test(String(v || ''));

// Deja constancia en la bitácora del contacto. NO lanza: que falle la
// anotación no puede deshacer lo que ya ocurrió.
async function anotar(contactoId, tipo, detalle, usuarioId) {
  if (!contactoId) return;
  try {
    await query(
      'INSERT INTO interacciones (contacto_id, usuario_id, tipo, detalle) VALUES ($1,$2,$3,$4)',
      [contactoId, usuarioId || null, tipo, detalle]
    );
  } catch (e) {
    console.error(`[crm] no se pudo anotar la interacción: ${e.message}`);
  }
}

// Un pago confirmado convierte al contacto en cliente.
//
// ESTÁ ACÁ Y NO REPETIDO EN CADA RUTA porque hay DOS caminos para
// confirmar un pago —registrarlo ya confirmado, o confirmar uno que el
// cliente informó— y el segundo es el normal. La primera versión solo
// ascendía por el primero: el E2E mostró un pago de dos millones
// confirmado con el contacto todavía en «cotizado».
//
// No pisa 'perdido': si alguien marcó perdido a un contacto que después
// pagó, eso es una contradicción que tiene que resolver una persona, no
// un UPDATE silencioso.
async function ascenderACliente(contactoId) {
  if (!contactoId) return;
  await query(
    "UPDATE contactos SET estado = 'cliente', updated_at = now() WHERE id = $1 AND estado <> 'perdido'",
    [contactoId]
  );
}

// ---------------- Contactos ----------------

router.get('/contactos', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.*,
              (SELECT COUNT(*)::int FROM cotizaciones q WHERE q.contacto_id = c.id) AS n_cotizaciones,
              (SELECT COUNT(*)::int FROM reservas r WHERE r.contacto_id = c.id AND r.estado <> 'cancelada') AS n_actividades
         FROM contactos c ORDER BY c.updated_at DESC`
    );
    res.json({ contactos: rows, embudo: resumenEmbudo(rows), vocabulario: { estados: ESTADOS_CRM, origenes: ORIGENES } });
  } catch (err) { next(err); }
});

router.get('/contactos/:id', async (req, res, next) => {
  try {
    if (!esUuid(req.params.id)) return res.status(404).json({ error: 'No existe.' });
    const { rows } = await query('SELECT * FROM contactos WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No existe.' });

    const [inter, cots, actividades, correos] = await Promise.all([
      query('SELECT i.*, u.nombre AS usuario FROM interacciones i LEFT JOIN usuarios u ON u.id = i.usuario_id WHERE i.contacto_id = $1 ORDER BY i.created_at DESC LIMIT 100', [req.params.id]),
      query('SELECT * FROM cotizaciones WHERE contacto_id = $1 ORDER BY created_at DESC', [req.params.id]),
      query('SELECT r.estado, e.titulo, e.inicia_at FROM reservas r JOIN eventos e ON e.id = r.evento_id WHERE r.contacto_id = $1 ORDER BY e.inicia_at DESC', [req.params.id]),
      query('SELECT id, asunto, estado, created_at FROM correos_enviados WHERE contacto_id = $1 ORDER BY created_at DESC LIMIT 50', [req.params.id]),
    ]);

    res.json({
      contacto: rows[0],
      interacciones: inter.rows,
      cotizaciones: cots.rows.map((c) => ({ ...c, estado_vigente: estadoVigente(c) })),
      actividades: actividades.rows,
      correos: correos.rows,
    });
  } catch (err) { next(err); }
});

router.post('/contactos', async (req, res, next) => {
  try {
    const v = validarContacto(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const d = v.datos;
    const { rows } = await query(
      `INSERT INTO contactos (nombre, email, telefono, cargo, empresa, rut_empresa, ciudad, origen, estado, motivo_perdida, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (lower(email)) DO NOTHING
       RETURNING *`,
      [d.nombre, d.email, d.telefono, d.cargo, d.empresa, d.rut_empresa, d.ciudad, d.origen, d.estado, d.motivo_perdida, d.notas]
    );
    if (!rows[0]) {
      return res.status(409).json({ error: 'Ya existe un contacto con ese correo. Búscalo en la lista.' });
    }
    await anotar(rows[0].id, 'nota', `Contacto creado (${d.origen}).`, req.usuario.sub);
    res.status(201).json({ contacto: rows[0] });
  } catch (err) { next(err); }
});

router.put('/contactos/:id', async (req, res, next) => {
  try {
    if (!esUuid(req.params.id)) return res.status(404).json({ error: 'No existe.' });
    const v = validarContacto(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const d = v.datos;

    const { rows: antes } = await query('SELECT estado FROM contactos WHERE id = $1', [req.params.id]);
    if (!antes[0]) return res.status(404).json({ error: 'No existe.' });

    const { rows } = await query(
      `UPDATE contactos SET nombre=$1, email=$2, telefono=$3, cargo=$4, empresa=$5, rut_empresa=$6,
              ciudad=$7, origen=$8, estado=$9, motivo_perdida=$10, notas=$11, updated_at=now()
        WHERE id=$12 RETURNING *`,
      [d.nombre, d.email, d.telefono, d.cargo, d.empresa, d.rut_empresa, d.ciudad, d.origen,
        d.estado, d.motivo_perdida, d.notas, req.params.id]
    );

    // El cambio de etapa se anota solo. Es el dato que después permite
    // saber cuánto demora un contacto en avanzar.
    if (antes[0].estado !== d.estado) {
      const extra = d.motivo_perdida ? ` — ${d.motivo_perdida}` : '';
      await anotar(req.params.id, 'estado',
        `${NOMBRE_ESTADO_CRM[antes[0].estado]} → ${NOMBRE_ESTADO_CRM[d.estado]}${extra}`, req.usuario.sub);
    }
    res.json({ contacto: rows[0] });
  } catch (err) { next(err); }
});

router.post('/contactos/:id/interacciones', async (req, res, next) => {
  try {
    if (!esUuid(req.params.id)) return res.status(404).json({ error: 'No existe.' });
    const tipo = String(req.body?.tipo || 'nota');
    if (!TIPOS_INTERACCION.includes(tipo)) return res.status(400).json({ error: 'Tipo no válido.' });
    const detalle = String(req.body?.detalle || '').trim();
    if (!detalle) return res.status(400).json({ error: 'Escribe qué pasó.' });

    const { rows } = await query(
      'INSERT INTO interacciones (contacto_id, usuario_id, tipo, detalle) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, req.usuario.sub, tipo, detalle]
    );
    await query('UPDATE contactos SET updated_at = now() WHERE id = $1', [req.params.id]);
    res.status(201).json({ interaccion: rows[0] });
  } catch (err) { next(err); }
});

// ---------------- Cotizaciones ----------------

router.get('/cotizaciones', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT q.*, c.nombre AS contacto_nombre,
              COALESCE(p.pagado, 0)::bigint AS pagado
         FROM cotizaciones q
         JOIN contactos c ON c.id = q.contacto_id
         LEFT JOIN (SELECT cotizacion_id, SUM(monto) AS pagado FROM pagos
                     WHERE estado = 'confirmado' GROUP BY cotizacion_id) p
                ON p.cotizacion_id = q.id
        ORDER BY q.created_at DESC`
    );
    res.json({
      cotizaciones: rows.map((c) => ({
        ...c,
        estado_vigente: estadoVigente(c),
        nombre_estado: NOMBRE_ESTADO[estadoVigente(c)],
        saldo: Number(c.total) - Number(c.pagado),
      })),
    });
  } catch (err) { next(err); }
});

router.get('/cotizaciones/:id', async (req, res, next) => {
  try {
    if (!esUuid(req.params.id)) return res.status(404).json({ error: 'No existe.' });
    const { rows } = await query('SELECT * FROM cotizaciones WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No existe.' });
    const [items, pagos] = await Promise.all([
      query('SELECT * FROM cotizacion_items WHERE cotizacion_id = $1 ORDER BY orden', [req.params.id]),
      query('SELECT * FROM pagos WHERE cotizacion_id = $1 ORDER BY created_at', [req.params.id]),
    ]);
    const c = rows[0];
    res.json({
      cotizacion: { ...c, estado_vigente: estadoVigente(c), nombre_estado: NOMBRE_ESTADO[estadoVigente(c)] },
      items: items.rows,
      pagos: pagos.rows,
      cobro: saldo(c, pagos.rows),
      estado_cobro: estadoCobro(c, pagos.rows),
      // El enlace público se muestra UNA vez acá para que se pueda copiar.
      enlace: `${config.urlPublica}/cotizacion/${c.token}`,
    });
  } catch (err) { next(err); }
});

// El folio se asigna dentro de la transacción, con candado de asesoría
// sobre el año. Sin él, dos cotizaciones creadas en el mismo instante
// piden el mismo MAX+1 y una de las dos revienta contra el índice único
// —o peor, en otro esquema, quedan las dos con el mismo folio—.
async function siguienteFolio(cliente) {
  const anio = new Date().getFullYear();
  await cliente.query('SELECT pg_advisory_xact_lock($1)', [anio]);
  const { rows } = await cliente.query(
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(folio, '^COT-\\d{4}-', ''), '')::int), 0) + 1 AS n
       FROM cotizaciones WHERE folio LIKE $1`,
    [`COT-${anio}-%`]
  );
  return folioDe(anio, rows[0].n);
}

router.post('/cotizaciones', async (req, res, next) => {
  try {
    if (!esUuid(req.body?.contacto_id)) return res.status(400).json({ error: 'Falta el contacto.' });
    const v = validarCotizacion(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const d = v.datos;

    const creada = await withTx(async (cliente) => {
      const { rows: cont } = await cliente.query('SELECT * FROM contactos WHERE id = $1', [req.body.contacto_id]);
      if (!cont[0]) return { estado: 404, cuerpo: { error: 'Ese contacto no existe.' } };

      const folio = await siguienteFolio(cliente);
      const token = crypto.randomBytes(24).toString('base64url');

      const { rows } = await cliente.query(
        `INSERT INTO cotizaciones
           (folio, contacto_id, titulo, glosa, cliente_nombre, cliente_email, cliente_empresa, cliente_rut,
            neto, iva, total, tasa_iva, valida_hasta, token)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [folio, cont[0].id, d.titulo, d.glosa, cont[0].nombre, cont[0].email, cont[0].empresa,
          cont[0].rut_empresa, d.neto, d.iva, d.total, d.tasa_iva, d.valida_hasta, token]
      );

      for (const it of d.items) {
        await cliente.query(
          `INSERT INTO cotizacion_items (cotizacion_id, descripcion, cantidad, precio_unitario, subtotal, orden)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [rows[0].id, it.descripcion, it.cantidad, it.precio_unitario, it.subtotal, it.orden]
        );
      }
      return { estado: 201, cuerpo: { cotizacion: rows[0] }, contactoId: cont[0].id, folio, total: d.total };
    });

    if (creada.estado === 201) {
      await anotar(creada.contactoId, 'cotizacion',
        `Cotización ${creada.folio} creada por ${pesos(creada.total)}.`, req.usuario.sub);
    }
    res.status(creada.estado).json(creada.cuerpo);
  } catch (err) { next(err); }
});

// Enviar: cambia el estado, manda el correo y anota. En ese orden — el
// correo se manda DESPUÉS de que el cambio quedó guardado.
router.post('/cotizaciones/:id/enviar', async (req, res, next) => {
  try {
    if (!esUuid(req.params.id)) return res.status(404).json({ error: 'No existe.' });
    const { rows } = await query('SELECT * FROM cotizaciones WHERE id = $1', [req.params.id]);
    const c = rows[0];
    if (!c) return res.status(404).json({ error: 'No existe.' });
    if (c.estado === 'aceptada') {
      return res.status(409).json({ error: 'Esta cotización ya fue aceptada. Crea una nueva si cambió algo.' });
    }

    await query(
      "UPDATE cotizaciones SET estado = 'enviada', enviada_at = COALESCE(enviada_at, now()), updated_at = now() WHERE id = $1",
      [c.id]
    );

    const registro = await enviarPlantilla('cotizacion_enviada', {
      para: c.cliente_email,
      valores: {
        nombre: c.cliente_nombre,
        folio: c.folio,
        titulo: c.titulo,
        total: pesos(c.total),
        valida_hasta: c.valida_hasta
          ? new Date(c.valida_hasta).toLocaleDateString('es-CL')
          : 'sin fecha de vencimiento',
        enlace: `${config.urlPublica}/cotizacion/${c.token}`,
      },
      vinculos: { contactoId: c.contacto_id, cotizacionId: c.id },
      usuarioId: req.usuario.sub,
    });

    await anotar(c.contacto_id, 'correo', `Cotización ${c.folio} enviada a ${c.cliente_email}.`, req.usuario.sub);
    // El contacto avanza a 'cotizado' salvo que ya esté más adelante.
    await query(
      "UPDATE contactos SET estado = 'cotizado', updated_at = now() WHERE id = $1 AND estado IN ('nuevo','contactado','reunion')",
      [c.contacto_id]
    );

    res.json({ ok: true, correo: registro });
  } catch (err) { next(err); }
});

// ---------------- Pagos ----------------

router.post('/cotizaciones/:id/pagos', async (req, res, next) => {
  try {
    if (!esUuid(req.params.id)) return res.status(404).json({ error: 'No existe.' });
    const monto = Number(req.body?.monto);
    if (!Number.isInteger(monto) || monto <= 0) {
      return res.status(400).json({ error: 'El monto tiene que ser un número entero de pesos mayor que 0.' });
    }
    const medio = String(req.body?.medio || 'transferencia');
    if (!MEDIOS_PAGO.includes(medio)) return res.status(400).json({ error: 'Medio de pago no válido.' });

    const { rows: cot } = await query('SELECT * FROM cotizaciones WHERE id = $1', [req.params.id]);
    if (!cot[0]) return res.status(404).json({ error: 'No existe.' });

    // Se registra CONFIRMADO cuando quien lo carga dice haberlo visto en
    // la cuenta; si no, entra pendiente. Es un acto humano con nombre.
    const confirmar = req.body?.confirmado === true;
    const { rows } = await query(
      `INSERT INTO pagos (cotizacion_id, monto, medio, estado, referencia, pagado_at, confirmado_at, confirmado_por, nota)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.id, monto, medio, confirmar ? 'confirmado' : 'pendiente',
        String(req.body?.referencia || '').trim() || null,
        req.body?.pagado_at || new Date().toISOString(),
        confirmar ? new Date().toISOString() : null,
        confirmar ? req.usuario.sub : null,
        String(req.body?.nota || '').trim() || null]
    );

    await anotar(cot[0].contacto_id, 'pago',
      `${confirmar ? 'Pago confirmado' : 'Pago informado (por confirmar)'} de ${pesos(monto)} — ${cot[0].folio}.`,
      req.usuario.sub);

    if (confirmar) await ascenderACliente(cot[0].contacto_id);

    const { rows: todos } = await query('SELECT * FROM pagos WHERE cotizacion_id = $1', [req.params.id]);
    res.status(201).json({ pago: rows[0], cobro: saldo(cot[0], todos) });
  } catch (err) { next(err); }
});

router.put('/pagos/:id', async (req, res, next) => {
  try {
    if (!esUuid(req.params.id)) return res.status(404).json({ error: 'No existe.' });
    const estado = String(req.body?.estado || '');
    if (!['pendiente', 'confirmado', 'anulado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado de pago no válido.' });
    }
    const { rows } = await query(
      `UPDATE pagos SET estado = $1,
              confirmado_at = CASE WHEN $1 = 'confirmado' THEN now() ELSE NULL END,
              confirmado_por = CASE WHEN $1 = 'confirmado' THEN $2::uuid ELSE NULL END
        WHERE id = $3 RETURNING *`,
      [estado, req.usuario.sub, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No existe.' });

    const { rows: cot } = await query('SELECT * FROM cotizaciones WHERE id = $1', [rows[0].cotizacion_id]);
    await anotar(cot[0]?.contacto_id, 'pago',
      `Pago de ${pesos(rows[0].monto)} marcado «${estado}» — ${cot[0]?.folio}.`, req.usuario.sub);

    // Este es el camino NORMAL: el cliente avisó que transfirió y alguien
    // de Antai lo ve en la cuenta. Sin esta línea el contacto se quedaba
    // en «cotizado» con la plata ya cobrada.
    if (estado === 'confirmado') await ascenderACliente(cot[0]?.contacto_id);

    res.json({ pago: rows[0] });
  } catch (err) { next(err); }
});

// ---------------- Correo ----------------

router.get('/correos', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.id, e.para, e.asunto, e.plantilla, e.estado, e.error, e.created_at,
              c.nombre AS contacto_nombre
         FROM correos_enviados e
         LEFT JOIN contactos c ON c.id = e.contacto_id
        ORDER BY e.created_at DESC LIMIT 200`
    );
    res.json({ correos: rows });
  } catch (err) { next(err); }
});

router.get('/plantillas', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM plantillas_correo ORDER BY nombre');
    res.json({ plantillas: rows });
  } catch (err) { next(err); }
});

router.put('/plantillas/:slug', async (req, res, next) => {
  try {
    const asunto = String(req.body?.asunto || '').trim();
    const cuerpo = String(req.body?.cuerpo || '').trim();
    if (!asunto || !cuerpo) return res.status(400).json({ error: 'El asunto y el cuerpo no pueden ir vacíos.' });

    const p = await plantilla(req.params.slug);
    if (!p) return res.status(404).json({ error: 'No existe esa plantilla.' });
    if (!p.editable) return res.status(409).json({ error: 'Esta plantilla no se edita desde el panel.' });

    const { rows } = await query(
      'UPDATE plantillas_correo SET asunto=$1, cuerpo=$2, updated_at=now() WHERE slug=$3 RETURNING *',
      [asunto, cuerpo, req.params.slug]
    );
    res.json({ plantilla: rows[0] });
  } catch (err) { next(err); }
});

// Correo escrito a mano a un contacto.
router.post('/contactos/:id/correo', async (req, res, next) => {
  try {
    if (!esUuid(req.params.id)) return res.status(404).json({ error: 'No existe.' });
    const asunto = String(req.body?.asunto || '').trim();
    const cuerpo = String(req.body?.cuerpo || '').trim();
    if (!asunto || !cuerpo) return res.status(400).json({ error: 'Falta el asunto o el cuerpo.' });

    const { rows } = await query('SELECT * FROM contactos WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No existe.' });

    const registro = await enviarSuelto({
      para: rows[0].email, asunto, cuerpo,
      vinculos: { contactoId: rows[0].id }, usuarioId: req.usuario.sub,
    });
    await anotar(rows[0].id, 'correo', `Correo enviado: «${asunto}».`, req.usuario.sub);
    res.status(201).json({ correo: registro });
  } catch (err) { next(err); }
});

// ---------------- Tablero ----------------

router.get('/tablero', async (req, res, next) => {
  try {
    const [contactos, cots, pagos, correos] = await Promise.all([
      query('SELECT estado FROM contactos'),
      query("SELECT total, estado, valida_hasta FROM cotizaciones WHERE estado <> 'borrador'"),
      query("SELECT monto, estado FROM pagos"),
      query("SELECT COUNT(*)::int AS n FROM correos_enviados WHERE estado = 'error'"),
    ]);

    const vigentes = cots.rows.filter((c) => estadoVigente(c) === 'enviada');
    const aceptadas = cots.rows.filter((c) => c.estado === 'aceptada');
    const cobrado = pagos.rows.filter((p) => p.estado === 'confirmado')
      .reduce((a, p) => a + Number(p.monto), 0);
    const porConfirmar = pagos.rows.filter((p) => p.estado === 'pendiente')
      .reduce((a, p) => a + Number(p.monto), 0);

    res.json({
      embudo: resumenEmbudo(contactos.rows),
      cotizaciones: {
        vigentes: vigentes.length,
        monto_vigente: vigentes.reduce((a, c) => a + Number(c.total), 0),
        aceptadas: aceptadas.length,
        monto_aceptado: aceptadas.reduce((a, c) => a + Number(c.total), 0),
      },
      // Cobrado y por confirmar van SEPARADOS: sumarlos sería contar como
      // ingreso un depósito que nadie vio en la cuenta.
      caja: { cobrado, por_confirmar: porConfirmar },
      correos_con_error: correos.rows[0].n,
    });
  } catch (err) { next(err); }
});

export default router;
