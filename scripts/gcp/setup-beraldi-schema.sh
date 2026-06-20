#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
TOKEN=$(gcloud auth print-access-token)
BASE="https://us-documentai.googleapis.com/v1beta3/projects/kiev-prueba/locations/us/processors/a892de713a557488"

echo "1. Inicializar dataset (Google-managed) — omitir si ya existe..."
INIT=$(curl -sS -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "${BASE}/dataset?updateMask=unmanagedDatasetConfig,spannerIndexingConfig" \
  -d @"${ROOT}/dataset-init.json")
echo "$INIT" | python3 -m json.tool 2>/dev/null || echo "$INIT"

echo ""
echo "2. Esperando operación..."
sleep 10

echo "3. Crear schema con 14 campos..."
curl -sS -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "${BASE}/dataset/datasetSchema?updateMask=documentSchema" \
  -d @"${ROOT}/schema-beraldi.json" | python3 -m json.tool

echo ""
echo "Listo. Refrescá la consola → Editar esquema."
