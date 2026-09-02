import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import LogoAntai from '../componentes/LogoAntai.jsx';
import { api } from '../lib/api.js';

// ============================================================
// La cotización, como la ve el cliente desde el enlace del correo.
//
// Sin cuenta y sin clave: su credencial es el token del enlace. La página
// hace tres cosas —mostrar, aceptar, avisar que transfirió— y nada más.
// ============================================================

const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) : null);

function Aceptar({ token, alAceptar }) {
  const [nombre, setNombre] = useState('');
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState(null);

  async function aceptar(e) {
    e.preventDefault();
    setYendo(true); setError(null);
    try {
      await api(`/cotizacion/${token}/aceptar`, { metodo: 'POST', cuerpo: { nombre } });
      alAceptar();
    } catch (err) { setError(err.message); } finally { setYendo(false); }
  }

  return (
    <form onSubmit={aceptar} className="tarjeta" style={{ marginTop: 22 }}>
      <h3>Aceptar esta cotización</h3>
      <p className="tenue" style={{ marginTop: -4 }}>
        Queda constancia de tu nombre y la fecha. Después te enviamos los datos para pagar.
      </p>
      {error && <div className="aviso aviso-mal">{error}</div>}
      <label className="campo">
        <span>Tu nombre y apellido</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3} />
      </label>
      <button className="boton boton-primario" disabled={yendo}>
        {yendo ? 'Registrando…' : 'Acepto esta cotización'}
      </button>
    </form>
  );
}

function InformarPago({ token, sugerido, transferencia }) {
  const [monto, setMonto] = useState(String(sugerido || ''));
  const [referencia, setReferencia] = useState('');
  const [listo, setListo] = useState(false);
  const [error, setError] = useState(null);
  const [yendo, setYendo] = useState(false);

  async function informar(e) {
    e.preventDefault();
    setYendo(true); setError(null);
    try {
      await api(`/cotizacion/${token}/informar-pago`, {
        metodo: 'POST', cuerpo: { monto: parseInt(monto, 10), referencia },
      });
      setListo(true);
    } catch (err) { setError(err.message); } finally { setYendo(false); }
  }

  if (listo) {
    return (
      <div className="aviso aviso-bien" style={{ marginTop: 22 }}>
        Gracias. Lo revisamos contra la cuenta y te confirmamos por correo.
      </div>
    );
  }

  return (
    <div className="tarjeta" style={{ marginTop: 22 }}>
      <h3>Pagar</h3>
      {transferencia ? (
        <>
          <table style={{ minWidth: 0, marginBottom: 16 }}>
            <tbody>
              <tr><th>Banco</th><td>{transferencia.banco}</td></tr>
              <tr><th>Tipo</th><td>{transferencia.tipo_cuenta}</td></tr>
              {transferencia.numero && <tr><th>Cuenta</th><td>{transferencia.numero}</td></tr>}
              {transferencia.titular && <tr><th>Titular</th><td>{transferencia.titular}</td></tr>}
              {transferencia.rut && <tr><th>RUT</th><td>{transferencia.rut}</td></tr>}
              {transferencia.email && <tr><th>Correo</th><td>{transferencia.email}</td></tr>}
            </tbody>
          </table>
          <form onSubmit={informar}>
            {error && <div className="aviso aviso-mal">{error}</div>}
            <div className="fila">
              <label className="campo"><span>Monto transferido</span>
                <input type="number" min="1" step="1" value={monto} onChange={(e) => setMonto(e.target.value)} required /></label>
              <label className="campo"><span>N° de transferencia <em className="tenue">(opcional)</em></span>
                <input value={referencia} onChange={(e) => setReferencia(e.target.value)} /></label>
            </div>
            <button className="boton boton-tierra" disabled={yendo}>
              {yendo ? 'Avisando…' : 'Ya transferí'}
            </button>
            <p className="tenue" style={{ marginTop: 10 }}>
              Esto nos avisa; el pago queda confirmado cuando lo vemos en la cuenta.
            </p>
          </form>
        </>
      ) : (
        <p className="tenue">
          Escríbenos a <a href="mailto:hola@antai.cl">hola@antai.cl</a> y te enviamos los datos para pagar.
        </p>
      )}
    </div>
  );
}

export default function Cotizacion() {
  const { token } = useParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const cargar = () => api(`/cotizacion/${token}`)
    .then(setDatos).catch((e) => setError(e.message));

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [token]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="tarjeta" style={{ maxWidth: 460, textAlign: 'center' }}>
          <div style={{ marginBottom: 18 }}><LogoAntai variante="completo" alto={104} /></div>
          <h3>No encontramos esta cotización</h3>
          <p className="tenue">{error}</p>
          <p><a href="mailto:hola@antai.cl">hola@antai.cl</a></p>
        </div>
      </div>
    );
  }

  if (!datos) return <p className="tenue" style={{ padding: 40 }}>Cargando…</p>;

  const c = datos.cotizacion;
  const aceptada = c.estado === 'aceptada';

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px 70px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 26 }}>
        <LogoAntai variante="completo" alto={104} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--titulo)', fontSize: 21 }}>{c.folio}</div>
          <div className="tenue">Emitida el {fecha(c.emitida)}</div>
          {c.valida_hasta && <div className="tenue">Válida hasta el {fecha(c.valida_hasta)}</div>}
        </div>
      </div>

      {aceptada && (
        <div className="aviso aviso-bien">
          <strong>Aceptada</strong> el {fecha(c.aceptada_at)}. Gracias — nos ponemos en marcha.
        </div>
      )}
      {c.estado === 'vencida' && (
        <div className="aviso aviso-gris">
          Esta cotización venció el {fecha(c.valida_hasta)}. Escríbenos y te preparamos una nueva
          con los precios al día.
        </div>
      )}
      {c.estado === 'rechazada' && <div className="aviso aviso-gris">Esta cotización fue rechazada.</div>}

      <div className="tarjeta">
        <h2 style={{ fontSize: 22, marginTop: 0 }}>{c.titulo}</h2>
        <p className="tenue" style={{ marginTop: -4 }}>
          Para {c.cliente_nombre}{c.cliente_empresa ? ` · ${c.cliente_empresa}` : ''}
        </p>
        {c.glosa && <p style={{ marginTop: 14 }}>{c.glosa}</p>}

        <div className="tabla-scroll" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Detalle</th>
                <th style={{ textAlign: 'right' }}>Cantidad</th>
                <th style={{ textAlign: 'right' }}>Precio</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((i, k) => (
                <tr key={k}>
                  <td>{i.descripcion}</td>
                  <td style={{ textAlign: 'right' }}>{i.cantidad}</td>
                  <td style={{ textAlign: 'right' }}>{pesos(i.precio_unitario)}</td>
                  <td style={{ textAlign: 'right' }}>{pesos(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3} style={{ textAlign: 'right' }}>Neto</td>
                <td style={{ textAlign: 'right' }}>{pesos(c.neto)}</td></tr>
              <tr><td colSpan={3} style={{ textAlign: 'right' }}>IVA {c.tasa_iva}%</td>
                <td style={{ textAlign: 'right' }}>{pesos(c.iva)}</td></tr>
              <tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 17 }}>{pesos(c.total)}</td></tr>
            </tfoot>
          </table>
        </div>

        {c.cobro.pagado > 0 && (
          <p className="tenue" style={{ marginTop: 14 }}>
            Pagado: {pesos(c.cobro.pagado)} · Saldo: <strong>{pesos(c.cobro.saldo)}</strong>
            {c.cobro.por_confirmar > 0 && ` · ${pesos(c.cobro.por_confirmar)} informado y por confirmar`}
          </p>
        )}
      </div>

      {datos.puede_aceptar.puede && <Aceptar token={token} alAceptar={cargar} />}
      {aceptada && !c.cobro.saldada && (
        <InformarPago token={token} sugerido={c.cobro.saldo} transferencia={datos.transferencia} />
      )}

      <p className="tenue" style={{ marginTop: 34, textAlign: 'center' }}>
        Antai Mineral Mark · Antofagasta, Chile · <a href="mailto:hola@antai.cl">hola@antai.cl</a>
      </p>
    </div>
  );
}
