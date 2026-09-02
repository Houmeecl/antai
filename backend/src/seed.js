import bcrypt from 'bcryptjs';
import { pool, query } from './lib/db.js';
import { migrar } from './lib/migrate.js';

// ============================================================
// Primer administrador.
//
// La clave sale del entorno, NUNCA del código. Y como una clave que
// estuvo escrita en un archivo ya dejó de ser secreta, el usuario nace
// con `debe_cambiar = true`: la cambia en el primer ingreso o no hace
// nada más.
//
// Idempotente: si la cuenta ya existe, no la pisa. Correr el seed dos
// veces no puede reponer una clave que alguien ya cambió.
// ============================================================

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const clave = process.env.ADMIN_PASSWORD || '';
const nombre = process.env.ADMIN_NOMBRE || 'Administración';

if (!email || clave.length < 12) {
  console.error('[seed] falta ADMIN_EMAIL, o ADMIN_PASSWORD tiene menos de 12 caracteres.');
  process.exit(1);
}

await migrar({ silencioso: true });

const { rows } = await query('SELECT id FROM usuarios WHERE lower(email) = $1', [email]);
if (rows[0]) {
  console.log('[seed] esa cuenta ya existe. No se toca.');
} else {
  await query(
    'INSERT INTO usuarios (email, nombre, clave_hash, debe_cambiar) VALUES ($1, $2, $3, true)',
    [email, nombre, await bcrypt.hash(clave, 12)]
  );
  console.log(`[seed] administrador creado: ${email}`);
  console.log('[seed] tiene que cambiar la clave al entrar. Borra ADMIN_PASSWORD del .env ahora.');
}

await pool.end();
