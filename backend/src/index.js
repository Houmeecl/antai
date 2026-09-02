import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config, esProduccion } from './lib/config.js';
import { migrar } from './lib/migrate.js';
import { modoCorreo } from './services/mailer.js';
import publico from './routes/publico.js';
import admin from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '100kb' }));
app.disable('x-powered-by');

app.get('/api/salud', (req, res) => res.json({ ok: true, correo: modoCorreo() }));
app.use('/api', publico);
app.use('/api/admin', admin);

// El build del frontend, si está. En desarrollo lo sirve Vite.
const dist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  // Cualquier ruta que no sea /api la resuelve el router del navegador.
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Manejador final. El detalle del error va al log del servidor; al
// navegador va una frase. Un stack trace en la respuesta le cuenta a
// cualquiera qué versión de qué biblioteca hay corriendo.
app.use((err, req, res, _next) => {
  console.error(`[error] ${req.method} ${req.path}: ${err.message}`);
  res.status(500).json({ error: 'Algo falló de este lado. Ya quedó registrado.' });
});

export async function arrancar(puerto = config.puerto) {
  await migrar();
  return new Promise((listo) => {
    const servidor = app.listen(puerto, () => {
      console.log(`[antai] escuchando en :${servidor.address().port} · correo por ${modoCorreo()}`);
      if (!esProduccion) console.log('[antai] modo desarrollo');
      listo(servidor);
    });
  });
}

// Solo arranca solo cuando se ejecuta el archivo. Importarlo desde un
// test NO debe levantar un servidor ni ocupar el puerto de producción.
if (import.meta.url === `file://${process.argv[1]}`) {
  arrancar().catch((err) => {
    console.error(`[antai] no arrancó: ${err.message}`);
    process.exit(1);
  });
}

export { app };
