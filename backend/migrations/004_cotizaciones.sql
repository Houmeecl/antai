-- ============================================================
-- 004 — Cotizaciones y pagos.
--
-- LA PLATA SE GUARDA EN PESOS ENTEROS. `BIGINT`, no `NUMERIC` ni
-- `FLOAT`. El peso chileno no tiene decimales, y un float haría que
-- 0.1 + 0.2 apareciera en un documento que alguien firma. El único
-- redondeo del sistema es el del IVA, y ocurre en un solo lugar
-- (services/cotizacion.js) para que dé siempre lo mismo.
--
-- LOS TOTALES SE GUARDAN, NO SE RECALCULAN AL LEER. Una cotización
-- enviada es una oferta: si mañana cambia el IVA o se corrige un precio
-- de lista, el documento que la otra parte recibió tiene que seguir
-- diciendo lo mismo. Por eso el total viaja en la fila y no se deriva.
-- ============================================================

CREATE TABLE IF NOT EXISTS cotizaciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Folio legible: COT-2026-0001. Lo que la otra parte va a citar por
  -- teléfono. El id no sirve para eso.
  folio        TEXT NOT NULL,

  contacto_id  UUID NOT NULL REFERENCES contactos(id) ON DELETE RESTRICT,

  -- RESTRICT y no CASCADE a propósito: una cotización enviada es un
  -- compromiso comercial. Que se borre sola porque alguien depuró el CRM
  -- sería perder la única constancia de lo que se ofreció y a qué precio.

  titulo       TEXT NOT NULL,
  glosa        TEXT,

  -- Copia del destinatario tal como estaba al emitir. Si el contacto
  -- cambia de empresa el mes que viene, el documento sigue diciendo a
  -- quién se le ofreció.
  cliente_nombre TEXT NOT NULL,
  cliente_email  TEXT NOT NULL,
  cliente_empresa TEXT,
  cliente_rut     TEXT,

  neto         BIGINT NOT NULL DEFAULT 0 CHECK (neto >= 0),
  iva          BIGINT NOT NULL DEFAULT 0 CHECK (iva >= 0),
  total        BIGINT NOT NULL DEFAULT 0 CHECK (total >= 0),
  -- Se guarda la tasa con que se calculó, no la vigente. Si el IVA
  -- cambia, las cotizaciones viejas siguen cuadrando.
  tasa_iva     NUMERIC(5,2) NOT NULL DEFAULT 19.00,

  estado       TEXT NOT NULL DEFAULT 'borrador'
                 CHECK (estado IN ('borrador','enviada','aceptada','rechazada','vencida')),

  -- Hasta cuándo vale la oferta. 'vencida' NO se escribe sola en la base:
  -- se deriva de esta fecha al leer (ver services/cotizacion.js). Una
  -- tarea que reescriba filas por el paso del tiempo produce estados que
  -- nadie decidió y que no se pueden explicar.
  valida_hasta DATE,

  -- Enlace público para verla y aceptarla. Es la única credencial de la
  -- otra parte: aleatorio y largo.
  token        TEXT NOT NULL,

  enviada_at   TIMESTAMPTZ,
  aceptada_at  TIMESTAMPTZ,
  -- Quién aceptó, en sus palabras, y desde dónde. Sin esto, «aceptada» es
  -- una casilla que alguien marcó y no una constancia.
  aceptada_por TEXT,
  aceptada_ip  TEXT,
  rechazada_at TIMESTAMPTZ,
  motivo_rechazo TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cotizaciones_folio_uq ON cotizaciones (folio);
CREATE UNIQUE INDEX IF NOT EXISTS cotizaciones_token_uq ON cotizaciones (token);
CREATE INDEX IF NOT EXISTS cotizaciones_contacto_idx ON cotizaciones (contacto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cotizaciones_estado_idx ON cotizaciones (estado, created_at DESC);

CREATE TABLE IF NOT EXISTS cotizacion_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id  UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,

  descripcion    TEXT NOT NULL,
  cantidad       NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario BIGINT NOT NULL CHECK (precio_unitario >= 0),
  -- El subtotal se guarda calculado. Es redundante a propósito: es lo que
  -- se imprimió, y tiene que sobrevivir a cualquier cambio de redondeo.
  subtotal       BIGINT NOT NULL CHECK (subtotal >= 0),
  orden          INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS cotizacion_items_idx ON cotizacion_items (cotizacion_id, orden);

-- ---------- Pagos ----------
--
-- UN PAGO ES UN HECHO, NO UN ESTADO DE LA COTIZACIÓN. Se registran los
-- abonos, y lo que se debe se calcula sumando: así un pago en dos cuotas
-- —que es lo normal— no obliga a inventar estados intermedios.
CREATE TABLE IF NOT EXISTS pagos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE RESTRICT,

  monto         BIGINT NOT NULL CHECK (monto > 0),
  medio         TEXT NOT NULL DEFAULT 'transferencia'
                  CHECK (medio IN ('transferencia','pasarela','efectivo','otro')),

  -- 'pendiente' es un pago que la otra parte dice haber hecho y que
  -- todavía nadie vio en la cuenta. Marcarlo 'confirmado' es un acto
  -- humano con nombre y fecha: dar por pagado lo que no se comprobó es
  -- exactamente el error que este campo evita.
  estado        TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','confirmado','anulado')),

  referencia    TEXT,   -- número de transferencia, id de la pasarela
  pagado_at     TIMESTAMPTZ,
  confirmado_at TIMESTAMPTZ,
  confirmado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  nota          TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pagos_cotizacion_idx ON pagos (cotizacion_id, created_at);
CREATE INDEX IF NOT EXISTS pagos_pendientes_idx ON pagos (created_at DESC) WHERE estado = 'pendiente';
