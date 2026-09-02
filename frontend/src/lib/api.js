// Cliente de la API. Una sola función para que el manejo de errores y el
// token vivan en un lugar.
//
// El token del panel va en sessionStorage y no en localStorage: se borra
// al cerrar la pestaña. En un computador compartido —que en faena es la
// regla, no la excepción— esa diferencia importa.
const LLAVE = 'antai.token';

export const guardarToken = (t) => sessionStorage.setItem(LLAVE, t);
export const leerToken = () => sessionStorage.getItem(LLAVE);
export const borrarToken = () => sessionStorage.removeItem(LLAVE);

export async function api(ruta, { metodo = 'GET', cuerpo, conToken = false } = {}) {
  const cabeceras = {};
  if (cuerpo) cabeceras['Content-Type'] = 'application/json';
  if (conToken) {
    const t = leerToken();
    if (t) cabeceras.Authorization = `Bearer ${t}`;
  }

  let res;
  try {
    res = await fetch(`/api${ruta}`, {
      method: metodo, headers: cabeceras,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    // Distinguir "no se pudo preguntar" de "la respuesta vino vacía" es
    // la diferencia entre decir «no hay fechas» y decir «no pudimos
    // cargar la agenda». Lo primero sería mentir.
    throw new Error('No pudimos conectar. Revisa tu conexión y vuelve a intentar.');
  }

  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || 'Algo falló.');
  return datos;
}
