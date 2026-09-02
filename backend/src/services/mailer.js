import nodemailer from 'nodemailer';
import { config } from '../lib/config.js';

// ============================================================
// Correo.
//
// SIN SMTP_HOST NO FALLA: imprime por consola. En desarrollo uno quiere
// ver el correo, no configurar un servidor; y en los tests, un envío real
// sería spam a una casilla de verdad. El modo se dice en voz alta al
// arrancar para que nadie crea que mandó algo que no mandó.
//
// NUNCA SE ESCRIBE EL CORREO DE LA PERSONA EN EL LOG. Un log rotado, con
// copia de seguridad y leído por cualquiera que entre al servidor es
// exactamente el lugar donde no debe quedar una lista de direcciones. Se
// registra que se envió, no a quién.
// ============================================================

const activo = Boolean(config.smtp.host);

const transporte = activo
  ? nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.puerto,
    secure: config.smtp.puerto === 465,
    auth: config.smtp.usuario ? { user: config.smtp.usuario, pass: config.smtp.clave } : undefined,
  })
  : null;

export function modoCorreo() {
  return activo ? 'smtp' : 'consola';
}

// Devuelve { enviado, modo }. NO lanza: que el correo no salga no puede
// deshacer una reserva que ya está tomada. La persona tiene su lugar
// aunque el servidor de correo esté caído; se avisa el problema y sigue.
export async function enviar({ para, asunto, texto }) {
  if (!activo) {
    console.log(`[correo:consola] «${asunto}» — no se envió porque no hay SMTP configurado.`);
    console.log(texto.split('\n').map((l) => `  | ${l}`).join('\n'));
    return { enviado: false, modo: 'consola' };
  }
  try {
    await transporte.sendMail({ from: config.smtp.desde, to: para, subject: asunto, text: texto });
    return { enviado: true, modo: 'smtp' };
  } catch (err) {
    console.error(`[correo] no se pudo enviar «${asunto}»: ${err.message}`);
    return { enviado: false, modo: 'error', error: err.message };
  }
}

const fechaLarga = (iso) => new Date(iso).toLocaleString('es-CL', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago',
});

export function correoConfirmacion({ reserva, evento }) {
  const cancelar = `${config.urlPublica}/cancelar/${reserva.token}`;
  return {
    para: reserva.email,
    asunto: `Tu cupo está tomado — ${evento.titulo}`,
    texto: [
      `Hola ${reserva.nombre},`,
      '',
      `Tu cupo quedó tomado para «${evento.titulo}».`,
      '',
      `Cuándo:  ${fechaLarga(evento.inicia_at)}`,
      `Dónde:   ${[evento.lugar, evento.ciudad].filter(Boolean).join(', ')}`,
      `Formato: ${evento.modalidad}`,
      '',
      'Si no vas a poder ir, libera el cupo acá y se lo damos a otra persona:',
      cancelar,
      '',
      '— Antai Mineral Mark',
    ].join('\n'),
  };
}
