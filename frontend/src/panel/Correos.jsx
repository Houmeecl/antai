import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const cuando = (d) => new Date(d).toLocaleString('es-CL', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

const PASTILLA = { enviado: 'pastilla-abierta', consola: 'pastilla-gris', error: 'pastilla-llena' };
const NOMBRE = { enviado: 'Enviado', consola: 'Solo consola', error: 'Falló' };

function Plantillas() {
  const [ps, setPs] = useState(null);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState(null);

  const cargar = () => api('/admin/plantillas', { conToken: true })
    .then((d) => setPs(d.plantillas)).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function guardar(e) {
    e.preventDefault();
    try {
      await api(`/admin/plantillas/${editando.slug}`, {
        metodo: 'PUT', conToken: true,
        cuerpo: { asunto: editando.asunto, cuerpo: editando.cuerpo },
      });
      setEditando(null);
      cargar();
    } catch (err) { setError(err.message); }
  }

  if (error) return <div className="aviso aviso-mal">{error}</div>;
  if (!ps) return <p className="tenue">Cargando plantillas…</p>;

  return (
    <>
      {editando && (
        <form onSubmit={guardar} className="tarjeta" style={{ marginBottom: 22 }}>
          <h3>{editando.nombre}</h3>
          <label className="campo"><span>Asunto</span>
            <input value={editando.asunto} onChange={(e) => setEditando({ ...editando, asunto: e.target.value })} /></label>
          <label className="campo"><span>Cuerpo</span>
            <textarea style={{ minHeight: 220, fontFamily: 'ui-monospace, monospace', fontSize: 13.5 }}
              value={editando.cuerpo} onChange={(e) => setEditando({ ...editando, cuerpo: e.target.value })} /></label>
          <p className="tenue">
            Marcas disponibles: {editando.variables.map((v) => `{{${v}}}`).join(' · ')}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="boton boton-primario">Guardar</button>
            <button type="button" className="boton boton-tierra" onClick={() => setEditando(null)}>Cancelar</button>
          </div>
        </form>
      )}
      <div className="rejilla">
        {ps.map((p) => (
          <div className="tarjeta" key={p.slug}>
            <h3>{p.nombre}</h3>
            <p style={{ fontSize: 14 }}>{p.asunto}</p>
            <button className="boton boton-tierra boton-chico" style={{ marginTop: 12 }}
              onClick={() => setEditando(p)}>Editar</button>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Correos() {
  const [correos, setCorreos] = useState(null);
  const [error, setError] = useState(null);
  const [pestana, setPestana] = useState('bitacora');

  useEffect(() => {
    api('/admin/correos', { conToken: true })
      .then((d) => setCorreos(d.correos)).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, marginRight: 'auto' }}>Correo</h2>
        <button className={`boton boton-chico ${pestana === 'bitacora' ? 'boton-primario' : 'boton-tierra'}`}
          onClick={() => setPestana('bitacora')}>Bitácora</button>
        <button className={`boton boton-chico ${pestana === 'plantillas' ? 'boton-primario' : 'boton-tierra'}`}
          onClick={() => setPestana('plantillas')}>Plantillas</button>
      </div>

      {pestana === 'plantillas' ? <Plantillas /> : (
        <>
          {error && <div className="aviso aviso-mal">{error}</div>}
          {!correos && !error && <p className="tenue">Cargando…</p>}
          {correos && correos.length === 0 && (
            <div className="aviso aviso-gris">Todavía no se ha enviado ningún correo.</div>
          )}
          {correos && correos.length > 0 && (
            <div className="tabla-scroll">
              <table>
                <thead><tr><th>Cuándo</th><th>Para</th><th>Asunto</th><th>Estado</th></tr></thead>
                <tbody>
                  {correos.map((c) => (
                    <tr key={c.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{cuando(c.created_at)}</td>
                      <td>{c.contacto_nombre || c.para}</td>
                      <td>{c.asunto}</td>
                      <td>
                        <span className={`pastilla ${PASTILLA[c.estado]}`}>{NOMBRE[c.estado]}</span>
                        {c.error && <div className="tenue" style={{ marginTop: 4 }}>{c.error}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="tenue" style={{ marginTop: 16 }}>
            «Solo consola» no es un error: es el modo sin SMTP configurado, donde el correo se
            imprime en el servidor en vez de enviarse.
          </p>
        </>
      )}
    </>
  );
}
