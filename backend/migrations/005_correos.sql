-- ============================================================
-- 005 — Correo: plantillas y bitácora de lo que salió.
--
-- POR QUÉ HAY BITÁCORA. Sin ella, «¿le mandaste la cotización?» solo se
-- responde de memoria. Con dos personas trabajando eso significa mandar
-- dos veces o ninguna, y las dos quedan mal.
--
-- SE REGISTRA EL DESTINATARIO PORQUE ES LA BITÁCORA, no un log de
-- servidor. Está bajo control de acceso del panel, tiene plazo de
-- retención declarado, y sirve para responder «¿qué se le dijo a esta
-- persona y cuándo?», que es una pregunta legítima del negocio y también
-- un derecho de acceso de esa persona.
--
-- LO QUE NO SE GUARDA ACÁ: nada de claves. Ningún correo del sistema
-- lleva una contraseña, y si alguna vez llevara, no se registraría el
-- cuerpo.
-- ============================================================

CREATE TABLE IF NOT EXISTS plantillas_correo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nombre estable con el que el código la pide. Cambia el texto, no la
  -- llave: así se puede reescribir un correo sin tocar una línea de JS.
  slug        TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  asunto      TEXT NOT NULL,

  -- Cuerpo con marcas {{nombre}}, {{folio}}, {{total}}… El reemplazo es
  -- literal y sin evaluar nada: una plantilla es texto, no código.
  cuerpo      TEXT NOT NULL,

  -- Qué marcas entiende esta plantilla, para que el panel las muestre en
  -- vez de obligar a adivinarlas.
  variables   TEXT[] NOT NULL DEFAULT '{}',
  editable    BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS plantillas_slug_uq ON plantillas_correo (slug);

CREATE TABLE IF NOT EXISTS correos_enviados (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  para         TEXT NOT NULL,
  asunto       TEXT NOT NULL,
  cuerpo       TEXT NOT NULL,
  plantilla    TEXT,

  -- A qué se refiere este correo. Los tres pueden ser NULL: un correo
  -- suelto a alguien que todavía no es contacto es un correo válido.
  contacto_id   UUID REFERENCES contactos(id) ON DELETE SET NULL,
  cotizacion_id UUID REFERENCES cotizaciones(id) ON DELETE SET NULL,
  reserva_id    UUID REFERENCES reservas(id) ON DELETE SET NULL,

  -- 'consola' NO es un fallo: es el modo de desarrollo, donde el correo
  -- se imprime en vez de enviarse. Distinguirlo de 'error' evita que
  -- alguien crea que el sistema está roto cuando solo no hay SMTP.
  estado       TEXT NOT NULL DEFAULT 'enviado'
                 CHECK (estado IN ('enviado','consola','error')),
  error        TEXT,

  enviado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS correos_contacto_idx ON correos_enviados (contacto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS correos_fecha_idx ON correos_enviados (created_at DESC);
-- Los que fallaron son los que hay que mirar: índice parcial.
CREATE INDEX IF NOT EXISTS correos_error_idx ON correos_enviados (created_at DESC) WHERE estado = 'error';

-- ---------- Plantillas iniciales ----------
-- ON CONFLICT DO NOTHING: si alguien ya las editó, esta migración no las
-- pisa. Sembrar no es reponer.
INSERT INTO plantillas_correo (slug, nombre, asunto, cuerpo, variables) VALUES
('reserva_confirmada', 'Confirmación de inscripción',
 'Tu cupo está tomado — {{actividad}}',
 E'Hola {{nombre}},\n\nTu cupo quedó tomado para «{{actividad}}».\n\nCuándo:  {{cuando}}\nDónde:   {{donde}}\nFormato: {{modalidad}}\n\nSi no vas a poder ir, libera el cupo acá y se lo damos a otra persona:\n{{enlace_cancelar}}\n\n— Antai Mineral Mark',
 ARRAY['nombre','actividad','cuando','donde','modalidad','enlace_cancelar']),

('cotizacion_enviada', 'Envío de cotización',
 'Cotización {{folio}} — {{titulo}}',
 E'Hola {{nombre}},\n\nTe enviamos la cotización {{folio}} por {{titulo}}.\n\nTotal: {{total}} (IVA incluido)\nVálida hasta: {{valida_hasta}}\n\nPuedes verla completa y aceptarla acá:\n{{enlace}}\n\nCualquier duda, responde este correo.\n\n— Antai Mineral Mark',
 ARRAY['nombre','folio','titulo','total','valida_hasta','enlace']),

('recordatorio_actividad', 'Recordatorio de actividad',
 'Mañana: {{actividad}}',
 E'Hola {{nombre}},\n\nTe recordamos que mañana es «{{actividad}}».\n\nCuándo: {{cuando}}\nDónde:  {{donde}}\n\nSi ya no puedes venir, avísanos acá para liberar tu cupo:\n{{enlace_cancelar}}\n\n— Antai Mineral Mark',
 ARRAY['nombre','actividad','cuando','donde','enlace_cancelar']),

('pago_recibido', 'Confirmación de pago',
 'Recibimos tu pago — {{folio}}',
 E'Hola {{nombre}},\n\nConfirmamos la recepción de {{monto}} por la cotización {{folio}}.\n\n{{saldo_texto}}\n\nGracias.\n\n— Antai Mineral Mark',
 ARRAY['nombre','folio','monto','saldo_texto'])
ON CONFLICT (slug) DO NOTHING;
