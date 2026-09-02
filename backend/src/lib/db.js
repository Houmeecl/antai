import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

// Un pool que se cae no puede tumbar el proceso entero: se avisa y el
// siguiente query reintenta con una conexión nueva.
pool.on('error', (err) => {
  console.error(`[db] conexión inactiva cayó: ${err.message}`);
});

export function query(texto, params) {
  return pool.query(texto, params);
}

// Transacción con rollback garantizado. El `catch` re-lanza DESPUÉS de
// revertir: tragarse el error acá dejaría al llamador creyendo que su
// escritura entró.
export async function withTx(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const r = await fn(cliente);
    await cliente.query('COMMIT');
    return r;
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
}
