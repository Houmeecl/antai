import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// ============================================================
// El migrador lleva registro, y este archivo impide que lo pierda.
//
// Lee el código fuente: no levanta base, así que corre igual en el
// servidor con NODE_ENV=production.
// ============================================================

const SRC = readFileSync(new URL('../src/lib/migrate.js', import.meta.url), 'utf8');

test('anota lo aplicado y no lo repite', () => {
  assert.match(SRC, /CREATE TABLE IF NOT EXISTS \$\{TABLA\}/, 'no crea la tabla de registro');
  assert.match(SRC, /SELECT archivo, sha256 FROM/, 'no lee lo ya aplicado antes de correr');
  assert.match(SRC, /INSERT INTO \$\{TABLA\}/, 'no anota lo que aplica');

  // Sin este `continue`, leer el registro no sirve de nada.
  const bloque = SRC.slice(SRC.indexOf('if (previo) {'), SRC.indexOf("await cliente.query('BEGIN')"));
  assert.match(bloque, /continue;/, 'lee el registro pero igual re-ejecuta');
});

test('cada migración va en su transacción CON su registro', () => {
  // Anotar fuera de la transacción dejaría migraciones «aplicadas» que en
  // realidad reventaron a la mitad, y esas no se reintentan nunca más.
  const desdeBegin = SRC.slice(SRC.indexOf("await cliente.query('BEGIN')"));
  const hastaCommit = desdeBegin.slice(0, desdeBegin.indexOf('COMMIT'));
  assert.match(hastaCommit, /INSERT INTO \$\{TABLA\}/, 'el registro se anota fuera de la transacción');
  assert.match(SRC, /ROLLBACK/, 'no revierte si la migración falla');
});

test('reescribir una migración aplicada se AVISA', () => {
  assert.match(SRC, /sha256/, 'no guarda el hash de lo aplicado');
  assert.match(SRC, /previo !== hash/, 'no compara el hash guardado con el del archivo');
  assert.match(SRC, /AVISO/, 'detecta el cambio y se lo calla');
});

test('las migraciones están numeradas', () => {
  // El orden alfabético ES el orden de ejecución. Un archivo sin prefijo
  // numérico se cuela en cualquier lado.
  const dir = new URL('../migrations/', import.meta.url).pathname;
  const sueltos = readdirSync(dir).filter((f) => f.endsWith('.sql') && !/^\d{3}_/.test(f));
  assert.deepEqual(sueltos, [], `migraciones sin prefijo NNN_: ${sueltos.join(', ')}`);
});

test('el esquema no confunde «sin tope» con «cero»', () => {
  // Es la regla que sostiene la agenda entera, y vive en dos lugares: el
  // CHECK del esquema y cuposDisponibles(). Si el CHECK desaparece, un
  // cupo 0 entra a la base y cierra un evento sin que nadie lo decida.
  const sql = readFileSync(new URL('../migrations/002_agenda.sql', import.meta.url), 'utf8');
  assert.match(sql, /cupo\s+INT\s+CHECK \(cupo IS NULL OR cupo > 0\)/,
    'el CHECK que impide el cupo 0 se perdió');

  // Y el índice único de reservas tiene que ser PARCIAL: si fuera total,
  // cancelar dejaría a la persona sin poder volver a inscribirse jamás.
  assert.match(sql, /reservas_una_por_evento_uq[\s\S]{0,160}WHERE estado <> 'cancelada'/,
    'el único de reservas dejó de ser parcial: cancelar bloquearía para siempre');
});
