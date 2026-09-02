import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoAntai from '../componentes/LogoAntai.jsx';
import { api, guardarToken } from '../lib/api.js';

export default function AdminLogin() {
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState(null);
  const [yendo, setYendo] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setYendo(true);
    setError(null);
    try {
      const r = await api('/admin/login', { metodo: 'POST', cuerpo: { email, clave } });
      guardarToken(r.token);
      navegar('/panel/agenda');
    } catch (err) {
      setError(err.message);
    } finally {
      setYendo(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form onSubmit={entrar} className="tarjeta" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <LogoAntai variante="completo" alto={120} />
        </div>
        <h3 style={{ textAlign: 'center' }}>Panel</h3>
        {error && <div className="aviso aviso-mal">{error}</div>}
        <label className="campo">
          <span>Correo</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label className="campo">
          <span>Clave</span>
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} required autoComplete="current-password" />
        </label>
        <button className="boton boton-primario" style={{ width: '100%' }} disabled={yendo}>
          {yendo ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
