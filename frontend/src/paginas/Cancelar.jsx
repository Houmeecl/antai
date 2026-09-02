import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import LogoAntai from '../componentes/LogoAntai.jsx';
import { api } from '../lib/api.js';

// Soltar el cupo desde el enlace del correo.
//
// La respuesta es la misma exista o no el token: si dijera «ese token no
// existe», cualquiera podría probar cadenas hasta dar con una reserva
// ajena y confirmar que es real.
export default function Cancelar() {
  const { token } = useParams();
  const [estado, setEstado] = useState('yendo');

  useEffect(() => {
    let vivo = true;
    api(`/reservas/${encodeURIComponent(token)}/cancelar`, { metodo: 'POST' })
      .then(() => { if (vivo) setEstado('listo'); })
      .catch(() => { if (vivo) setEstado('error'); });
    return () => { vivo = false; };
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="tarjeta" style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ marginBottom: 20 }}><LogoAntai variante="completo" alto={110} /></div>
        {estado === 'yendo' && <p className="tenue">Soltando el cupo…</p>}
        {estado === 'listo' && (
          <>
            <h3>Listo</h3>
            <p>Si tenías un cupo tomado, quedó libre para otra persona. Gracias por avisar.</p>
          </>
        )}
        {estado === 'error' && (
          <>
            <h3>No pudimos procesarlo</h3>
            <p>Vuelve a intentar en un momento, o escríbenos a <a href="mailto:hola@antai.cl">hola@antai.cl</a>.</p>
          </>
        )}
        <p style={{ marginTop: 22 }}><Link to="/">Volver a la portada</Link></p>
      </div>
    </div>
  );
}
