import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import LogoAntai from '../componentes/LogoAntai.jsx';
import { borrarToken } from '../lib/api.js';
import Tablero from '../panel/Tablero.jsx';
import Agenda from '../panel/Agenda.jsx';
import Crm from '../panel/Crm.jsx';
import Cotizaciones from '../panel/Cotizaciones.jsx';
import Correos from '../panel/Correos.jsx';

// Cada pestaña es una RUTA de verdad, no un estado local: así el botón
// «atrás» funciona, se puede compartir el enlace de una pestaña y recargar
// no devuelve al inicio.
const PESTANAS = [
  { a: '/panel/tablero', texto: 'Tablero' },
  { a: '/panel/contactos', texto: 'Contactos' },
  { a: '/panel/cotizaciones', texto: 'Cotizaciones' },
  { a: '/panel/agenda', texto: 'Agenda' },
  { a: '/panel/correos', texto: 'Correo' },
];

export default function Panel() {
  const navegar = useNavigate();

  return (
    <div className="panel">
      <div className="panel-barra">
        <div className="contenedor">
          <LogoAntai variante="horizontal" tono="claro" alto={28} />
          <button
            className="boton boton-chico"
            style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }}
            onClick={() => { borrarToken(); navegar('/entrar'); }}
          >Salir</button>
        </div>
      </div>

      <nav className="panel-pestanas">
        <div className="contenedor">
          {PESTANAS.map((p) => (
            <NavLink key={p.a} to={p.a} className={({ isActive }) => `panel-pestana ${isActive ? 'activa' : ''}`}>
              {p.texto}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="contenedor" style={{ paddingTop: 28, paddingBottom: 70 }}>
        <Routes>
          <Route index element={<Navigate to="/panel/tablero" replace />} />
          <Route path="tablero" element={<Tablero />} />
          <Route path="contactos" element={<Crm />} />
          <Route path="cotizaciones" element={<Cotizaciones />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="correos" element={<Correos />} />
          <Route path="*" element={<Navigate to="/panel/tablero" replace />} />
        </Routes>
      </div>
    </div>
  );
}
