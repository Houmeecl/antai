import LogoAntai from '../componentes/LogoAntai.jsx';
import Agenda from '../componentes/Agenda.jsx';

// ============================================================
// Portada de Antai Mineral Mark.
//
// LO QUE ESTA PÁGINA PUEDE AFIRMAR Y LO QUE NO. Antai capacita en CBAM y
// prepara evidencia para que un tercero la use: eso se dice sin reservas
// porque es lo que se hace. VERIFICAR CBAM es otra cosa —exige
// acreditación ISO 17029/14065 y separación de roles—, así que aparece
// como capacidad en construcción con su condición escrita, nunca en
// presente. No es prudencia excesiva: prometerlo hoy significa que el
// primer cliente lo va a exigir mañana.
// ============================================================

// Las cinco áreas. Cada una dice hasta dónde llega HOY, en su propia
// línea: es más honesto y además más útil que un párrafo general al pie
// que nadie relaciona con el servicio que le interesa.
//
// `hoy` es lo que ya se hace. `condicion` aparece solo donde falta algo
// —acreditación— y se muestra distinto, no escondido.
const AREAS = [
  {
    clave: 'cbam',
    titulo: 'CBAM',
    linea: 'Mecanismo de Ajuste en Frontera por Carbono',
    hoy: 'Preparamos los datos que la Unión Europea pide por instalación, producto y período, '
      + 'con la evidencia detrás de cada cifra.',
  },
  {
    clave: 'capacitacion',
    titulo: 'Capacitación',
    linea: 'Formación para equipos técnicos y comerciales',
    hoy: 'Qué exige CBAM, qué datos hay que tener y en qué forma entregarlos. '
      + 'Presencial en Antofagasta y la región, con constancia de participación.',
  },
  {
    clave: 'verificacion',
    titulo: 'Verificación',
    linea: 'Revisión independiente de la información declarada',
    hoy: 'Hoy revisamos la consistencia de la evidencia y dejamos por escrito qué respalda '
      + 'cada dato y qué falta.',
    condicion: 'La verificación acreditada exige ISO 17029 / 14065. Está en camino, todavía no está.',
  },
  {
    clave: 'certificacion',
    titulo: 'Certificación',
    linea: 'Acreditación de conformidad frente a un esquema',
    hoy: 'Preparamos a la empresa y su expediente para presentarse ante un organismo certificador.',
    condicion: 'Antai no emite certificados propios. Acompañamos el proceso ante quien sí puede.',
  },
  {
    clave: 'corredor',
    titulo: 'Corredor',
    linea: 'Origen a destino, por el corredor bioceánico',
    hoy: 'El expediente de una carga desde la faena hasta el puerto de llegada, con los documentos '
      + 'que cada frontera pide y los que faltan a la vista.',
  },
  {
    clave: 'mineria',
    titulo: 'Minería',
    linea: 'Proveedores industriales de la gran minería',
    hoy: 'Maestranzas y metalmecánicas que venden a faena: convertimos su operación en un '
      + 'expediente que el comprador, el auditor y el banco pueden usar.',
  },
];

const BLOQUES = [
  ['Empresa e instalación', 'Dónde se produce', 'Rol único tributario, dirección de la planta, actividad'],
  ['Venta', 'Qué se vendió y a quién', 'Factura, orden de compra, contrato'],
  ['Material', 'Qué entró al proceso', 'Facturas de compra, fichas técnicas'],
  ['Energía', 'Cuánta se consumió', 'Boletas del suministrador, lecturas del período'],
  ['Combustible', 'Cuánto y para qué', 'Facturas, registros de consumo por equipo'],
  ['Producción', 'Cuánto salió', 'Registros del período, partes de producción'],
  ['Entrega', 'Cuándo llegó y quién recibió', 'Guía de despacho, acuse de recepción'],
];

export default function Landing() {
  return (
    <>
      <header className="barra">
        <div className="barra-inner">
          <LogoAntai variante="horizontal" alto={34} />
          <nav className="barra-links">
            <a href="#que-hacemos">Áreas</a>
            <a href="#como">Cómo funciona</a>
            <a href="#agenda">Agenda</a>
            <a href="#contacto">Contacto</a>
          </nav>
        </div>
      </header>

      <section className="hero hero-centro">
        <div className="contenedor">
          <div className="hero-marca">
            <LogoAntai variante="completo" tono="claro" alto={220} />
          </div>
          <h1>El futuro del mundo comienza aquí</h1>
          <p className="bajada">
            Capacitación CBAM y evidencia industrial trazable para proveedores mineros.
            Antofagasta, Chile.
          </p>
          <div className="hero-acciones">
            <a className="boton boton-primario" href="#agenda">Ver próximas fechas</a>
            <a className="boton boton-borde" href="#areas">Nuestras áreas</a>
          </div>

          <div className="areas" id="areas">
            {AREAS.map((a) => (
              <a className="area" href="#que-hacemos" key={a.clave}>
                <span className="area-titulo">{a.titulo}</span>
                <span className="area-linea">{a.linea}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="seccion" id="que-hacemos">
        <div className="contenedor">
          <h2>Nuestras áreas</h2>
          <p className="entrada">
            No vendemos software ambiental. Vendemos que una operación industrial quede
            documentada de forma que un tercero pueda usarla sin volver a preguntar nada.
            De cada área decimos hasta dónde llega hoy.
          </p>
          <div className="rejilla">
            {AREAS.map((a) => (
              <article className="tarjeta area-detalle" key={a.clave}>
                <h3>{a.titulo}</h3>
                <p className="area-linea-detalle">{a.linea}</p>
                <p>{a.hoy}</p>
                {a.condicion && (
                  <p className="area-condicion">{a.condicion}</p>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="seccion seccion-clara" id="como">
        <div className="contenedor">
          <h2>Cómo funciona</h2>
          <p className="entrada">
            Siete bloques. De cada uno se pide el dato mínimo y la evidencia que lo respalda.
            Lo que falta queda a la vista desde el primer día — esa es la parte útil.
          </p>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr><th>Bloque</th><th>Dato mínimo</th><th>Evidencia esperada</th></tr>
              </thead>
              <tbody>
                {BLOQUES.map(([b, d, e]) => (
                  <tr key={b}><td><strong>{b}</strong></td><td>{d}</td><td>{e}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tenue" style={{ marginTop: 22, maxWidth: '62ch' }}>
            <strong>Evidencia documentada, faltantes visibles.</strong> Un porcentaje de avance
            no es una calificación ni un sello: dice cuánto está respaldado y qué falta.
            Presentarlo como certificación sería exactamente lo que este trabajo evita.
          </p>
        </div>
      </section>

      <section className="seccion" id="agenda">
        <div className="contenedor">
          <h2>Próximas fechas</h2>
          <p className="entrada">
            Charlas y formación en Antofagasta y la región. Cupos limitados cuando la sala
            lo exige; si no hay tope, la inscripción queda abierta.
          </p>
          <Agenda />
        </div>
      </section>

      <footer className="pie" id="contacto">
        <div className="contenedor pie-inner">
          <div>
            <LogoAntai variante="completo" tono="claro" alto={116} />
          </div>
          <div style={{ maxWidth: '38ch' }}>
            <p style={{ margin: '0 0 10px' }}>
              <strong>Antai Mineral Mark</strong><br />
              Antofagasta, Chile
            </p>
            <p style={{ margin: '0 0 14px' }}>
              <a href="mailto:hola@antai.cl">hola@antai.cl</a>
            </p>
            <small>
              Antai Mineral Mark prepara y estructura evidencia. No es un organismo de
              certificación ni de verificación acreditada, y no otorga sellos de
              cumplimiento normativo.
            </small>
          </div>
        </div>
      </footer>
    </>
  );
}
