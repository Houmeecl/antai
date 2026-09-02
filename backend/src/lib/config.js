// Configuración: todo lo que cambia entre mi máquina y el servidor.
//
// La regla es una sola: en producción, lo que falta MATA EL ARRANQUE.
// Un backend que se levanta con la firma de tokens vacía es peor que uno
// que no se levanta — el segundo se nota, el primero emite sesiones que
// cualquiera puede falsificar.
export const esProduccion = process.env.NODE_ENV === 'production';

function exigido(nombre) {
  const v = process.env[nombre];
  if (v) return v;
  if (esProduccion) {
    console.error(`[config] falta ${nombre}. En producción no se arranca sin eso.`);
    process.exit(1);
  }
  return null;
}

export const config = {
  puerto: Number(process.env.PORT || 3001),
  databaseUrl: exigido('DATABASE_URL') || 'postgresql://postgres@localhost:5432/antai',

  // En desarrollo se genera una firma efímera: sirve para trabajar y se
  // invalida sola al reiniciar, que es exactamente lo que uno quiere de
  // una sesión de desarrollo.
  jwtSecret: exigido('JWT_SECRET')
    || `dev-${Math.random().toString(36).slice(2)}${Date.now()}`,

  urlPublica: process.env.URL_PUBLICA || 'http://localhost:5173',

  smtp: {
    host: process.env.SMTP_HOST || null,
    puerto: Number(process.env.SMTP_PORT || 587),
    usuario: process.env.SMTP_USER || null,
    clave: process.env.SMTP_PASS || null,
    desde: process.env.CORREO_DESDE || 'Antai Mineral Mark <hola@antai.cl>',
  },
};
