CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS remitos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant VARCHAR(20) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'recibido',
  telefono_chofer VARCHAR(30),
  imagen_path TEXT,
  texto_ocr TEXT,
  datos JSONB NOT NULL DEFAULT '{}',
  validacion JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remitos_estado ON remitos(estado);
CREATE INDEX IF NOT EXISTS idx_remitos_tenant ON remitos(tenant);
CREATE INDEX IF NOT EXISTS idx_remitos_created ON remitos(created_at DESC);
