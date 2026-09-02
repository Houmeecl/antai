// ============================================================
// Agenda — funciones PURAS. Sin base de datos, sin Express.
//
// Acá vive todo lo que decide si alguien puede o no tomar una fecha. Las
// rutas consultan, las pantallas consultan, y las dos preguntan al MISMO
// lugar. Esa es la razón de que este archivo exista separado: cuando la
// regla del cupo vive en dos sitios, el botón termina diciendo «quedan 2»
// mientras el servidor responde «lleno», y quien queda mal es el producto.
//
// LA REGLA QUE MÁS IMPORTA: `cupo` NULL es SIN LÍMITE, no cero.
// `cuposDisponibles()` devuelve null en ese caso y ninguna comparación
// numérica se hace contra él. Devolver 0 «por comodidad» cerraría la
// inscripción de todos los eventos sin tope, y sería el clásico error de
// tratar la ausencia de un dato como si fuera el valor cero.
// ============================================================

export const MODALIDADES = ['presencial', 'online', 'mixta'];
export const ESTADOS_RESERVA = ['reservada', 'asistio', 'no_asistio', 'cancelada'];

// Una reserva OCUPA lugar salvo que esté cancelada. 'no_asistio' sigue
// ocupando: la persona tomó el cupo y no fue, que es justamente el dato
// que el equipo necesita ver para la próxima.
export const ocupaCupo = (r) => Boolean(r) && r.estado !== 'cancelada';

export const reservasQueOcupan = (reservas = []) => (reservas || []).filter(ocupaCupo);

// Cupos que quedan.
//   null  → el evento no tiene tope. NO es cero.
//   0     → tope alcanzado.
// Nunca devuelve negativo: si por lo que sea hay más reservas que cupo, el
// dato honesto es «no queda ninguno», no «quedan -3».
export function cuposDisponibles(evento, reservas = []) {
  const cupo = evento?.cupo;
  if (cupo === null || cupo === undefined) return null;
  return Math.max(0, Number(cupo) - reservasQueOcupan(reservas).length);
}

export const sinLimite = (evento) => evento?.cupo === null || evento?.cupo === undefined;

// Dónde está el evento respecto de ahora.
//   agendado  → todavía no empieza
//   en_curso  → empezó y no ha terminado (si declaró término)
//   pasado    → ya ocurrió
export function estadoEvento(evento, ahora = new Date()) {
  if (!evento?.inicia_at) return 'agendado';
  const t = new Date(ahora).getTime();
  const inicia = new Date(evento.inicia_at).getTime();
  if (t < inicia) return 'agendado';
  const termina = evento.termina_at ? new Date(evento.termina_at).getTime() : inicia;
  return t <= termina ? 'en_curso' : 'pasado';
}

// ¿Se puede reservar? Una sola respuesta, con el motivo en palabras que se
// pueden mostrar tal cual. El motivo importa: «no se puede» sin decir por
// qué obliga a la persona a adivinar si el problema es suyo o del sistema.
export function puedeReservar(evento, reservas = [], ahora = new Date()) {
  if (!evento) return { puede: false, motivo: 'Esta fecha no existe.' };
  if (!evento.publicado) return { puede: false, motivo: 'Esta fecha no existe.' };

  if (estadoEvento(evento, ahora) !== 'agendado') {
    return { puede: false, motivo: 'Esta fecha ya ocurrió. Mira las próximas en la agenda.' };
  }

  const quedan = cuposDisponibles(evento, reservas);
  if (quedan === 0) {
    return { puede: false, motivo: 'No quedan cupos para esta fecha.' };
  }

  return { puede: true, motivo: null, quedan };
}

// Cómo se le muestra el cupo a la gente. Un evento sin tope dice
// «Inscripción abierta» — no «∞», que no significa nada, ni un número
// grande inventado.
export function textoCupo(evento, reservas = []) {
  const quedan = cuposDisponibles(evento, reservas);
  if (quedan === null) return 'Inscripción abierta';
  if (quedan === 0) return 'Sin cupos';
  return quedan === 1 ? 'Queda 1 cupo' : `Quedan ${quedan} cupos`;
}

// Validación de lo que llega del formulario. Espeja los NOT NULL del
// esquema para dar un mensaje en español en vez de un 500 de Postgres.
//
// El correo se valida con una forma mínima a propósito: la única
// comprobación que vale de verdad es que llegue el mensaje, y eso lo hace
// el envío, no una expresión regular cada vez más larga.
export function validarReserva(d) {
  if (!d || typeof d !== 'object') return { ok: false, error: 'Faltan los datos.' };

  const nombre = String(d.nombre || '').trim();
  if (nombre.length < 2) return { ok: false, error: 'Falta tu nombre.' };

  const email = String(d.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Ese correo no parece válido.' };
  }

  return {
    ok: true,
    datos: {
      nombre,
      email,
      empresa: String(d.empresa || '').trim() || null,
      telefono: String(d.telefono || '').trim() || null,
    },
  };
}

// Validación de un evento antes de guardarlo, desde el panel.
export function validarEvento(d) {
  if (!d || typeof d !== 'object') return { ok: false, error: 'Faltan los datos.' };

  const titulo = String(d.titulo || '').trim();
  if (titulo.length < 3) return { ok: false, error: 'Falta el título de la actividad.' };

  const ciudad = String(d.ciudad || '').trim();
  if (!ciudad) return { ok: false, error: 'Falta la ciudad.' };

  const inicia = d.inicia_at ? new Date(d.inicia_at) : null;
  if (!inicia || Number.isNaN(inicia.getTime())) {
    return { ok: false, error: 'Falta la fecha y hora de inicio.' };
  }

  const termina = d.termina_at ? new Date(d.termina_at) : null;
  if (d.termina_at && Number.isNaN(termina?.getTime())) {
    return { ok: false, error: 'La hora de término no se entiende.' };
  }
  if (termina && termina <= inicia) {
    return { ok: false, error: 'La actividad no puede terminar antes de empezar.' };
  }

  const modalidad = String(d.modalidad || 'presencial');
  if (!MODALIDADES.includes(modalidad)) {
    return { ok: false, error: `Modalidad no válida. Usa: ${MODALIDADES.join(', ')}.` };
  }

  // Cupo: se distingue "no vino en el formulario" de "vino vacío". Los dos
  // significan sin límite, pero un 0 explícito es un error que hay que
  // decir, no convertir en null en silencio.
  let cupo = null;
  if (d.cupo !== null && d.cupo !== undefined && String(d.cupo).trim() !== '') {
    cupo = Number(d.cupo);
    if (!Number.isInteger(cupo) || cupo <= 0) {
      return { ok: false, error: 'El cupo tiene que ser un número entero mayor que 0. Déjalo vacío si no hay tope.' };
    }
  }

  return {
    ok: true,
    datos: {
      titulo,
      descripcion: String(d.descripcion || '').trim() || null,
      ciudad,
      lugar: String(d.lugar || '').trim() || null,
      modalidad,
      inicia_at: inicia.toISOString(),
      termina_at: termina ? termina.toISOString() : null,
      cupo,
      publicado: Boolean(d.publicado),
    },
  };
}

// Lo que sale hacia el público. Lista BLANCA: se nombra lo que se muestra,
// nunca se borra lo que no. Construir la respuesta quitando campos
// significa que el día que la consulta traiga una columna nueva, esa
// columna sale publicada sin que nadie lo haya decidido.
export function eventoPublico(evento, reservas = []) {
  return {
    id: evento.id,
    titulo: evento.titulo,
    descripcion: evento.descripcion,
    ciudad: evento.ciudad,
    lugar: evento.lugar,
    modalidad: evento.modalidad,
    inicia_at: evento.inicia_at,
    termina_at: evento.termina_at,
    estado: estadoEvento(evento),
    cupos_disponibles: cuposDisponibles(evento, reservas),  // null = sin límite
    sin_limite: sinLimite(evento),
    texto_cupo: textoCupo(evento, reservas),
  };
}
