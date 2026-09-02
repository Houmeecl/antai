import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './paginas/Landing.jsx';
import Cancelar from './paginas/Cancelar.jsx';
import AdminLogin from './paginas/AdminLogin.jsx';
import AdminAgenda from './paginas/AdminAgenda.jsx';
import { leerToken } from './lib/api.js';

function Protegida({ children }) {
  return leerToken() ? children : <Navigate to="/panel" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/cancelar/:token" element={<Cancelar />} />
      <Route path="/panel" element={<AdminLogin />} />
      <Route path="/panel/agenda" element={<Protegida><AdminAgenda /></Protegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
