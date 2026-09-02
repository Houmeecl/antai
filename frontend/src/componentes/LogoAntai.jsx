// ============================================================
// Logotipo de Antai Mineral Mark.
//
// EN SVG, Y NO EN TEXTO CON CSS. Un logo hecho de <span> no sirve de
// favicon, no entra en un PDF, y se descuadra en cuanto la tipografía no
// está instalada. En SVG es una sola pieza que escala de 16 px a un
// pendón.
//
// LAS TRES LÍNEAS SE JUSTIFICAN AL MISMO ANCHO, y eso no es capricho.
// En la imagen de referencia ANTAI, MINERAL y MARK tienen anchos
// distintos y el marco queda con aire desparejo. Acá cada línea lleva
// `textLength` con `lengthAdjust="spacing"`: el navegador reparte el
// espacio entre letras hasta que las tres midan exactamente lo mismo.
// Como efecto secundario —el más valioso— el logo se ve IGUAL aunque la
// tipografía no esté disponible: el ancho lo fija el SVG, no la fuente.
//
// EL SÍMBOLO POR DEFECTO ES ™, NO ®. El ® afirma que la marca está
// inscrita; mientras no esté el certificado de INAPI, eso es una
// afirmación que no se puede sostener. Cuando llegue, se pasa
// marca="r" y no hay que redibujar nada.
// ============================================================

// Cada línea con su tamaño, y las tres estiradas al MISMO ancho.
//
// POR QUÉ NO TODAS AL MISMO TAMAÑO: 'MINERAL' tiene 7 letras y 'MARK'
// tiene 4. Forzarlas al mismo ancho con el mismo cuerpo obliga a un
// espaciado negativo en la línea larga —las letras se montan unas sobre
// otras y la palabra se vuelve ilegible—. Se probó y se vio: MINERAL
// salía como una mancha. Con un cuerpo menor en la línea larga, las tres
// llegan al mismo ancho con una deformación suave en cada una.
//
// `spacingAndGlyphs` en vez de `spacing`: reparte el ajuste entre el
// espacio Y el ancho de las letras, en lugar de cargarlo todo al espacio.
const PILA = [
  { texto: 'ANTAI', cuerpo: 27 },
  { texto: 'MINERAL', cuerpo: 21 },
  { texto: 'MARK', cuerpo: 27 },
];

// Ancho útil dentro del marco. Las tres líneas se estiran hasta este
// valor exacto.
const ANCHO_TEXTO = 88;

const FUENTE = '"Archivo Black", "Arial Black", Impact, "Helvetica Neue", Helvetica, Arial, sans-serif';

function Simbolo({ marca, x, y, tam, color }) {
  if (marca === 'ninguna') return null;
  return (
    <text
      x={x} y={y} fill={color} fontFamily={FUENTE}
      fontSize={tam} fontWeight="700" opacity="0.85"
    >
      {marca === 'r' ? '®' : '™'}
    </text>
  );
}

export default function LogoAntai({
  variante = 'completo',
  tono = 'oscuro',          // 'oscuro' = tinta sobre fondo claro · 'claro' = blanco sobre fondo oscuro
  marca = 'tm',             // 'tm' | 'r' | 'ninguna'
  alto = 96,
  titulo = 'Antai Mineral Mark',
  ...resto
}) {
  const color = tono === 'claro' ? '#ffffff' : 'var(--tierra, #4a2c1d)';
  const trazo = Math.max(2, Math.round(alto / 24));

  if (variante === 'monograma') {
    // A 16 px, «AMM» es una mancha: tres letras dentro de un marco no
    // caben en 16 puntos por mucho que uno las apriete. Se comprobó
    // dibujándolo. Debajo de 28 px el monograma se reduce a la inicial,
    // que a ese tamaño sí se distingue de cualquier otro ícono de la
    // barra del navegador —que es lo único que un favicon tiene que
    // lograr—.
    const chico = alto <= 28;
    const letras = chico ? 'A' : 'AMM';
    return (
      <svg
        viewBox="0 0 100 100" height={alto} width={alto}
        role="img" aria-label={titulo} {...resto}
      >
        <title>{titulo}</title>
        <rect
          x={trazo} y={trazo} width={100 - trazo * 2} height={100 - trazo * 2}
          fill="none" stroke={color} strokeWidth={chico ? 10 : trazo * 1.6}
        />
        <text
          x="50" y={chico ? 54 : 50} fill={color} fontFamily={FUENTE}
          fontSize={chico ? 58 : 34} fontWeight="900"
          textAnchor="middle" dominantBaseline="central"
          textLength={chico ? 42 : 66} lengthAdjust="spacingAndGlyphs"
        >
          {letras}
        </text>
      </svg>
    );
  }

  if (variante === 'horizontal') {
    return (
      <svg
        viewBox="0 0 340 76" height={alto} width={(alto * 340) / 76}
        role="img" aria-label={titulo} {...resto}
      >
        <title>{titulo}</title>
        <rect x="3" y="3" width="70" height="70" fill="none" stroke={color} strokeWidth="5" />
        <text
          x="38" y="38" fill={color} fontFamily={FUENTE} fontSize="25" fontWeight="900"
          textAnchor="middle" dominantBaseline="central"
          textLength="48" lengthAdjust="spacingAndGlyphs"
        >
          AMM
        </text>
        <text
          x="90" y="38" fill={color} fontFamily={FUENTE} fontSize="21" fontWeight="800"
          dominantBaseline="central" textLength="222" lengthAdjust="spacing"
        >
          ANTAI MINERAL MARK
        </text>
        <Simbolo marca={marca} x={318} y={20} tam={13} color={color} />
      </svg>
    );
  }

  // Completo: el marco con las tres líneas apiladas y justificadas.
  return (
    <svg
      viewBox="0 0 128 116" height={alto} width={(alto * 128) / 116}
      role="img" aria-label={titulo} {...resto}
    >
      <title>{titulo}</title>
      <rect x="3" y="3" width="106" height="110" fill="none" stroke={color} strokeWidth="5" />
      {PILA.map(({ texto, cuerpo }, i) => (
        <text
          key={texto}
          x="12" y={34 + i * 32}
          fill={color} fontFamily={FUENTE} fontSize={cuerpo} fontWeight="900"
          dominantBaseline="central"
          textLength={ANCHO_TEXTO} lengthAdjust="spacingAndGlyphs"
        >
          {texto}
        </text>
      ))}
      <Simbolo marca={marca} x={113} y={16} tam={11} color={color} />
    </svg>
  );
}
