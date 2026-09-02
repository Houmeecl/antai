import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const ESTADOS = [
  ['nuevo', 'Nuevo'], ['contactado', 'Contactado'], ['reunion', 'Reunión hecha'],
  ['cotizado', 'Cotizado'], ['cliente', 'Cliente'], ['perdido', 'Perdido'],
];
const ORIGENES = [
  ['agenda', 'Vino a una actividad'], ['portada', 'Formulario de la portada'],
  ['referido', 'Referido'], ['visita', 'Visita en terreno'],
  ['licitacion', 'Licitación'], ['otro', 'Otro'],
];
const PASTILLA = {
  nuevo: 'pastilla-gris', contactado: 'pastilla-quedan', reunion: 'pastilla-quedan',
  cotizado: 'pastilla-quedan', cliente: 'pastilla-abierta', perdido: 'pastilla-llena',
};
const nombreDe = (lista, v) => lista.find(([k]) => k === v)?.[1] || v;
const cuando = (d) => new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const VACIO = {
  nombre: '', email: '', telefono: '', cargo: '', empresa: '', rut_empresa: '',
  ciudad: '', origen: 'otro', estado: 'nuevo', motivo_perdida: '', notas: '',
};

function Formulario({ inicial, alGuardar, alCancelar }) {
  const [f, setF] = useState(inicial);
  const [error, setError] = useState(null);
  const [yendo, setYendo] = useState(false);
  const set = (c) => (e) => setF({ ...f, [c]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    setYendo(true); setError(null);
    try { await alGuardar(f); } catch (err) { setError(err.message); } finally { setYendo(false); }
  }

  return (
    <form onSubmit={guardar} className="tarjeta" style={{ marginBottom: 24 }}>
      <h3>{f.id ? 'Editar contacto' : 'Nuevo contacto'}</h3>
      {error && <div className="aviso aviso-mal">{error}</div>}
      <div className="fila">
        <label className="campo"><span>Nombre</span>
          <input value={f.nombre} onChange={set('nombre')} required /></label>
        <label className="campo"><span>Correo</span>
          <input type="email" value={f.email} onChange={set('email')} required /></label>
      </div>
      <div className="fila">
        <label className="campo"><span>Empresa</span>
          <input value={f.empresa || ''} onChange={set('empresa')} /></label>
        <label className="campo"><span>RUT de la empresa</span>
          <input value={f.rut_empresa || ''} onChange={set('rut_empresa')} placeholder="76123456-7" /></label>
      </div>
      <div className="fila">
        <label className="campo"><span>Cargo</span>
          <input value={f.cargo || ''} onChange={set('cargo')} /></label>
        <label className="campo"><span>Teléfono</span>
          <input value={f.telefono || ''} onChange={set('telefono')} /></label>
      </div>
      <div className="fila">
        <label className="campo"><span>Ciudad</span>
          <input value={f.ciudad || ''} onChange={set('ciudad')} placeholder="Antofagasta" /></label>
        <label className="campo"><span>Origen</span>
          <select value={f.origen} onChange={set('origen')}>
            {ORIGENES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select></label>
      </div>
      <label className="campo"><span>Etapa</span>
        <select value={f.estado} onChange={set('estado')}>
          {ESTADOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select></label>
      {/* El motivo aparece solo cuando hace falta, y es obligatorio: es el
          único dato que un contacto perdido todavía puede dar. */}
      {f.estado === 'perdido' && (
        <label className="campo"><span>¿Por qué se perdió?</span>
          <input value={f.motivo_perdida || ''} onChange={set('motivo_perdida')} required
            placeholder="Precio, tiempos, se fue con otro proveedor…" /></label>
      )}
      <label className="campo"><span>Notas</span>
        <textarea value={f.notas || ''} onChange={set('notas')} /></label>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="boton boton-primario" disabled={yendo}>{yendo ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="boton boton-tierra" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function Ficha({ id, alCerrar, alEditar }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [nota, setNota] = useState('');
  const [correo, setCorreo] = useState(null);

  const cargar = () => api(`/admin/contactos/${id}`, { conToken: true })
    .then(setD).catch((e) => setError(e.message));
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [id]);

  async function anotar(e) {
    e.preventDefault();
    if (!nota.trim()) return;
    await api(`/admin/contactos/${id}/interacciones`, {
      metodo: 'POST', conToken: true, cuerpo: { tipo: 'nota', detalle: nota },
    });
    setNota('');
    cargar();
  }

  async function mandar(e) {
    e.preventDefault();
    try {
      await api(`/admin/contactos/${id}/correo`, {
        metodo: 'POST', conToken: true, cuerpo: correo,
      });
      setCorreo(null);
      cargar();
    } catch (err) { setError(err.message); }
  }

  if (error) return <div className="aviso aviso-mal">{error}</div>;
  if (!d) return <div className="tarjeta"><p className="tenue">Cargando…</p></div>;

  const c = d.contacto;
  return (
    <div className="tarjeta" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0 }}>{c.nombre}</h3>
          <p className="tenue" style={{ margin: '4px 0 0' }}>
            {[c.cargo, c.empresa, c.ciudad].filter(Boolean).join(' · ') || 'Sin empresa registrada'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 14 }}>
            <a href={`mailto:${c.email}`}>{c.email}</a>
            {c.telefono && ` · ${c.telefono}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className={`pastilla ${PASTILLA[c.estado]}`}>{nombreDe(ESTADOS, c.estado)}</span>
          <button className="boton boton-tierra boton-chico" onClick={() => alEditar(c)}>Editar</button>
          <button className="boton boton-tierra boton-chico" onClick={() => setCorreo({ asunto: '', cuerpo: '' })}>Escribir</button>
          <button className="boton boton-tierra boton-chico" onClick={alCerrar}>Cerrar</button>
        </div>
      </div>

      {c.motivo_perdida && (
        <div className="aviso aviso-gris" style={{ marginTop: 14 }}>
          <strong>Se perdió:</strong> {c.motivo_perdida}
        </div>
      )}

      {correo && (
        <form onSubmit={mandar} style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--borde)' }}>
          <label className="campo"><span>Asunto</span>
            <input value={correo.asunto} onChange={(e) => setCorreo({ ...correo, asunto: e.target.value })} required /></label>
          <label className="campo"><span>Mensaje</span>
            <textarea value={correo.cuerpo} onChange={(e) => setCorreo({ ...correo, cuerpo: e.target.value })} required /></label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="boton boton-primario">Enviar a {c.email}</button>
            <button type="button" className="boton boton-tierra" onClick={() => setCorreo(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="rejilla" style={{ marginTop: 20 }}>
        <div>
          <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--piedra)' }}>Cotizaciones</h4>
          {d.cotizaciones.length === 0 ? <p className="tenue">Ninguna todavía.</p> : d.cotizaciones.map((q) => (
            <p key={q.id} style={{ fontSize: 14, margin: '4px 0' }}>
              <strong>{q.folio}</strong> · {q.nombre_estado || q.estado_vigente} · ${Number(q.total).toLocaleString('es-CL')}
            </p>
          ))}
        </div>
        <div>
          <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--piedra)' }}>Actividades</h4>
          {d.actividades.length === 0 ? <p className="tenue">No ha venido a ninguna.</p> : d.actividades.map((a, i) => (
            <p key={i} style={{ fontSize: 14, margin: '4px 0' }}>
              {a.titulo} <span className="tenue">— {a.estado.replace('_', ' ')}</span>
            </p>
          ))}
        </div>
      </div>

      <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--piedra)', marginTop: 22 }}>Bitácora</h4>
      <form onSubmit={anotar} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="¿Qué pasó? Llamada, correo, acuerdo…" />
        <button className="boton boton-tierra">Anotar</button>
      </form>
      {d.interacciones.length === 0 && <p className="tenue">Todavía no hay nada anotado.</p>}
      {d.interacciones.map((i) => (
        <div key={i.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--borde)', fontSize: 14 }}>
          <span className="tenue" style={{ marginRight: 10 }}>{cuando(i.created_at)}</span>
          {i.detalle}
          {i.usuario && <span className="tenue"> — {i.usuario}</span>}
        </div>
      ))}
    </div>
  );
}

export default function Crm() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [etapa, setEtapa] = useState('');

  const cargar = () => api('/admin/contactos', { conToken: true })
    .then(setDatos).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function guardar(f) {
    if (f.id) await api(`/admin/contactos/${f.id}`, { metodo: 'PUT', conToken: true, cuerpo: f });
    else await api('/admin/contactos', { metodo: 'POST', conToken: true, cuerpo: f });
    setEditando(null);
    await cargar();
  }

  if (error) return <div className="aviso aviso-mal">{error}</div>;
  if (!datos) return <p className="tenue">Cargando…</p>;

  const lista = datos.contactos.filter((c) => {
    if (etapa && c.estado !== etapa) return false;
    if (!filtro) return true;
    const t = filtro.toLowerCase();
    return [c.nombre, c.email, c.empresa].filter(Boolean).some((v) => v.toLowerCase().includes(t));
  });

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Contactos <span className="tenue" style={{ fontSize: 15 }}>({datos.embudo.total})</span></h2>
        {!editando && <button className="boton boton-primario" onClick={() => setEditando({ ...VACIO })}>Nuevo contacto</button>}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <input style={{ maxWidth: 280 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por nombre, correo o empresa" />
        <select style={{ maxWidth: 200 }} value={etapa} onChange={(e) => setEtapa(e.target.value)}>
          <option value="">Todas las etapas</option>
          {ESTADOS.map(([k, n]) => <option key={k} value={k}>{n} ({datos.embudo.conteo[k]})</option>)}
        </select>
      </div>

      {editando && <Formulario inicial={editando} alGuardar={guardar} alCancelar={() => setEditando(null)} />}
      {abierto && <Ficha id={abierto} alCerrar={() => setAbierto(null)} alEditar={(c) => { setEditando(c); setAbierto(null); }} />}

      {lista.length === 0 && (
        <div className="aviso aviso-gris">
          {datos.embudo.total === 0
            ? 'Todavía no hay contactos. Quien se inscriba a una actividad entra solo.'
            : 'Ningún contacto calza con ese filtro.'}
        </div>
      )}

      {lista.length > 0 && (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Empresa</th><th>Etapa</th><th>Origen</th><th>Cotiz.</th><th>Activ.</th><th></th></tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.nombre}</strong><div className="tenue">{c.email}</div></td>
                  <td>{c.empresa || <span className="tenue">—</span>}</td>
                  <td><span className={`pastilla ${PASTILLA[c.estado]}`}>{nombreDe(ESTADOS, c.estado)}</span></td>
                  <td className="tenue">{nombreDe(ORIGENES, c.origen)}</td>
                  <td>{c.n_cotizaciones}</td>
                  <td>{c.n_actividades}</td>
                  <td><button className="boton boton-tierra boton-chico" onClick={() => setAbierto(c.id)}>Ver ficha</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
