import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;

const ETAPAS = [
  ['nuevo', 'Nuevos'], ['contactado', 'Contactados'], ['reunion', 'Con reunión'],
  ['cotizado', 'Cotizados'], ['cliente', 'Clientes'], ['perdido', 'Perdidos'],
];

export default function Tablero() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/admin/tablero', { conToken: true }).then(setD).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="aviso aviso-mal">{error}</div>;
  if (!d) return <p className="tenue">Cargando…</p>;

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Tablero</h2>

      <h3 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--piedra)' }}>Embudo</h3>
      <div className="rejilla" style={{ marginBottom: 30 }}>
        {ETAPAS.map(([clave, nombre]) => (
          <div className="tarjeta" key={clave} style={{ padding: 18 }}>
            <div style={{ fontFamily: 'var(--titulo)', fontSize: 30, lineHeight: 1 }}>
              {d.embudo.conteo[clave]}
            </div>
            <p style={{ marginTop: 6, fontSize: 14 }}>{nombre}</p>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--piedra)' }}>Cotizaciones y caja</h3>
      <div className="rejilla">
        <div className="tarjeta">
          <h3>Vigentes</h3>
          <p style={{ fontFamily: 'var(--titulo)', fontSize: 26, color: 'var(--tierra)', margin: '4px 0' }}>
            {pesos(d.cotizaciones.monto_vigente)}
          </p>
          <p>{d.cotizaciones.vigentes} cotización(es) enviada(s) y sin vencer.</p>
        </div>
        <div className="tarjeta">
          <h3>Aceptadas</h3>
          <p style={{ fontFamily: 'var(--titulo)', fontSize: 26, color: 'var(--tierra)', margin: '4px 0' }}>
            {pesos(d.cotizaciones.monto_aceptado)}
          </p>
          <p>{d.cotizaciones.aceptadas} aceptada(s).</p>
        </div>
        <div className="tarjeta">
          <h3>Cobrado</h3>
          <p style={{ fontFamily: 'var(--titulo)', fontSize: 26, color: 'var(--cobre)', margin: '4px 0' }}>
            {pesos(d.caja.cobrado)}
          </p>
          {/* Lo por confirmar va APARTE y se dice por qué. Sumarlo sería
              anotar como cobrado un depósito que nadie vio en la cuenta. */}
          <p>
            {d.caja.por_confirmar > 0
              ? <>{pesos(d.caja.por_confirmar)} informado por clientes y <strong>todavía sin confirmar</strong> contra la cuenta.</>
              : 'Solo pagos confirmados contra la cuenta.'}
          </p>
        </div>
      </div>

      {d.correos_con_error > 0 && (
        <div className="aviso aviso-mal" style={{ marginTop: 24 }}>
          {d.correos_con_error} correo(s) no salieron. Revísalos en la pestaña Correos.
        </div>
      )}
    </>
  );
}
