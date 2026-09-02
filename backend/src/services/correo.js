import { query } from '../lib/db.js';
import { enviar, modoCorreo } from './mailer.js';

// ============================================================
// Sistema de correo: plantilla → texto → envío → bitácora.
//
// LAS PLANTILLAS SON TEXTO, NO CÓDIGO. El reemplazo es literal:
// {{nombre}} se cambia por el valor y nada más. Nunca se evalúa el
// contenido de una plantilla. Alguien con acceso al panel puede editar el
// cuerpo de un correo; si eso pudiera ejecutar algo, editar una plantilla
// sería ejecutar código en el servidor.
//
// EL ENVÍO NO LANZA. Que el servidor de correo esté caído no puede
// deshacer la reserva que ya se tomó ni la cotización que ya se guardó.
// Se registra el fallo en la bitácora y la operación sigue; quien mira el
// panel ve el correo en rojo y lo reenvía.
// ============================================================

// Marcas que quedaron sin reemplazo. Se detectan para AVISAR: un correo
// que le llega a alguien diciendo «Hola {{nombre}}» es peor que uno que
// no llega.
export function marcasSinResolver(texto) {
  return [...new Set((String(texto).match(/\{\{(\w+)\}\}/g) || []))];
}

export function aplicar(plantillaTexto, valores = {}) {
  return String(plantillaTexto).replace(/\{\{(\w+)\}\}/g, (completo, llave) => {
    const v = valores[llave];
    // Se distingue «no vino la llave» de «vino vacía»: la primera deja la
    // marca visible para que marcasSinResolver() la delate; la segunda es
    // una decisión de quien llama y se respeta.
    if (v === undefined) return completo;
    return v === null ? '' : String(v);
  });
}

export async function plantilla(slug) {
  const { rows } = await query('SELECT * FROM plantillas_correo WHERE slug = $1', [slug]);
  return rows[0] || null;
}

// Envía usando una plantilla y deja constancia. Devuelve el registro.
//
// `vinculos` engancha el correo a lo que lo motivó (contacto, cotización,
// reserva) para que el panel pueda responder «¿qué se le mandó a esta
// persona?» sin buscar en la casilla de nadie.
export async function enviarPlantilla(slug, { para, valores = {}, vinculos = {}, usuarioId = null }) {
  const p = await plantilla(slug);
  if (!p) {
    console.error(`[correo] no existe la plantilla «${slug}»`);
    return registrar({
      para, asunto: `(plantilla ${slug} no encontrada)`, cuerpo: '',
      plantilla: slug, estado: 'error', error: `plantilla «${slug}» no existe`,
      vinculos, usuarioId,
    });
  }

  const asunto = aplicar(p.asunto, valores);
  const cuerpo = aplicar(p.cuerpo, valores);

  const faltantes = [...marcasSinResolver(asunto), ...marcasSinResolver(cuerpo)];
  if (faltantes.length) {
    // Se avisa fuerte pero SE MANDA IGUAL: retener el correo por una
    // marca suelta dejaría a la persona sin su confirmación. Queda en la
    // bitácora con la marca a la vista.
    console.warn(`[correo] «${slug}» salió con marcas sin reemplazar: ${faltantes.join(' ')}`);
  }

  return enviarSuelto({ para, asunto, cuerpo, plantillaSlug: slug, vinculos, usuarioId });
}

// Un correo escrito a mano desde el panel.
export async function enviarSuelto({ para, asunto, cuerpo, plantillaSlug = null, vinculos = {}, usuarioId = null }) {
  const r = await enviar({ para, asunto, texto: cuerpo });
  const estado = r.enviado ? 'enviado' : (r.modo === 'consola' ? 'consola' : 'error');
  return registrar({
    para, asunto, cuerpo, plantilla: plantillaSlug,
    estado, error: r.error || null, vinculos, usuarioId,
  });
}

async function registrar({ para, asunto, cuerpo, plantilla: slug, estado, error, vinculos, usuarioId }) {
  try {
    const { rows } = await query(
      `INSERT INTO correos_enviados
         (para, asunto, cuerpo, plantilla, contacto_id, cotizacion_id, reserva_id, estado, error, enviado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, para, asunto, estado, error, created_at`,
      [para, asunto, cuerpo, slug, vinculos.contactoId || null, vinculos.cotizacionId || null,
        vinculos.reservaId || null, estado, error, usuarioId]
    );
    return rows[0];
  } catch (e) {
    // Si falla la bitácora, el correo YA SALIÓ. Perder el registro es
    // malo; hacer creer que el envío falló sería peor, porque llevaría a
    // reenviarlo. Se avisa y se devuelve lo que se sabe.
    console.error(`[correo] el envío salió pero no se pudo registrar: ${e.message}`);
    return { id: null, para, asunto, estado, error, created_at: new Date().toISOString(), sin_bitacora: true };
  }
}

export { modoCorreo };
