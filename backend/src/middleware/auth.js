import jwt from 'jsonwebtoken';
import { config } from '../lib/config.js';

// Token de sesión del panel. Dura 12 horas: una jornada, no un mes.
export function firmarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, email: usuario.email, nombre: usuario.nombre },
    config.jwtSecret,
    { expiresIn: '12h' }
  );
}

// Toda ruta de /api/admin pasa por acá.
//
// La respuesta es la MISMA para un token ausente, vencido o falsificado.
// Distinguirlos le diría a quien prueba tokens cuál de sus intentos estuvo
// más cerca, que es información que no le corresponde.
export function requiereAdmin(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sesión no válida.' });

  try {
    req.usuario = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión no válida.' });
  }
}
