import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { app } from '../src/index.js';
import { migrar } from '../src/lib/migrate.js';
import { pool, query } from '../src/lib/db.js';

// ============================================================
// Rutas, contra la base de verdad.
//
// LO QUE ESTE ARCHIVO EXISTE PARA PROBAR es la carrera del último cupo.
// Dos personas apretando «Tomar mi cupo» en el mismo segundo leen las dos
// «queda 1» y las dos insertan — a menos que la fila del evento esté
// bloqueada. Es un bug que no aparece nunca en desarrollo y aparece
// justo el día que la charla se llena, así que se prueba a propósito.
// ============================================================

const MARCA = `test-${Date.now()}`;
let servidor; let base; let token;

const pedir = async (metodo, ruta, { cuerpo, tk } = {}) => {
  const res = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(tk ? { Authorization: `Bearer ${tk}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { estado: res.status, d: await res.json().catch(() => ({})) };
};

const enUnaHora = () => new Date(Date.now() + 3600e3).toISOString();

before(async () => {
  await migrar({ silencioso: true });
  await query(
    'INSERT INTO usuarios (email, nombre, clave_hash) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [`${MARCA}@antai.cl`, 'Test', await bcrypt.hash('clave-de-prueba-larga', 10)]
  );
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const login = await pedir('POST', '/api/admin/login',
    { cuerpo: { email: `${MARCA}@antai.cl`, clave: 'clave-de-prueba-larga' } });
  assert.equal(login.estado, 200, 'el login de prueba falló');
  token = login.d.token;
});

after(async () => {
  // La limpieza NO se traga los errores. Un DELETE que falla en silencio
  // acumula basura que después hace fallar tests distintos en cada
  // corrida, y eso es peor que una suite roja: es una suite a la que
  // nadie le cree.
  try {
    await query('DELETE FROM eventos WHERE titulo LIKE $1', [`${MARCA}%`]);
    await query('DELETE FROM usuarios WHERE email LIKE $1', [`${MARCA}%`]);
  } catch (e) {
    console.error(`[limpieza] quedó basura en la base: ${e.message}`);
  }
  await new Promise((r) => servidor.close(r));
  await pool.end();
});

const crearEvento = async (extra = {}) => {
  const r = await pedir('POST', '/api/admin/eventos', {
    tk: token,
    cuerpo: {
      titulo: `${MARCA} charla`, ciudad: 'Antofagasta',
      inicia_at: enUnaHora(), publicado: true, ...extra,
    },
  });
  assert.equal(r.estado, 201, JSON.stringify(r.d));
  return r.d.evento;
};

test('sin sesión, el panel no se abre', async () => {
  const r = await pedir('GET', '/api/admin/eventos');
  assert.equal(r.estado, 401);
});

test('el login no delata qué correos existen', async () => {
  const inexistente = await pedir('POST', '/api/admin/login',
    { cuerpo: { email: 'nadie@ninguna-parte.cl', clave: 'lo-que-sea-largo' } });
  const claveMala = await pedir('POST', '/api/admin/login',
    { cuerpo: { email: `${MARCA}@antai.cl`, clave: 'esta-no-es' } });
  assert.equal(inexistente.estado, claveMala.estado);
  assert.equal(inexistente.d.error, claveMala.d.error);
});

test('el flujo completo: reservar, llenarse, cancelar y recuperar el cupo', async () => {
  const evento = await crearEvento({ cupo: 2 });

  const uno = await pedir('POST', `/api/eventos/${evento.id}/reservar`,
    { cuerpo: { nombre: 'Ana Soto', email: 'ana@ejemplo.cl' } });
  assert.equal(uno.estado, 201, JSON.stringify(uno.d));

  // El token de cancelación y el correo NO vuelven en la respuesta: van
  // por correo y solo por correo.
  assert.equal(uno.d.reserva.token, undefined);
  assert.equal(uno.d.reserva.email, undefined);

  const dos = await pedir('POST', `/api/eventos/${evento.id}/reservar`,
    { cuerpo: { nombre: 'Luis Rojas', email: 'luis@ejemplo.cl' } });
  assert.equal(dos.estado, 201);

  // Tercero: no queda lugar.
  const tres = await pedir('POST', `/api/eventos/${evento.id}/reservar`,
    { cuerpo: { nombre: 'Sofía Díaz', email: 'sofia@ejemplo.cl' } });
  assert.equal(tres.estado, 409);
  assert.match(tres.d.error, /cupos/i);

  // La portada lo refleja.
  const lista = await pedir('GET', '/api/eventos');
  const enPortada = lista.d.eventos.find((e) => e.id === evento.id);
  assert.equal(enPortada.cupos_disponibles, 0);
  assert.equal(enPortada.texto_cupo, 'Sin cupos');

  // Ana suelta el cupo y vuelve a haber uno.
  const { rows } = await query("SELECT token FROM reservas WHERE email = 'ana@ejemplo.cl' AND evento_id = $1", [evento.id]);
  const cancelar = await pedir('POST', `/api/reservas/${rows[0].token}/cancelar`);
  assert.equal(cancelar.estado, 200);
  assert.equal(cancelar.d.liberado, true);

  const cuatro = await pedir('POST', `/api/eventos/${evento.id}/reservar`,
    { cuerpo: { nombre: 'Sofía Díaz', email: 'sofia@ejemplo.cl' } });
  assert.equal(cuatro.estado, 201, 'cancelar no devolvió el cupo');

  // Y Ana puede volver a inscribirse: el índice único es PARCIAL, así que
  // haberse arrepentido una vez no la deja afuera para siempre.
  await pedir('POST', `/api/eventos/${evento.id}/reservar`,
    { cuerpo: { nombre: 'X', email: 'ana@ejemplo.cl' } });
});

test('el mismo correo no toma dos veces la misma fecha', async () => {
  const evento = await crearEvento({ cupo: 10 });
  const a = await pedir('POST', `/api/eventos/${evento.id}/reservar`,
    { cuerpo: { nombre: 'Ana Soto', email: 'repetida@ejemplo.cl' } });
  assert.equal(a.estado, 201);
  const b = await pedir('POST', `/api/eventos/${evento.id}/reservar`,
    { cuerpo: { nombre: 'Ana Soto', email: 'REPETIDA@ejemplo.cl' } });
  assert.equal(b.estado, 409);
  assert.match(b.d.error, /ya tiene un cupo/i);
});

test('un evento sin publicar responde 404, no «todavía no»', async () => {
  const evento = await crearEvento({ publicado: false });

  const enPortada = (await pedir('GET', '/api/eventos')).d.eventos.some((e) => e.id === evento.id);
  assert.equal(enPortada, false);

  const intento = await pedir('POST', `/api/eventos/${evento.id}/reservar`,
    { cuerpo: { nombre: 'Ana Soto', email: 'ana@ejemplo.cl' } });
  const inventado = await pedir('POST', '/api/eventos/00000000-0000-4000-8000-000000000000/reservar',
    { cuerpo: { nombre: 'Ana Soto', email: 'ana@ejemplo.cl' } });

  assert.equal(intento.estado, 404);
  assert.equal(intento.d.error, inventado.d.error);
});

test('el candado del último cupo: la segunda transacción ESPERA', async () => {
  // ------------------------------------------------------------
  // ESTE TEST EXISTE PORQUE EL OTRO NO SERVÍA. Primero se escribió
  // lanzando diez POST a la vez contra un evento de un cupo, y pasaba
  // igual con y sin el `FOR UPDATE` — se comprobó quitándolo. Diez
  // `fetch` desde el mismo proceso no se pisan de verdad: la ventana
  // existe pero es demasiado corta para caer en ella a propósito. Un
  // test que pasa con el bug adentro es peor que no tenerlo, porque da
  // por cubierto lo que no cubre.
  //
  // Así que se prueba el mecanismo directamente y de forma
  // determinista: dos transacciones reales, en el orden exacto que
  // produce el sobrecupo.
  // ------------------------------------------------------------
  const evento = await crearEvento({ cupo: 1 });

  const a = await pool.connect();
  const b = await pool.connect();
  try {
    await a.query('BEGIN');
    await a.query('SELECT * FROM eventos WHERE id = $1 FOR UPDATE', [evento.id]);

    // B pide el mismo candado. Tiene que quedarse esperando a que A
    // termine: si no espera, los dos cuentan cero reservas y los dos
    // insertan.
    let bPaso = false;
    const esperaB = (async () => {
      await b.query('BEGIN');
      await b.query('SELECT * FROM eventos WHERE id = $1 FOR UPDATE', [evento.id]);
      bPaso = true;
    })();

    await new Promise((r) => setTimeout(r, 300));
    assert.equal(bPaso, false, 'B NO se quedó esperando: el candado no está tomando efecto');

    // A cuenta (0), inserta y confirma.
    const antes = await a.query(
      "SELECT COUNT(*)::int AS n FROM reservas WHERE evento_id = $1 AND estado <> 'cancelada'", [evento.id]
    );
    assert.equal(antes.rows[0].n, 0);
    await a.query(
      'INSERT INTO reservas (evento_id, nombre, email, token) VALUES ($1, $2, $3, $4)',
      [evento.id, 'Primera', 'primera@ejemplo.cl', `tok-${Date.now()}`]
    );
    await a.query('COMMIT');

    // Recién ahora B avanza — y cuenta DESPUÉS de A, que es todo el
    // punto: ve 1 de 1 y se va con las manos vacías.
    await esperaB;
    assert.equal(bPaso, true, 'B nunca despertó');
    const despues = await b.query(
      "SELECT COUNT(*)::int AS n FROM reservas WHERE evento_id = $1 AND estado <> 'cancelada'", [evento.id]
    );
    assert.equal(despues.rows[0].n, 1, 'B contó antes de que A confirmara: habría sobrecupo');
    await b.query('ROLLBACK');
  } finally {
    await a.query('ROLLBACK').catch(() => {});
    await b.query('ROLLBACK').catch(() => {});
    a.release();
    b.release();
  }
});

test('la ruta de reserva NO puede perder su FOR UPDATE', async () => {
  // El test de arriba prueba que el candado funciona; este prueba que la
  // ruta lo pide. Sin los dos, alguien puede borrar tres palabras del
  // SELECT y la suite sigue verde.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/routes/publico.js', import.meta.url), 'utf8');
  const bloque = src.slice(src.indexOf('reservar'), src.indexOf('INSERT INTO reservas'));
  assert.match(bloque, /SELECT \* FROM eventos WHERE id = \$1 FOR UPDATE/,
    'la reserva dejó de bloquear la fila del evento: vuelve el sobrecupo');
});

test('diez reservas simultáneas no dejan sobrecupo', async () => {
  // No reproduce la carrera —ver el test del candado— pero sí comprueba
  // que la ruta aguanta concurrencia real sin romperse ni pasarse.
  const evento = await crearEvento({ cupo: 3 });
  const intentos = await Promise.all(
    Array.from({ length: 10 }, (_, i) => pedir('POST', `/api/eventos/${evento.id}/reservar`, {
      cuerpo: { nombre: `Persona ${i}`, email: `simultanea-${i}@ejemplo.cl` },
    }))
  );
  const entraron = intentos.filter((r) => r.estado === 201).length;
  assert.equal(entraron, 3, `entraron ${entraron} en un evento de 3 cupos`);

  const { rows } = await query(
    "SELECT COUNT(*)::int AS n FROM reservas WHERE evento_id = $1 AND estado <> 'cancelada'", [evento.id]
  );
  assert.equal(rows[0].n, 3, 'la base quedó con sobrecupo');
});

test('no se puede bajar el cupo por debajo de quienes ya se inscribieron', async () => {
  const evento = await crearEvento({ cupo: 5 });
  for (const n of [1, 2, 3]) {
    await pedir('POST', `/api/eventos/${evento.id}/reservar`,
      { cuerpo: { nombre: `P${n}`, email: `baja-${n}@ejemplo.cl` } });
  }
  const r = await pedir('PUT', `/api/admin/eventos/${evento.id}`, {
    tk: token,
    cuerpo: { titulo: `${MARCA} charla`, ciudad: 'Antofagasta', inicia_at: enUnaHora(), cupo: 2, publicado: true },
  });
  assert.equal(r.estado, 409);
  assert.match(r.d.error, /3 personas/);
});

test('borrar una fecha con gente adentro se rechaza', async () => {
  const evento = await crearEvento({ cupo: 5 });
  await pedir('POST', `/api/eventos/${evento.id}/reservar`,
    { cuerpo: { nombre: 'Ana', email: 'nodejar@ejemplo.cl' } });

  const r = await pedir('DELETE', `/api/admin/eventos/${evento.id}`, { tk: token });
  assert.equal(r.estado, 409);
  assert.match(r.d.error, /Despublica/);

  // Uno vacío sí se borra.
  const vacio = await crearEvento();
  assert.equal((await pedir('DELETE', `/api/admin/eventos/${vacio.id}`, { tk: token })).estado, 200);
});

test('el CSV de asistencia neutraliza las fórmulas', async () => {
  // Un nombre que empieza con "=" se ejecuta como fórmula al abrir el
  // archivo en una planilla. Se le antepone un apóstrofo.
  const evento = await crearEvento({ cupo: 5 });
  await pedir('POST', `/api/eventos/${evento.id}/reservar`,
    { cuerpo: { nombre: '=1+1', email: 'formula@ejemplo.cl' } });

  const res = await fetch(`${base}/api/admin/eventos/${evento.id}/reservas?formato=csv`,
    { headers: { Authorization: `Bearer ${token}` } });
  const csv = await res.text();
  assert.match(csv, /"'=1\+1"/, 'el CSV dejó pasar una fórmula');
});
