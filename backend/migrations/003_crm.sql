-- ============================================================
-- 003 — CRM: a quién le estamos vendiendo y en qué va.
--
-- POR QUÉ EL CONTACTO ES UNA TABLA APARTE DE `reservas`. Una reserva es
-- un hecho —esta persona tomó este cupo este día— y no cambia nunca. Un
-- contacto es una relación que sí cambia: avanza en el embudo, se le
-- cotiza, paga, o se enfría. Guardar las dos cosas en la misma fila
-- obligaría a reescribir el hecho cada vez que cambia la relación, y con
-- eso se pierde el historial de lo que realmente pasó.
--
-- La reserva ENGANCHA a un contacto (por correo) en vez de reemplazarlo:
-- quien vino a una charla queda en el CRM sin que nadie lo copie a mano,
-- que es la mitad del valor de tener agenda y CRM en el mismo lugar.
--
-- DATOS PERSONALES: acá vive lo más sensible del sistema. Declarado en
-- docs/DATOS-PERSONALES.md con finalidad y plazo.
-- ============================================================

CREATE TABLE IF NOT EXISTS contactos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  telefono    TEXT,
  cargo       TEXT,

  empresa     TEXT,
  -- RUT de la empresa, normalizado sin puntos ni guion, para que el cruce
  -- sea por igualdad y no por LIKE. Puede faltar: un contacto de una
  -- charla todavía no dio su RUT y sigue siendo un contacto.
  rut_empresa TEXT,
  ciudad      TEXT,

  -- De dónde salió. Sirve para saber qué está trayendo gente de verdad,
  -- que es la pregunta que decide dónde poner el esfuerzo.
  origen      TEXT NOT NULL DEFAULT 'otro'
                CHECK (origen IN ('agenda','portada','referido','visita','licitacion','otro')),

  -- El embudo. 'perdido' NO se borra: saber a quién se perdió y por qué
  -- vale más que la lista limpia.
  estado      TEXT NOT NULL DEFAULT 'nuevo'
                CHECK (estado IN ('nuevo','contactado','reunion','cotizado','cliente','perdido')),
  motivo_perdida TEXT,

  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un correo es una persona. Sin esto, la misma persona que va a dos
-- charlas aparece dos veces y el embudo cuenta doble.
CREATE UNIQUE INDEX IF NOT EXISTS contactos_email_uq ON contactos (lower(email));
CREATE INDEX IF NOT EXISTS contactos_estado_idx ON contactos (estado, updated_at DESC);
CREATE INDEX IF NOT EXISTS contactos_rut_idx ON contactos (rut_empresa) WHERE rut_empresa IS NOT NULL;

-- La reserva apunta al contacto. ON DELETE SET NULL: si alguien ejerce
-- su derecho de supresión y se borra el contacto, la reserva sobrevive
-- como hecho anonimizado —el cupo se ocupó igual— en vez de desaparecer
-- y descuadrar el conteo de una actividad que ya ocurrió.
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS contacto_id UUID
  REFERENCES contactos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS reservas_contacto_idx ON reservas (contacto_id);

-- ---------- Bitácora ----------
-- Cada cosa que pasó con un contacto, en orden. Es lo que permite que
-- alguien distinto retome la conversación sin preguntar «¿en qué
-- quedamos?».
CREATE TABLE IF NOT EXISTS interacciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contacto_id UUID NOT NULL REFERENCES contactos(id) ON DELETE CASCADE,
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,

  tipo        TEXT NOT NULL
                CHECK (tipo IN ('nota','llamada','correo','reunion','cotizacion','pago','estado')),
  detalle     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interacciones_contacto_idx
  ON interacciones (contacto_id, created_at DESC);
