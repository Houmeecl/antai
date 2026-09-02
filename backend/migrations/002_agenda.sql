-- ============================================================
-- 002 — Agenda: eventos con cupo y reservas.
--
-- LA DECISIÓN QUE ORDENA ESTE ARCHIVO: `cupo` NULL significa SIN LÍMITE,
-- no cero. Son cosas distintas y confundirlas cierra la inscripción de
-- todos los eventos que no tienen tope. Es la misma regla que gobierna
-- todo el producto: la ausencia de un dato no es el valor cero.
--
-- DATOS PERSONALES. `reservas` guarda nombre, correo y teléfono. Está
-- declarado en docs/DATOS-PERSONALES.md con su finalidad y su plazo —la
-- Ley 21.719 aplica desde la primera fila, y documentarlo después
-- significa tener datos sin base.
-- ============================================================

CREATE TABLE IF NOT EXISTS eventos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       TEXT NOT NULL,
  descripcion  TEXT,
  ciudad       TEXT NOT NULL,
  lugar        TEXT,
  modalidad    TEXT NOT NULL DEFAULT 'presencial'
                 CHECK (modalidad IN ('presencial','online','mixta')),

  -- Con hora, no solo fecha: una charla a las 09:00 y otra a las 18:00 del
  -- mismo día son eventos distintos para quien viaja desde otra ciudad.
  inicia_at    TIMESTAMPTZ NOT NULL,
  termina_at   TIMESTAMPTZ,

  -- NULL = sin límite. El CHECK impide el 0, que sería un evento al que
  -- nadie puede entrar: si no se quiere gente, se despublica.
  cupo         INT CHECK (cupo IS NULL OR cupo > 0),

  -- Separa el borrador de lo que ve el mundo. Un evento a medio cargar no
  -- aparece en la portada mientras se decide, y tampoco se puede reservar
  -- aunque alguien adivine el id.
  publicado    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT eventos_termino_despues CHECK (termina_at IS NULL OR termina_at > inicia_at)
);

-- La portada pide exactamente esto: publicados, ordenados por fecha.
CREATE INDEX IF NOT EXISTS eventos_publicados_idx
  ON eventos (inicia_at) WHERE publicado = true;

CREATE TABLE IF NOT EXISTS reservas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,

  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  empresa     TEXT,
  telefono    TEXT,

  -- Token de cancelación: va en el correo de confirmación y es la única
  -- credencial de quien reserva. Por eso es aleatorio y largo — adivinarlo
  -- sería cancelarle la inscripción a otra persona.
  token       TEXT NOT NULL,

  estado      TEXT NOT NULL DEFAULT 'reservada'
                CHECK (estado IN ('reservada','asistio','no_asistio','cancelada')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelada_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS reservas_token_uq ON reservas (token);

-- Un correo no toma dos veces el mismo evento. PARCIAL a propósito: al
-- cancelar, la fila deja de ocupar el índice y la persona puede volver a
-- inscribirse. Un UNIQUE total la dejaría afuera para siempre por haberse
-- arrepentido una vez.
CREATE UNIQUE INDEX IF NOT EXISTS reservas_una_por_evento_uq
  ON reservas (evento_id, lower(email)) WHERE estado <> 'cancelada';

-- Contar los cupos tomados de un evento es la consulta más caliente del
-- sistema: ocurre en cada visita a la portada y en cada reserva.
CREATE INDEX IF NOT EXISTS reservas_evento_idx ON reservas (evento_id) WHERE estado <> 'cancelada';
