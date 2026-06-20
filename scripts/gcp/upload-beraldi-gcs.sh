#!/usr/bin/env bash
set -euo pipefail
# Sube fotos Beraldi a GCS con nombres sin espacios (7 train + 2 test de 9 fotos)
SRC="/Users/ralborta/Andreu/Beraldi"
BUCKET="gs://kiev-prueba-docai-remitos/beraldi"

TRAIN=(
  "WhatsApp Image 2026-06-18 at 14.48.33.jpeg"
  "WhatsApp Image 2026-06-18 at 14.48.34.jpeg"
  "WhatsApp Image 2026-06-18 at 14.48.35.jpeg"
  "WhatsApp Image 2026-06-18 at 14.48.36.jpeg"
  "WhatsApp Imag 2026-06-18 at 14.48.36.jpeg"
  "Remito Beraldi 2.jpg"
  "Remito Beraldi 3.jpg"
)
TEST=(
  "WhatsApp Image 2026-06-18 at 14.48.37.jpeg"
  "Remito Beraldi 4.jpg"
)

i=1
for f in "${TRAIN[@]}"; do
  gcloud storage cp "$SRC/$f" "${BUCKET}/train/beraldi-train-$(printf '%02d' $i).jpg" --quiet
  i=$((i+1))
done
i=1
for f in "${TEST[@]}"; do
  gcloud storage cp "$SRC/$f" "${BUCKET}/test/beraldi-test-$(printf '%02d' $i).jpg" --quiet
  i=$((i+1))
done

echo "Subidas: ${#TRAIN[@]} train + ${#TEST[@]} test"
gsutil ls -r "${BUCKET}/"
