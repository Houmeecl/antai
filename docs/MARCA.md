# La marca

## El símbolo: ™, no ®

El logotipo lleva **™** por defecto. El **®** afirma que la marca está
inscrita, y mientras no exista el certificado de INAPI esa es una
afirmación que no se puede sostener.

Cuando llegue el registro se pasa `marca="r"` al componente y no hay que
redibujar nada.

## Los tres encajes

| Encaje | Cuándo | Qué muestra |
|---|---|---|
| `completo` | Portada, portadas de documento, pendones | Marco + ANTAI / MINERAL / MARK |
| `horizontal` | Barra de navegación, correos, firmas | Marco con AMM + la marca en una línea |
| `monograma` | Favicon, PWA, sellos | Marco + AMM, o la inicial bajo 28 px |

### Dos cosas que se comprobaron dibujándolas

**Las tres líneas se justifican al mismo ancho, con cuerpos distintos.**
`MINERAL` tiene siete letras y `MARK` cuatro. Forzarlas al mismo ancho con
el mismo cuerpo obliga a un espaciado negativo: las letras se montan y la
palabra se vuelve una mancha. Se probó y se vio. Con un cuerpo menor en la
línea larga, las tres llegan al mismo ancho con una deformación suave.

Efecto secundario, y el más valioso: **el logo se ve igual aunque la
tipografía no cargue**, porque el ancho lo fija el SVG y no la fuente.

**El monograma se reduce a la inicial bajo 28 px.** «AMM» dentro de un
marco no cabe en dieciséis puntos por mucho que se apriete — a ese tamaño
era una mancha. El favicon está dibujado directamente para 16 px.

## La paleta

| Token | Valor | Para qué |
|---|---|---|
| `--tierra` | `#4a2c1d` | Tinta, fondos oscuros |
| `--cobre` | `#a54a19` | Acento, enlaces, botones, **texto** |
| `--cobre-vivo` | `#b4531f` | Solo titulares grandes |
| `--arena` | `#f6efe6` | Fondo |
| `--adobe` | `#c98a5b` | Bordes y apoyos. **Nunca texto.** |
| `--piedra` | `#6b5b4e` | Texto secundario |

### Contraste medido, no estimado

```
tierra   sobre arena  → 11.03:1  AAA
blanco   sobre tierra → 12.58:1  AAA
piedra   sobre arena  →  5.70:1  AA
cobre    sobre arena  →  5.12:1  AA
blanco   sobre cobre  →  5.84:1  AA
```

**El cobre de la imagen de referencia era `#b4531f` y no pasaba: 4.39:1,
justo bajo el 4.5 que exige AA.** Se oscureció a `#a54a19` para texto, y
el vivo quedó para titulares grandes, donde el mínimo es 3:1.

`--adobe` está en 2.53:1 — sirve de borde y de acento gráfico, nunca de
color de texto.

## Reglas de escritura

- Español de Chile.
- **Emoji jamás como ícono de interfaz.**
- Una imagen de producto es una captura real, nunca un dibujo.
- Nunca se afirma que Antai verifica, certifica, acredita o aprueba.
