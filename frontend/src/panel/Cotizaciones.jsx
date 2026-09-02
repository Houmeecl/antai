import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-CL') : '—');

const PASTILLA = {
  borrador: 'pastilla-gris', enviada: 'pastilla-quedan', aceptada: 'pastilla-abierta',
  rechazada: 'pastilla-llena', vencida: 'pastilla-llena',
};

const LINEA_VACIA = { descripcion: '', cantidad: 1, precio_unitario: '' };

// El total se calcula EN LA PANTALLA con la misma regla del servidor:
// enteros y un solo redondeo del IVA. Si las dos usaran fórmulas
// distintas, el número que la persona ve al armar la cotización no sería
// el que se guarda.
function calcular(items, tasa = 19) {
  const neto = items.reduce((a, i) => {
    const c = Number(i.cantidad); const p = Number(i.precio_unitario);
    if (!Number.isFinite(c) || !Number.isFinite(p) || c <= 0 || p < 0) return a;
    return a + Math.round(c * p);
  }, 0);
  const iva = Math.round(neto * (tasa / 100));
  return { neto, iva, total: neto + iva };
}

function Formulario({ contactos, alGuardar, alCancelar }) {
  const [f, setF] = useState({ contacto_id: '', titulo: '', glosa: '', valida_hasta: '' });
  const [items, setItems] = useState([{ ...LINEA_VACIA }]);
  const [error, setError] = useState(null);
  const [yendo, setYendo] = useState(false);
  const t = calcular(items);

  const setLinea = (i, campo) => (e) => {
    const copia = [...items];
    copia[i] = { ...copia[i], [campo]: e.target.value };
    setItems(copia);
  };

  async function guardar(e) {
    e.preventDefault();
    setYendo(true); setError(null);
    try {
      await alGuardar({
        ...f,
        valida_hasta: f.valida_hasta || null,
        items: items.map((i) => ({
          descripcion: i.descripcion,
          cantidad: Number(i.cantidad),
          precio_unitario: parseInt(i.precio_unitario, 10),
        })),
      });
    } catch (err) { setError(err.message); } finally { setYendo(false); }
  }

  return (
    <form onSubmit={guardar} className="tarjeta" style={{ marginBottom: 24 }}>
      <h3>Nueva cotización</h3>
      {error && <div className="aviso aviso-mal">{error}</div>}
      <div className="fila">
        <label className="campo"><span>Para</span>
          <select value={f.contacto_id} onChange={(e) => setF({ ...f, contacto_id: e.target.value })} required>
            <option value="">Elige un contacto…</option>
            {contactos.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}{c.empresa ? ` — ${c.empresa}` : ''}</option>
            ))}
          </select></label>
        <label className="campo"><span>Válida hasta <em className="tenue">(opcional)</em></span>
          <input type="date" value={f.valida_hasta} onChange={(e) => setF({ ...f, valida_hasta: e.target.value })} /></label>
      </div>
      <label className="campo"><span>Título</span>
        <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required
          placeholder="Implementación de expediente de evidencia" /></label>
      <label className="campo"><span>Glosa <em className="tenue">(opcional)</em></span>
        <textarea value={f.glosa} onChange={(e) => setF({ ...f, glosa: e.target.value })} /></label>

      <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--piedra)' }}>Líneas</h4>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,3fr) 80px minmax(0,1fr) auto', gap: 10, marginBottom: 10, alignItems: 'end' }}>
          <label className="campo" style={{ margin: 0 }}><span>Detalle</span>
            <input value={it.descripcion} onChange={setLinea(i, 'descripcion')} required /></label>
          <label className="campo" style={{ margin: 0 }}><span>Cant.</span>
            <input type="number" min="0.01" step="0.01" value={it.cantidad} onChange={setLinea(i, 'cantidad')} required /></label>
          <label className="campo" style={{ margin: 0 }}><span>Precio neto</span>
            <input type="number" min="0" step="1" value={it.precio_unitario} onChange={setLinea(i, 'precio_unitario')} required /></label>
          <button type="button" className="boton boton-tierra boton-chico" disabled={items.length === 1}
            onClick={() => setItems(items.filter((_, k) => k !== i))}>Quitar</button>
        </div>
      ))}
      <button type="button" className="boton boton-tierra boton-chico" onClick={() => setItems([...items, { ...LINEA_VACIA }])}>
        Agregar línea
      </button>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--borde)', textAlign: 'right' }}>
        <div className="tenue">Neto {pesos(t.neto)} · IVA 19% {pesos(t.iva)}</div>
        <div style={{ fontFamily: 'var(--titulo)', fontSize: 24, marginTop: 4 }}>{pesos(t.total)}</div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button className="boton boton-primario" disabled={yendo}>{yendo ? 'Creando…' : 'Crear cotización'}</button>
        <button type="button" className="boton boton-tierra" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function Detalle({ id, alCerrar, alCambiar }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [pago, setPago] = useState(null);

  const cargar = () => api(`/admin/cotizaciones/${id}`, { conToken: true })
    .then(setD).catch((e) => setError(e.message));
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [id]);

  async function enviar() {
    try {
      const r = await api(`/admin/cotizaciones/${id}/enviar`, { metodo: 'POST', conToken: true });
      alert(r.correo?.estado === 'enviado'
        ? 'Cotización enviada por correo.'
        : `Se marcó enviada. El correo quedó en estado «${r.correo?.estado}» — revisa la pestaña Correos.`);
      cargar(); alCambiar();
    } catch (err) { alert(err.message); }
  }

  async function registrarPago(e) {
    e.preventDefault();
    try {
      await api(`/admin/cotizaciones/${id}/pagos`, {
        metodo: 'POST', conToken: true,
        cuerpo: { ...pago, monto: parseInt(pago.monto, 10) },
      });
      setPago(null); cargar(); alCambiar();
    } catch (err) { alert(err.message); }
  }

  async function marcarPago(pagoId, estado) {
    await api(`/admin/pagos/${pagoId}`, { metodo: 'PUT', conToken: true, cuerpo: { estado } });
    cargar(); alCambiar();
  }

  if (error) return <div className="aviso aviso-mal">{error}</div>;
  if (!d) return <div className="tarjeta"><p className="tenue">Cargando…</p></div>;

  const c = d.cotizacion;
  return (
    <div className="tarjeta" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>{c.folio} — {c.titulo}</h3>
          <p className="tenue" style={{ margin: '4px 0 0' }}>
            {c.cliente_nombre}{c.cliente_empresa ? ` · ${c.cliente_empresa}` : ''} · {c.cliente_email}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <span className={`pastilla ${PASTILLA[c.estado_vigente]}`}>{c.nombre_estado}</span>
          {c.estado_vigente !== 'aceptada' && (
            <button className="boton boton-primario boton-chico" onClick={enviar}>
              {c.estado === 'borrador' ? 'Enviar por correo' : 'Reenviar'}
            </button>
          )}
          <button className="boton boton-tierra boton-chico" onClick={alCerrar}>Cerrar</button>
        </div>
      </div>

      <div className="tabla-scroll" style={{ marginTop: 18 }}>
        <table>
          <thead><tr><th>Detalle</th><th style={{ textAlign: 'right' }}>Cant.</th><th style={{ textAlign: 'right' }}>Precio</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr></thead>
          <tbody>
            {d.items.map((i) => (
              <tr key={i.id}>
                <td>{i.descripcion}</td>
                <td style={{ textAlign: 'right' }}>{Number(i.cantidad)}</td>
                <td style={{ textAlign: 'right' }}>{pesos(i.precio_unitario)}</td>
                <td style={{ textAlign: 'right' }}>{pesos(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} style={{ textAlign: 'right' }}>Neto</td><td style={{ textAlign: 'right' }}>{pesos(c.neto)}</td></tr>
            <tr><td colSpan={3} style={{ textAlign: 'right' }}>IVA {c.tasa_iva}%</td><td style={{ textAlign: 'right' }}>{pesos(c.iva)}</td></tr>
            <tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{pesos(c.total)}</td></tr>
          </tfoot>
        </table>
      </div>

      <p className="tenue" style={{ marginTop: 14, wordBreak: 'break-all' }}>
        Enlace para el cliente: <a href={d.enlace} target="_blank" rel="noreferrer">{d.enlace}</a>
      </p>
      {c.aceptada_at && (
        <div className="aviso aviso-bien" style={{ marginTop: 12 }}>
          Aceptada por <strong>{c.aceptada_por}</strong> el {fecha(c.aceptada_at)}.
        </div>
      )}

      <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--piedra)', marginTop: 22 }}>
        Pagos — {pesos(d.cobro.pagado)} de {pesos(d.cobro.total)}
        {d.cobro.por_confirmar > 0 && ` · ${pesos(d.cobro.por_confirmar)} por confirmar`}
      </h4>

      {d.pagos.length === 0 && <p className="tenue">Sin pagos registrados.</p>}
      {d.pagos.map((p) => (
        <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--borde)', fontSize: 14, flexWrap: 'wrap' }}>
          <strong>{pesos(p.monto)}</strong>
          <span className="tenue">{p.medio} · {fecha(p.pagado_at || p.created_at)}</span>
          <span className={`pastilla ${p.estado === 'confirmado' ? 'pastilla-abierta' : p.estado === 'anulado' ? 'pastilla-llena' : 'pastilla-quedan'}`}>
            {p.estado}
          </span>
          {p.estado === 'pendiente' && (
            <>
              <button className="boton boton-tierra boton-chico" onClick={() => marcarPago(p.id, 'confirmado')}>Lo vi en la cuenta</button>
              <button className="boton boton-tierra boton-chico" onClick={() => marcarPago(p.id, 'anulado')}>Anular</button>
            </>
          )}
        </div>
      ))}

      {pago ? (
        <form onSubmit={registrarPago} style={{ marginTop: 14 }}>
          <div className="fila">
            <label className="campo"><span>Monto</span>
              <input type="number" min="1" step="1" value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} required /></label>
            <label className="campo"><span>Medio</span>
              <select value={pago.medio} onChange={(e) => setPago({ ...pago, medio: e.target.value })}>
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="pasarela">Pasarela</option>
                <option value="otro">Otro</option>
              </select></label>
          </div>
          <label className="campo"><span>Referencia <em className="tenue">(opcional)</em></span>
            <input value={pago.referencia} onChange={(e) => setPago({ ...pago, referencia: e.target.value })} /></label>
          <label style={{ display: 'flex', gap: 9, alignItems: 'center', margin: '4px 0 14px' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={pago.confirmado}
              onChange={(e) => setPago({ ...pago, confirmado: e.target.checked })} />
            <span style={{ fontSize: 14 }}>Ya lo vi en la cuenta</span>
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="boton boton-primario">Registrar</button>
            <button type="button" className="boton boton-tierra" onClick={() => setPago(null)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button className="boton boton-tierra boton-chico" style={{ marginTop: 14 }}
          onClick={() => setPago({ monto: String(d.cobro.saldo || ''), medio: 'transferencia', referencia: '', confirmado: false })}>
          Registrar un pago
        </button>
      )}
    </div>
  );
}

export default function Cotizaciones() {
  const [lista, setLista] = useState(null);
  const [contactos, setContactos] = useState([]);
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);
  const [abierta, setAbierta] = useState(null);

  const cargar = () => Promise.all([
    api('/admin/cotizaciones', { conToken: true }),
    api('/admin/contactos', { conToken: true }),
  ]).then(([a, b]) => { setLista(a.cotizaciones); setContactos(b.contactos); })
    .catch((e) => setError(e.message));

  useEffect(() => { cargar(); }, []);

  async function crear(datos) {
    const r = await api('/admin/cotizaciones', { metodo: 'POST', conToken: true, cuerpo: datos });
    setCreando(false);
    await cargar();
    setAbierta(r.cotizacion.id);
  }

  if (error) return <div className="aviso aviso-mal">{error}</div>;
  if (!lista) return <p className="tenue">Cargando…</p>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Cotizaciones</h2>
        {!creando && (
          <button className="boton boton-primario" disabled={contactos.length === 0}
            onClick={() => setCreando(true)}>Nueva cotización</button>
        )}
      </div>

      {contactos.length === 0 && (
        <div className="aviso aviso-gris">
          Para cotizar hace falta un contacto. Crea uno en la pestaña Contactos.
        </div>
      )}

      {creando && <Formulario contactos={contactos} alGuardar={crear} alCancelar={() => setCreando(false)} />}
      {abierta && <Detalle id={abierta} alCerrar={() => setAbierta(null)} alCambiar={cargar} />}

      {lista.length === 0 && !creando && (
        <div className="aviso aviso-gris">Todavía no hay cotizaciones.</div>
      )}

      {lista.length > 0 && (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr><th>Folio</th><th>Cliente</th><th>Título</th><th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Saldo</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.folio}</strong></td>
                  <td>{c.contacto_nombre}</td>
                  <td>{c.titulo}</td>
                  <td style={{ textAlign: 'right' }}>{pesos(c.total)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {c.saldo > 0 ? pesos(c.saldo) : <span className="tenue">pagada</span>}
                  </td>
                  <td><span className={`pastilla ${PASTILLA[c.estado_vigente]}`}>{c.nombre_estado}</span></td>
                  <td><button className="boton boton-tierra boton-chico" onClick={() => setAbierta(c.id)}>Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
