#!/usr/bin/env bash
# Importa fotos Beraldi desde GCS (archivo por archivo; el import por carpeta falla por bug de permisos GCP)
set -euo pipefail
python3 "$(dirname "$0")/import-beraldi-gcs.py"
