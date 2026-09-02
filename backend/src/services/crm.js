// ============================================================
// CRM — funciones PURAS.
//
// El embudo tiene seis estados y 'perdido' es uno de ellos, con su
// motivo. Borrar al que se perdió deja una lista bonita y ninguna forma
// de aprender por qué se perdió, que es la única información que ese
// contacto todavía puede dar.
// ============================================================

export const ORIGENES = ['agenda', 'portada', 'referido', 'visita', 'licitacion', 'otro'];
export const ESTADOS = ['nuevo', 'contactado', 'reunion', 'cotizado', 'cliente', 'perdido'];
export const TIPOS_INTERACCION = ['nota', 'llamada', 'correo', 'reunion', 'cotizacion', 'pago', 'estado'];

export const NOMBRE_ESTADO = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  reunion: 'Reunión hecha',
  cotizado: 'Cotizado',
  cliente: 'Cliente',
  perdido: 'Perdido',
};

export const NOMBRE_ORIGEN = {
  agenda: 'Vino a una actividad',
  portada: 'Formulario de la portada',
  referido: 'Referido',
  visita: 'Visita en terreno',
  licitacion: 'Licitación',
  otro: 'Otro',
};

// El orden del embudo, para ordenar columnas y medir avance. 'perdido'
// queda FUERA de la secuencia a propósito: no es el paso siguiente a
// 'cliente', es una salida lateral que puede ocurrir en cualquier punto.
export const SECUENCIA = ['nuevo', 'contactado', 'reunion', 'cotizado', 'cliente'];

export function posicionEmbudo(estado) {
  const i = SECUENCIA.indexOf(estado);
  return i === -1 ? null : i;   // null para 'perdido': no se opina
}

// RUT chileno normalizado: sin puntos, sin guion, K mayúscula. Igual que
// se guarda, para que el cruce sea por igualdad.
//
// NO VALIDA el dígito verificador: acá se normaliza lo que entró. Un RUT
// mal escrito es un problema del dato, no de este formato, y rechazarlo
// en la normalización haría perder el contacto entero por un typo.
export function normalizarRut(rut) {
  const limpio = String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
  return limpio || null;
}

export function rutConFormato(rut) {
  const limpio = normalizarRut(rut);
  if (!limpio || limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return `${Number(cuerpo).toLocaleString('es-CL')}-${dv}`;
}

export function validarContacto(d) {
  if (!d || typeof d !== 'object') return { ok: false, error: 'Faltan los datos.' };

  const nombre = String(d.nombre || '').trim();
  if (nombre.length < 2) return { ok: false, error: 'Falta el nombre del contacto.' };

  const email = String(d.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Ese correo no parece válido.' };
  }

  const estado = String(d.estado || 'nuevo');
  if (!ESTADOS.includes(estado)) {
    return { ok: false, error: `Estado no válido. Usa uno de: ${ESTADOS.join(', ')}.` };
  }

  const origen = String(d.origen || 'otro');
  if (!ORIGENES.includes(origen)) {
    return { ok: false, error: `Origen no válido. Usa uno de: ${ORIGENES.join(', ')}.` };
  }

  // Marcar «perdido» sin decir por qué desperdicia la única información
  // que ese contacto todavía puede dar.
  const motivo = String(d.motivo_perdida || '').trim();
  if (estado === 'perdido' && !motivo) {
    return { ok: false, error: 'Para marcarlo perdido, di por qué: es el dato que sirve para la próxima.' };
  }

  return {
    ok: true,
    datos: {
      nombre,
      email,
      telefono: String(d.telefono || '').trim() || null,
      cargo: String(d.cargo || '').trim() || null,
      empresa: String(d.empresa || '').trim() || null,
      rut_empresa: normalizarRut(d.rut_empresa),
      ciudad: String(d.ciudad || '').trim() || null,
      origen,
      estado,
      motivo_perdida: estado === 'perdido' ? motivo : null,
      notas: String(d.notas || '').trim() || null,
    },
  };
}

// Resumen del embudo para el panel. Los estados sin nadie salen en CERO,
// no ausentes: una columna que desaparece porque está vacía hace creer
// que la etapa no existe.
export function resumenEmbudo(contactos = []) {
  const conteo = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  for (const c of contactos || []) {
    if (conteo[c?.estado] !== undefined) conteo[c.estado] += 1;
  }
  return {
    conteo,
    total: (contactos || []).length,
    activos: SECUENCIA.reduce((a, e) => a + conteo[e], 0),
    perdidos: conteo.perdido,
  };
}
