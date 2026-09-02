-- ============================================================
-- 001 — Base: administradores.
--
-- Solo hay UN tipo de cuenta y es la del equipo de Antai. Quien reserva
-- una fecha NO tiene cuenta: dar de alta un usuario para inscribirse a
-- una charla es pedirle una contraseña a alguien que solo quería ir el
-- jueves. La reserva se identifica con un token de un solo uso que va en
-- su correo (ver 002).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  -- Hash bcrypt. La columna se llama así y no `password` para que quede
  -- claro en cada SELECT que acá nunca hubo una clave en claro.
  clave_hash    TEXT NOT NULL,
  -- El primer admin nace con una clave que estuvo escrita en un .env, o
  -- sea que ya no es secreta. Se le exige cambiarla antes de hacer nada.
  debe_cambiar  BOOLEAN NOT NULL DEFAULT false,
  activo        BOOLEAN NOT NULL DEFAULT true,
  ultimo_acceso TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Único por correo en minúsculas: "Ana@antai.cl" y "ana@antai.cl" son la
-- misma persona, y dos filas para la misma persona son dos contraseñas
-- distintas que abren la misma puerta.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_uq ON usuarios (lower(email));
