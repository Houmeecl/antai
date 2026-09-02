// ============================================================
// Cotizaciones — funciones PURAS.
//
// TODA LA PLATA EN PESOS ENTEROS. El peso chileno no tiene decimales, y
// los flotantes tienen fama merecida: 0.1 + 0.2 no da 0.3. En un
// documento que alguien firma, un peso de diferencia es una llamada
// telefónica; mil cotizaciones con un peso de diferencia es un problema
// contable. Acá todo es entero y el único redondeo es el del IVA, en un
// solo lugar de este archivo.
//
// EL VENCIMIENTO SE DERIVA, NO SE ESCRIBE. Una cotización no cambia de
// estado sola en la base por el paso del tiempo: `estadoVigente()` mira
// la fecha al leer. Una tarea nocturna que reescriba filas produce
// estados que nadie decidió y que después no se pueden explicar —«¿quién
// la venció?» «nadie, el sistema»—.
// ============================================================

export const ESTADOS = ['borrador', 'enviada', 'aceptada', 'rechazada', 'vencida'];
export const MEDIOS_PAGO = ['transferencia', 'pasarela', 'efectivo', 'otro'];
export const ESTADOS_PAGO = ['pendiente', 'confirmado', 'anulado'];

export const TASA_IVA = 19;

// Redondeo al peso. Math.round y no trunc: truncar siempre a favor de uno
// de los dos lados es un sesgo, y sobre muchos documentos se nota.
const peso = (n) => Math.round(Number(n) || 0);

// Subtotal de una línea. La cantidad admite decimales (media jornada, 1,5
// horas); el resultado nunca.
export function subtotalItem(item) {
  const cantidad = Number(item?.cantidad);
  const precio = Number(item?.precio_unitario);
  if (!Number.isFinite(cantidad) || !Number.isFinite(precio)) return 0;
  if (cantidad <= 0 || precio < 0) return 0;
  return peso(cantidad * precio);
}

// Los tres números del pie. `tasa` viaja como argumento y no como
// constante global porque una cotización vieja tiene que seguir cuadrando
// con la tasa que tenía cuando se emitió.
export function totales(items = [], tasa = TASA_IVA) {
  const neto = (items || []).reduce((acc, i) => acc + subtotalItem(i), 0);
  const iva = peso(neto * (Number(tasa) / 100));
  return { neto, iva, total: neto + iva, tasa_iva: Number(tasa) };
}

// Estado que se le muestra a la gente.
//
// 'vencida' se calcula: una cotización 'enviada' cuya validez pasó está
// vencida aunque la fila diga otra cosa. Los estados terminales
// —aceptada, rechazada— NO vencen: lo que ya se decidió no se deshace
// porque pasó una fecha.
// La zona del negocio. NO la del servidor: un VPS corre en UTC y una
// cotización válida «hasta el 30» tiene que valer todo el 30 en Chile, no
// hasta las 21:00 hora chilena. Este bug no aparece en desarrollo —donde
// el reloj de la máquina suele ser el local— y aparece todos los días en
// producción, durante las tres horas de diferencia.
export const ZONA = 'America/Santiago';

const FORMATO_ZONA = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA, hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

// Cuánto va adelantada la zona respecto de UTC en ESE instante. Se
// consulta por instante y no una vez, porque Chile cambia de hora: en
// enero son -03:00 y en julio -04:00.
function desfase(instante) {
  const p = Object.fromEntries(FORMATO_ZONA.formatToParts(instante).map((x) => [x.type, x.value]));
  const comoUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second)
  );
  return comoUtc - instante;
}

// El último milisegundo de ese día EN CHILE, como instante absoluto.
//
// Se afina una vez: si el primer tanteo cae al otro lado de un cambio de
// hora, el desfase que se usó era el equivocado. Dos pasadas bastan
// porque el salto es de una hora, no de un día.
export function finDelDiaEnChile(fecha) {
  // Acepta 'YYYY-MM-DD' y también un objeto Date, porque `pg` devuelve
  // las columnas DATE como Date y no como texto. Convertirlo con
  // String() daba 'Tue Sep 22' y el parseo producía NaN: el resultado
  // era un 500 en cada cotización que tuviera fecha de validez.
  const y = fecha instanceof Date ? fecha.getUTCFullYear() : null;
  let anio; let mes; let dia;
  if (y !== null) {
    anio = y; mes = fecha.getUTCMonth() + 1; dia = fecha.getUTCDate();
  } else {
    [anio, mes, dia] = String(fecha).slice(0, 10).split('-').map(Number);
  }
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || !Number.isFinite(dia)) {
    // Una fecha que no se entiende NO vence la cotización. Tratar lo
    // ilegible como vencido le quitaría al cliente un documento vigente
    // por un problema nuestro de formato.
    return Number.POSITIVE_INFINITY;
  }
  const tanteo = Date.UTC(anio, mes - 1, dia, 23, 59, 59, 999);
  let instante = tanteo - desfase(tanteo);
  instante = tanteo - desfase(instante);
  return instante;
}

export function estadoVigente(cotizacion, hoy = new Date()) {
  const guardado = cotizacion?.estado || 'borrador';
  if (guardado !== 'enviada') return guardado;
  if (!cotizacion?.valida_hasta) return 'enviada';

  // Vale TODO el último día, en hora de Chile.
  return new Date(hoy).getTime() > finDelDiaEnChile(cotizacion.valida_hasta)
    ? 'vencida' : 'enviada';
}

export const NOMBRE_ESTADO = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  vencida: 'Vencida',
};

// ¿La otra parte puede aceptarla desde el enlace público?
// Devuelve el motivo cuando no, para poder mostrárselo en vez de un
// «no se puede» que la deje adivinando.
export function puedeAceptar(cotizacion, hoy = new Date()) {
  if (!cotizacion) return { puede: false, motivo: 'Esta cotización no existe.' };
  const estado = estadoVigente(cotizacion, hoy);
  if (estado === 'aceptada') return { puede: false, motivo: 'Esta cotización ya fue aceptada.' };
  if (estado === 'rechazada') return { puede: false, motivo: 'Esta cotización fue rechazada.' };
  if (estado === 'vencida') return { puede: false, motivo: 'Esta cotización venció. Pídenos una nueva.' };
  if (estado === 'borrador') return { puede: false, motivo: 'Esta cotización no existe.' };
  return { puede: true, motivo: null };
}

// ---------- Pagos ----------

// Solo los CONFIRMADOS cuentan. Un pago 'pendiente' es alguien diciendo
// que pagó; el saldo tiene que reflejar lo que se vio en la cuenta, no lo
// que se prometió. Contar los pendientes es la forma más rápida de creer
// que uno cobró algo que no cobró.
export const pagoCuenta = (p) => p?.estado === 'confirmado';

export function saldo(cotizacion, pagos = []) {
  const total = Number(cotizacion?.total) || 0;
  const pagado = (pagos || []).filter(pagoCuenta).reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const pendiente = (pagos || [])
    .filter((p) => p?.estado === 'pendiente')
    .reduce((a, p) => a + (Number(p.monto) || 0), 0);

  return {
    total,
    pagado,
    // Por confirmar se informa APARTE. Sumarlo al pagado sería contar como
    // cobrado un depósito que nadie vio.
    por_confirmar: pendiente,
    saldo: Math.max(0, total - pagado),
    // Pagado de más existe: un abono duplicado o un error de la otra
    // parte. Decirlo es la única forma de devolverlo.
    a_favor: Math.max(0, pagado - total),
    saldada: pagado >= total && total > 0,
  };
}

export function estadoCobro(cotizacion, pagos = []) {
  const s = saldo(cotizacion, pagos);
  if (s.total === 0) return 'sin_monto';
  if (s.saldada) return 'pagada';
  if (s.pagado > 0) return 'abonada';
  if (s.por_confirmar > 0) return 'por_confirmar';
  return 'impaga';
}

export const NOMBRE_COBRO = {
  sin_monto: 'Sin monto',
  impaga: 'Sin pagos',
  por_confirmar: 'Pago por confirmar',
  abonada: 'Abonada',
  pagada: 'Pagada',
};

// ---------- Formato ----------

// Pesos chilenos, sin decimales, con punto de miles. Un solo lugar: si
// cada pantalla lo formatea a su manera, el mismo número se ve distinto
// en el panel y en el correo.
export function pesos(n) {
  const v = Math.round(Number(n) || 0);
  return `$${v.toLocaleString('es-CL')}`;
}

// Folio COT-AAAA-NNNN. El correlativo lo da la base; acá solo se arma.
export function folioDe(anio, correlativo) {
  return `COT-${anio}-${String(correlativo).padStart(4, '0')}`;
}

// ---------- Validación ----------

export function validarItem(item, i = 0) {
  const donde = `línea ${i + 1}`;
  const descripcion = String(item?.descripcion || '').trim();
  if (!descripcion) return { ok: false, error: `Falta la descripción en la ${donde}.` };

  const cantidad = Number(item?.cantidad);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { ok: false, error: `La cantidad de la ${donde} tiene que ser mayor que 0.` };
  }

  const precio = Number(item?.precio_unitario);
  if (!Number.isFinite(precio) || precio < 0 || !Number.isInteger(precio)) {
    return { ok: false, error: `El precio de la ${donde} tiene que ser un número entero de pesos.` };
  }

  return { ok: true, datos: { descripcion, cantidad, precio_unitario: precio, subtotal: subtotalItem({ cantidad, precio_unitario: precio }) } };
}

export function validarCotizacion(d) {
  if (!d || typeof d !== 'object') return { ok: false, error: 'Faltan los datos.' };

  const titulo = String(d.titulo || '').trim();
  if (titulo.length < 3) return { ok: false, error: 'Falta el título de la cotización.' };

  if (!Array.isArray(d.items) || d.items.length === 0) {
    return { ok: false, error: 'Una cotización sin líneas no es una cotización.' };
  }

  const items = [];
  for (let i = 0; i < d.items.length; i += 1) {
    const v = validarItem(d.items[i], i);
    if (!v.ok) return v;
    items.push({ ...v.datos, orden: i });
  }

  let validaHasta = null;
  if (d.valida_hasta) {
    const f = new Date(d.valida_hasta);
    if (Number.isNaN(f.getTime())) return { ok: false, error: 'La fecha de validez no se entiende.' };
    validaHasta = d.valida_hasta;
  }

  return {
    ok: true,
    datos: {
      titulo,
      glosa: String(d.glosa || '').trim() || null,
      items,
      valida_hasta: validaHasta,
      ...totales(items, d.tasa_iva ?? TASA_IVA),
    },
  };
}

// Lo que ve la otra parte por el enlace público. Lista BLANCA.
//
// Lo que NO sale, y por qué: el `token` (ya lo tiene, repetirlo lo mete
// en más lugares), el `contacto_id` (es un identificador interno), las
// notas del CRM, y la `aceptada_ip` — que se guarda como constancia de la
// aceptación, no para mostrársela a nadie.
export function cotizacionPublica(c, items = [], pagos = [], hoy = new Date()) {
  return {
    folio: c.folio,
    titulo: c.titulo,
    glosa: c.glosa,
    cliente_nombre: c.cliente_nombre,
    cliente_empresa: c.cliente_empresa,
    cliente_rut: c.cliente_rut,
    emitida: c.enviada_at || c.created_at,
    valida_hasta: c.valida_hasta,
    estado: estadoVigente(c, hoy),
    nombre_estado: NOMBRE_ESTADO[estadoVigente(c, hoy)],
    items: (items || []).map((i) => ({
      descripcion: i.descripcion,
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
      subtotal: Number(i.subtotal),
    })),
    neto: Number(c.neto),
    iva: Number(c.iva),
    total: Number(c.total),
    tasa_iva: Number(c.tasa_iva),
    cobro: saldo(c, pagos),
    aceptada_at: c.aceptada_at,
  };
}
