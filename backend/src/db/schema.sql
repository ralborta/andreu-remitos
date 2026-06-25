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

-- Parámetros maestros (Postgres — futuro; hoy file-store parametros.json)
CREATE TABLE IF NOT EXISTS choferes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant VARCHAR(20) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  telefono VARCHAR(30),
  documento VARCHAR(20),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_choferes_tenant ON choferes(tenant);

CREATE TABLE IF NOT EXISTS unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant VARCHAR(20) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  patente VARCHAR(20) NOT NULL,
  unidad_interna VARCHAR(20),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_unidades_tenant ON unidades(tenant);

CREATE TABLE IF NOT EXISTS localidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant VARCHAR(20) NOT NULL,
  codigo VARCHAR(32),
  nombre VARCHAR(200) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'ambos',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_localidades_tenant ON localidades(tenant);

CREATE TABLE IF NOT EXISTS distancias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant VARCHAR(20) NOT NULL,
  origen_id UUID NOT NULL REFERENCES localidades(id),
  destino_id UUID NOT NULL REFERENCES localidades(id),
  km INTEGER NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_distancias_tenant ON distancias(tenant);
