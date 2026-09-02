import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirMigraciones = path.resolve(__dirname, '../../migrations');

// ============================================================
// Migrador con registro — desde el primer día, y por una razón concreta.
//
// El proyecto hermano (sicr3p) nació sin registro: cada .sql corría en
// CADA arranque. Eso obliga a que todas las migraciones sean para siempre
// idempotentes, y basta que una no lo sea para que el daño aparezca meses
// después y en el peor momento. Allá pasó exactamente eso: tres
// migraciones re-imponían un CHECK con una lista congelada en su época, y
// marcar una casilla en el panel dejaba el servidor sin arrancar en el
// siguiente despliegue.
//
// Acá el registro existe antes que la primera migración, así que la regla
// «una migración aplicada no se reescribe: se hace una nueva» es cierta
// desde el commit inicial en vez de ser un pedido de buena voluntad.
//
// EL SHA256 NO ES DECORACIÓN. Se guarda el hash de lo aplicado: si alguien
// edita una migración ya ejecutada, el arranque lo DICE. No se re-ejecuta
// —eso es justo lo que el registro evita— pero deja de ser un cambio
// invisible entre lo que dice el repo y lo que hay en la base.
// ============================================================

const TABLA = 'migraciones_aplicadas';

const sha = (texto) => crypto.createHash('sha256').update(texto, 'utf8').digest('hex');

async function asegurarRegistro(cliente) {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS ${TABLA} (
      archivo     TEXT PRIMARY KEY,
      sha256      TEXT NOT NULL,
      aplicada_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
}

// Aplica los .sql en orden alfabético —el orden del nombre ES el orden de
// ejecución— una sola vez cada uno.
//
// Cada archivo va en su propia transacción JUNTO CON su fila de registro.
// Anotar por fuera dejaría migraciones «aplicadas» que en realidad
// reventaron a la mitad, y esas no se reintentan nunca más.
export async function migrar({ silencioso = false } = {}) {
  const log = silencioso ? () => {} : console.log;
  const resumen = { aplicadas: 0, omitidas: 0, alteradas: [] };
  if (!fs.existsSync(dirMigraciones)) return resumen;

  const cliente = await pool.connect();
  try {
    await asegurarRegistro(cliente);
    const { rows } = await cliente.query(`SELECT archivo, sha256 FROM ${TABLA}`);
    const yaAplicadas = new Map(rows.map((r) => [r.archivo, r.sha256]));

    const archivos = fs.readdirSync(dirMigraciones).filter((f) => f.endsWith('.sql')).sort();
    for (const archivo of archivos) {
      const sql = fs.readFileSync(path.join(dirMigraciones, archivo), 'utf8');
      const hash = sha(sql);
      const previo = yaAplicadas.get(archivo);

      if (previo) {
        resumen.omitidas += 1;
        if (previo !== hash) {
          resumen.alteradas.push(archivo);
          console.warn(
            `[migrate] AVISO: ${archivo} cambió después de aplicarse. No se re-ejecuta. `
            + 'Si el cambio tiene que llegar a la base, va en una migración NUEVA.'
          );
        }
        continue;
      }

      await cliente.query('BEGIN');
      try {
        await cliente.query(sql);
        await cliente.query(`INSERT INTO ${TABLA} (archivo, sha256) VALUES ($1, $2)`, [archivo, hash]);
        await cliente.query('COMMIT');
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw new Error(`migración ${archivo}: ${err.message}`);
      }
      resumen.aplicadas += 1;
      log(`[migrate] aplicada ${archivo}`);
    }
  } finally {
    cliente.release();
  }

  if (resumen.omitidas) log(`[migrate] ${resumen.omitidas} ya estaban aplicadas`);
  return resumen;
}

// Ejecutable directo: npm run migrate
if (import.meta.url === `file://${process.argv[1]}`) {
  migrar()
    .then(() => { console.log('[migrate] listo'); return pool.end(); })
    .catch((err) => { console.error(`[migrate] ${err.message}`); process.exit(1); });
}
