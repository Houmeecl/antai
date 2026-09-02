import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// ============================================================
// La agenda pública: próximas fechas y el formulario para tomar una.
//
// TRES ESTADOS, NO DOS. «Cargando», «no pudimos cargar» y «no hay fechas»
// son cosas distintas y se dicen distinto. Mostrar la lista vacía cuando
// el servidor no contestó le haría creer a la gente que no hay actividades
// programadas, que es exactamente lo contrario de lo que pasó.
// ============================================================

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function pastilla(evento) {
  if (evento.sin_limite) return ['pastilla-abierta', evento.texto_cupo];
  if (evento.cupos_disponibles === 0) return ['pastilla-llena', 'Sin cupos'];
  return ['pastilla-quedan', evento.texto_cupo];
}

const hora = (iso) => new Date(iso).toLocaleTimeString('es-CL', {
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago',
});

function Formulario({ evento, alReservar }) {
  const [datos, setDatos] = useState({ nombre: '', email: '', empresa: '', telefono: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const set = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await api(`/eventos/${evento.id}/reservar`, { metodo: 'POST', cuerpo: datos });
      alReservar(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} style={{ marginTop: 16 }}>
      {error && <div className="aviso aviso-mal">{error}</div>}
      <div className="fila">
        <label className="campo">
          <span>Nombre y apellido</span>
          <input value={datos.nombre} onChange={set('nombre')} required autoComplete="name" />
        </label>
        <label className="campo">
          <span>Correo</span>
          <input type="email" value={datos.email} onChange={set('email')} required autoComplete="email" />
        </label>
      </div>
      <div className="fila">
        <label className="campo">
          <span>Empresa <em className="tenue">(opcional)</em></span>
          <input value={datos.empresa} onChange={set('empresa')} autoComplete="organization" />
        </label>
        <label className="campo">
          <span>Teléfono <em className="tenue">(opcional)</em></span>
          <input value={datos.telefono} onChange={set('telefono')} autoComplete="tel" />
        </label>
      </div>
      <button className="boton boton-primario" disabled={enviando}>
        {enviando ? 'Tomando el cupo…' : 'Tomar mi cupo'}
      </button>
      <p className="tenue" style={{ marginTop: 12 }}>
        Usamos tus datos solo para esta actividad y para avisarte si cambia algo.
        Puedes soltar el cupo cuando quieras con el enlace que te llega por correo.
      </p>
    </form>
  );
}

export default function Agenda() {
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [listo, setListo] = useState(null);

  useEffect(() => {
    let vivo = true;
    api('/eventos')
      .then((d) => { if (vivo) setEventos(d.eventos); })
      .catch((e) => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, []);

  if (error) {
    return (
      <div className="aviso aviso-gris">
        No pudimos cargar la agenda ahora mismo. {error} Escríbenos y te contamos las próximas fechas.
      </div>
    );
  }

  if (eventos === null) return <p className="tenue">Cargando la agenda…</p>;

  if (!eventos.length) {
    return (
      <div className="aviso aviso-gris">
        No hay fechas abiertas en este momento. Escríbenos y te avisamos apenas se publique la próxima.
      </div>
    );
  }

  return (
    <div>
      {listo && (
        <div className="aviso aviso-bien">
          <strong>Tu cupo quedó tomado.</strong>{' '}
          {listo.correo_enviado
            ? 'Te llegó un correo con los datos y el enlace para soltarlo si no puedes ir.'
            : 'No pudimos enviarte el correo de confirmación, pero tu cupo está tomado. Te contactamos nosotros.'}
        </div>
      )}

      {eventos.map((e) => {
        const [clase, texto] = pastilla(e);
        const f = new Date(e.inicia_at);
        const lleno = !e.sin_limite && e.cupos_disponibles === 0;
        return (
          <div key={e.id}>
            <div className="fecha">
              <div className="fecha-dia">
                <div className="d">{f.getDate()}</div>
                <div className="m">{MESES[f.getMonth()]}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <h3>{e.titulo}</h3>
                <p className="donde">
                  {hora(e.inicia_at)} h · {[e.lugar, e.ciudad].filter(Boolean).join(', ')} · {e.modalidad}
                </p>
                {e.descripcion && <p className="tenue" style={{ marginTop: 6 }}>{e.descripcion}</p>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
                <span className={`pastilla ${clase}`}>{texto}</span>
                {!lleno && (
                  <button
                    className="boton boton-tierra boton-chico"
                    onClick={() => setAbierto(abierto === e.id ? null : e.id)}
                    aria-expanded={abierto === e.id}
                  >
                    {abierto === e.id ? 'Cerrar' : 'Inscribirme'}
                  </button>
                )}
              </div>
            </div>
            {abierto === e.id && (
              <div className="tarjeta" style={{ marginTop: -6, marginBottom: 20 }}>
                <Formulario
                  evento={e}
                  alReservar={(r) => {
                    setListo(r);
                    setAbierto(null);
                    // Se vuelve a pedir la lista para que el cupo que
                    // acaba de tomarse se vea descontado. Confiar en un
                    // contador local haría que la pantalla y el servidor
                    // dejaran de coincidir en cuanto otra persona reserve.
                    api('/eventos').then((d) => setEventos(d.eventos)).catch(() => {});
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
