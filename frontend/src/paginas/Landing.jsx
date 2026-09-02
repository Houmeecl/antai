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

const QUE_HACEMOS = [
  {
    titulo: 'Capacitación CBAM',
    texto: 'Formación para equipos de proveedores industriales: qué exige el mecanismo europeo, '
      + 'qué datos hay que tener y en qué forma. Con constancia de participación.',
  },
  {
    titulo: 'Evidencia industrial trazable',
    texto: 'Convertimos una operación en un expediente donde cada dato tiene fuente, período, '
      + 'instalación y responsable. No es un archivador de PDF: es evidencia que otro puede usar.',
  },
  {
    titulo: 'Origen a destino',
    texto: 'El expediente de una carga desde la faena hasta el puerto de llegada, con los '
      + 'documentos que cada frontera pide y los que faltan a la vista.',
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
            <a href="#que-hacemos">Qué hacemos</a>
            <a href="#como">Cómo funciona</a>
            <a href="#agenda">Agenda</a>
            <a href="#contacto">Contacto</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="contenedor hero-inner">
          <div>
            <LogoAntai variante="completo" tono="claro" alto={190} />
          </div>
          <div>
            <h1>El futuro del mundo comienza aquí</h1>
            <p className="bajada">
              Capacitamos en CBAM y preparamos la evidencia industrial que tu comprador,
              tu auditor y tu banco van a pedirte. En Antofagasta, con proveedores mineros
              que ya están exportando.
            </p>
            <div className="hero-acciones">
              <a className="boton boton-primario" href="#agenda">Ver próximas fechas</a>
              <a className="boton boton-borde" href="#que-hacemos">Qué hacemos</a>
            </div>
          </div>
        </div>
      </section>

      <section className="seccion" id="que-hacemos">
        <div className="contenedor">
          <h2>Qué hacemos</h2>
          <p className="entrada">
            No vendemos software ambiental. Vendemos que una operación industrial quede
            documentada de forma que un tercero pueda usarla sin volver a preguntar nada.
          </p>
          <div className="rejilla">
            {QUE_HACEMOS.map((c) => (
              <article className="tarjeta" key={c.titulo}>
                <h3>{c.titulo}</h3>
                <p>{c.texto}</p>
              </article>
            ))}
          </div>

          <div className="tarjeta" style={{ marginTop: 26, borderLeft: '4px solid var(--cobre)' }}>
            <h3>Lo que todavía no hacemos, y lo decimos</h3>
            <p>
              Antai <strong>no verifica ni certifica</strong> declaraciones CBAM. Verificar exige
              acreditación bajo ISO 17029 / 14065 y una separación de roles que estamos
              construyendo, no dando por hecha. Hoy preparamos la evidencia para que un
              verificador acreditado la use — y decimos con claridad hasta dónde llega
              cada dato.
            </p>
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
