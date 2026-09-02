import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './paginas/Landing.jsx';
import Cancelar from './paginas/Cancelar.jsx';
import Cotizacion from './paginas/Cotizacion.jsx';
import AdminLogin from './paginas/AdminLogin.jsx';
import Panel from './paginas/Panel.jsx';
import { leerToken } from './lib/api.js';

function Protegida({ children }) {
  return leerToken() ? children : <Navigate to="/entrar" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/cancelar/:token" element={<Cancelar />} />
      <Route path="/cotizacion/:token" element={<Cotizacion />} />
      <Route path="/entrar" element={<AdminLogin />} />
      <Route path="/panel/*" element={<Protegida><Panel /></Protegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
