import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cuposDisponibles, sinLimite, estadoEvento, puedeReservar, textoCupo,
  validarReserva, validarEvento, eventoPublico, ocupaCupo,
} from '../src/services/agenda.js';

// ============================================================
// La agenda pura. Sin base, sin servidor: corre en cualquier parte.
// ============================================================

const AHORA = new Date('2026-09-10T12:00:00Z');
const futuro = (extra = {}) => ({
  id: 'e1', publicado: true, inicia_at: '2026-10-01T14:00:00Z', cupo: null, ...extra,
});
const reservas = (n, estado = 'reservada') => new Array(n).fill({ estado });

test('cupo NULL es SIN LÍMITE, y eso NO es cero', () => {
  // Es la regla que sostiene todo lo demás: si esto devolviera 0, todo
  // evento sin tope quedaría cerrado a la inscripción.
  assert.equal(cuposDisponibles(futuro({ cupo: null }), reservas(500)), null);
  assert.equal(cuposDisponibles(futuro({}), []), null);
  assert.equal(sinLimite(futuro({ cupo: null })), true);

  // Y con tope sí es un número.
  assert.equal(cuposDisponibles(futuro({ cupo: 10 }), reservas(3)), 7);
  assert.equal(cuposDisponibles(futuro({ cupo: 3 }), reservas(3)), 0);
});

test('las canceladas liberan el cupo; las que no asistieron NO', () => {
  // Quien tomó el cupo y no fue igual ocupó el lugar: ese es el dato que
  // el equipo necesita ver, no uno que se borre solo.
  assert.equal(ocupaCupo({ estado: 'cancelada' }), false);
  assert.equal(ocupaCupo({ estado: 'no_asistio' }), true);
  assert.equal(ocupaCupo({ estado: 'asistio' }), true);

  const mezcla = [{ estado: 'reservada' }, { estado: 'cancelada' }, { estado: 'no_asistio' }];
  assert.equal(cuposDisponibles(futuro({ cupo: 5 }), mezcla), 3);
});

test('nunca hay cupos negativos', () => {
  // Si por lo que sea entraron más reservas que el tope, el dato honesto
  // es «no queda ninguno», no «quedan -2».
  assert.equal(cuposDisponibles(futuro({ cupo: 2 }), reservas(4)), 0);
});

test('estadoEvento distingue agendado, en curso y pasado', () => {
  assert.equal(estadoEvento({ inicia_at: '2026-10-01T00:00:00Z' }, AHORA), 'agendado');
  assert.equal(estadoEvento({ inicia_at: '2026-01-01T00:00:00Z' }, AHORA), 'pasado');
  assert.equal(estadoEvento({
    inicia_at: '2026-09-10T09:00:00Z', termina_at: '2026-09-10T18:00:00Z',
  }, AHORA), 'en_curso');
});

test('un evento SIN PUBLICAR responde lo mismo que uno inexistente', () => {
  // Si el no publicado dijera «todavía no está abierto», cualquiera
  // podría averiguar qué fechas se están preparando probando ids.
  const oculto = puedeReservar(futuro({ publicado: false }), [], AHORA);
  const inexistente = puedeReservar(null, [], AHORA);
  assert.equal(oculto.puede, false);
  assert.equal(oculto.motivo, inexistente.motivo);
});

test('no se reserva un evento lleno ni uno que ya pasó', () => {
  assert.equal(puedeReservar(futuro({ cupo: 2 }), reservas(2), AHORA).puede, false);
  assert.match(puedeReservar(futuro({ cupo: 2 }), reservas(2), AHORA).motivo, /cupos/i);

  const pasado = puedeReservar(futuro({ inicia_at: '2026-01-01T00:00:00Z' }), [], AHORA);
  assert.equal(pasado.puede, false);
  assert.match(pasado.motivo, /ya ocurrió/i);

  // Y sí se reserva uno sin tope, por muchos que haya.
  assert.equal(puedeReservar(futuro({ cupo: null }), reservas(999), AHORA).puede, true);
});

test('el texto del cupo no inventa números para los eventos sin tope', () => {
  assert.equal(textoCupo(futuro({ cupo: null }), reservas(80)), 'Inscripción abierta');
  assert.equal(textoCupo(futuro({ cupo: 1 }), []), 'Queda 1 cupo');
  assert.equal(textoCupo(futuro({ cupo: 5 }), reservas(2)), 'Quedan 3 cupos');
  assert.equal(textoCupo(futuro({ cupo: 5 }), reservas(5)), 'Sin cupos');
});

test('validarEvento rechaza el cupo 0 en vez de convertirlo en «sin tope»', () => {
  // Un 0 explícito es un error de quien lo escribió, y hay que decírselo.
  // Convertirlo en null en silencio abriría a todo el mundo un evento que
  // alguien quiso cerrar.
  const cero = validarEvento({ titulo: 'Charla', ciudad: 'Antofagasta', inicia_at: '2026-10-01T14:00:00Z', cupo: 0 });
  assert.equal(cero.ok, false);
  assert.match(cero.error, /mayor que 0/);

  // Vacío y ausente sí son «sin tope».
  for (const cupo of ['', null, undefined]) {
    const v = validarEvento({ titulo: 'Charla', ciudad: 'Antofagasta', inicia_at: '2026-10-01T14:00:00Z', cupo });
    assert.equal(v.ok, true);
    assert.equal(v.datos.cupo, null);
  }
});

test('validarEvento no deja que una actividad termine antes de empezar', () => {
  const v = validarEvento({
    titulo: 'Charla', ciudad: 'Antofagasta',
    inicia_at: '2026-10-01T18:00:00Z', termina_at: '2026-10-01T09:00:00Z',
  });
  assert.equal(v.ok, false);
  assert.match(v.error, /antes de empezar/);
});

test('validarReserva normaliza el correo y exige nombre', () => {
  assert.equal(validarReserva({ nombre: 'A', email: 'a@b.cl' }).ok, false);
  assert.equal(validarReserva({ nombre: 'Ana Soto', email: 'no-es-correo' }).ok, false);

  const v = validarReserva({ nombre: '  Ana Soto ', email: '  ANA@Empresa.CL ', empresa: '  ' });
  assert.equal(v.ok, true);
  assert.equal(v.datos.email, 'ana@empresa.cl');
  assert.equal(v.datos.nombre, 'Ana Soto');
  // Un campo opcional en blanco es null, no la cadena vacía: así la base
  // guarda «no lo dijo» en vez de «dijo nada».
  assert.equal(v.datos.empresa, null);
});

test('eventoPublico es lista BLANCA: lo interno no se filtra solo', () => {
  // Se arma nombrando lo que se muestra. Si se armara borrando campos,
  // el día que la consulta traiga una columna nueva esa columna saldría
  // publicada sin que nadie lo decidiera.
  const salida = eventoPublico(
    { ...futuro({ cupo: 4 }), created_at: 'x', updated_at: 'y', publicado: true, notas_internas: 'no mostrar' },
    reservas(1)
  );
  assert.equal(salida.notas_internas, undefined);
  assert.equal(salida.created_at, undefined);
  assert.equal(salida.publicado, undefined);
  assert.equal(salida.cupos_disponibles, 3);
});
