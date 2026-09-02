import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// ============================================================
// Panel: crear fechas, ver quién viene, marcar asistencia.
//
// El cupo se muestra SIEMPRE como «tomados / tope», y un evento sin tope
// dice «sin tope» en palabras. Un guion o un cero en esa celda haría que
// el equipo tuviera que acordarse de cuál es cuál.
// ============================================================

const VACIO = {
  titulo: '', descripcion: '', ciudad: '', lugar: '',
  modalidad: 'presencial', inicia_at: '', termina_at: '', cupo: '', publicado: false,
};

const fecha = (iso) => new Date(iso).toLocaleString('es-CL', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// `datetime-local` necesita 'YYYY-MM-DDTHH:mm' en hora local, no un ISO
// con zona. Sin esta conversión el campo se abre vacío al editar.
function paraCampo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Formulario({ inicial, alGuardar, alCancelar }) {
  const [f, setF] = useState(inicial);
  const [error, setError] = useState(null);
  const [yendo, setYendo] = useState(false);
  const set = (c) => (e) => setF({ ...f, [c]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function guardar(e) {
    e.preventDefault();
    setYendo(true); setError(null);
    try { await alGuardar(f); } catch (err) { setError(err.message); } finally { setYendo(false); }
  }

  return (
    <form onSubmit={guardar} className="tarjeta" style={{ marginBottom: 26 }}>
      <h3>{f.id ? 'Editar fecha' : 'Nueva fecha'}</h3>
      {error && <div className="aviso aviso-mal">{error}</div>}
      <label className="campo"><span>Título</span>
        <input value={f.titulo} onChange={set('titulo')} required placeholder="Fundamentos de CBAM para proveedores" /></label>
      <label className="campo"><span>Descripción</span>
        <textarea value={f.descripcion || ''} onChange={set('descripcion')} /></label>
      <div className="fila">
        <label className="campo"><span>Ciudad</span>
          <input value={f.ciudad} onChange={set('ciudad')} required placeholder="Antofagasta" /></label>
        <label className="campo"><span>Lugar</span>
          <input value={f.lugar || ''} onChange={set('lugar')} placeholder="Sala de la Cámara" /></label>
      </div>
      <div className="fila">
        <label className="campo"><span>Empieza</span>
          <input type="datetime-local" value={f.inicia_at} onChange={set('inicia_at')} required /></label>
        <label className="campo"><span>Termina <em className="tenue">(opcional)</em></span>
          <input type="datetime-local" value={f.termina_at || ''} onChange={set('termina_at')} /></label>
      </div>
      <div className="fila">
        <label className="campo"><span>Modalidad</span>
          <select value={f.modalidad} onChange={set('modalidad')}>
            <option value="presencial">Presencial</option>
            <option value="online">Online</option>
            <option value="mixta">Mixta</option>
          </select></label>
        <label className="campo"><span>Cupo <em className="tenue">(vacío = sin tope)</em></span>
          <input type="number" min="1" value={f.cupo ?? ''} onChange={set('cupo')} placeholder="sin tope" /></label>
      </div>
      <label style={{ display: 'flex', gap: 9, alignItems: 'center', margin: '6px 0 18px' }}>
        <input type="checkbox" checked={!!f.publicado} onChange={set('publicado')} style={{ width: 'auto' }} />
        <span style={{ fontSize: 14.5 }}>Publicada — se ve en la portada y se puede reservar</span>
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="boton boton-primario" disabled={yendo}>{yendo ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="boton boton-tierra" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function Reservas({ evento, alCerrar }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);

  const cargar = () => api(`/admin/eventos/${evento.id}/reservas`, { conToken: true })
    .then((d) => setFilas(d.reservas)).catch((e) => setError(e.message));

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [evento.id]);

  async function marcar(id, estado) {
    await api(`/admin/reservas/${id}`, { metodo: 'PUT', cuerpo: { estado }, conToken: true });
    cargar();
  }

  return (
    <div className="tarjeta" style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>Inscritos — {evento.titulo}</h3>
        <button className="boton boton-tierra boton-chico" onClick={alCerrar}>Cerrar</button>
      </div>
      {error && <div className="aviso aviso-mal">{error}</div>}
      {filas === null && !error && <p className="tenue">Cargando…</p>}
      {filas && filas.length === 0 && <p className="tenue">Nadie se ha inscrito todavía.</p>}
      {filas && filas.length > 0 && (
        <>
          <div className="tabla-scroll">
            <table>
              <thead><tr><th>Nombre</th><th>Correo</th><th>Empresa</th><th>Estado</th><th>Marcar</th></tr></thead>
              <tbody>
                {filas.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nombre}</td>
                    <td>{r.email}</td>
                    <td>{r.empresa || <span className="tenue">—</span>}</td>
                    <td>{r.estado.replace('_', ' ')}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="boton boton-tierra boton-chico" onClick={() => marcar(r.id, 'asistio')}>Vino</button>{' '}
                      <button className="boton boton-tierra boton-chico" onClick={() => marcar(r.id, 'no_asistio')}>No vino</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 14 }} className="tenue">
            La lista de asistencia para imprimir se descarga desde el endpoint CSV con tu sesión activa.
          </p>
        </>
      )}
    </div>
  );
}

export default function Agenda() {
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null);
  const [viendo, setViendo] = useState(null);

  const cargar = () => api('/admin/eventos', { conToken: true })
    .then((d) => { setEventos(d.eventos); setError(null); })
    .catch((e) => {
      setError(e.message);
    });

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  async function guardar(f) {
    const cuerpo = { ...f, cupo: f.cupo === '' ? null : f.cupo };
    if (f.id) await api(`/admin/eventos/${f.id}`, { metodo: 'PUT', cuerpo, conToken: true });
    else await api('/admin/eventos', { metodo: 'POST', cuerpo, conToken: true });
    setEditando(null);
    await cargar();
  }

  async function borrar(e) {
    if (!confirm(`¿Borrar «${e.titulo}»?`)) return;
    try {
      await api(`/admin/eventos/${e.id}`, { metodo: 'DELETE', conToken: true });
      await cargar();
    } catch (err) { alert(err.message); }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <h2 style={{ margin: 0 }}>Agenda</h2>
        {!editando && (
          <button className="boton boton-primario" onClick={() => setEditando({ ...VACIO })}>Nueva fecha</button>
        )}
      </div>

      {error && <div className="aviso aviso-mal">{error}</div>}
      {editando && <Formulario inicial={editando} alGuardar={guardar} alCancelar={() => setEditando(null)} />}
      {viendo && <Reservas evento={viendo} alCerrar={() => setViendo(null)} />}

      {eventos === null && !error && <p className="tenue">Cargando…</p>}
      {eventos && eventos.length === 0 && (
        <div className="aviso aviso-gris">No hay fechas cargadas. Crea la primera con «Nueva fecha».</div>
      )}

      {eventos && eventos.length > 0 && (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Cuándo</th><th>Título</th><th>Dónde</th>
                <th>Cupo</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fecha(e.inicia_at)}</td>
                  <td><strong>{e.titulo}</strong></td>
                  <td>{[e.lugar, e.ciudad].filter(Boolean).join(', ')}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {e.cupo === null
                      ? <>{e.tomados} <span className="tenue">/ sin tope</span></>
                      : <>{e.tomados} <span className="tenue">/ {e.cupo}</span></>}
                  </td>
                  <td>
                    <span className={`pastilla ${e.publicado ? 'pastilla-abierta' : 'pastilla-gris'}`}>
                      {e.publicado ? 'Publicada' : 'Borrador'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="boton boton-tierra boton-chico" onClick={() => setViendo(e)}>Inscritos</button>{' '}
                    <button
                      className="boton boton-tierra boton-chico"
                      onClick={() => setEditando({ ...e, inicia_at: paraCampo(e.inicia_at), termina_at: paraCampo(e.termina_at) })}
                    >Editar</button>{' '}
                    <button className="boton boton-tierra boton-chico" onClick={() => borrar(e)}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
