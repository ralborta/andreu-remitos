#!/usr/bin/env bash
# Cancela operaciones de auto-etiquetado colgadas en Document AI Workbench
set -euo pipefail
TOKEN=$(gcloud auth print-access-token)
PROJECT_NUM=$(gcloud projects describe kiev-prueba --format='value(projectNumber)')
BASE="https://us-documentai.googleapis.com/v1/projects/${PROJECT_NUM}/locations/us/operations"

echo "Buscando auto-label en curso..."
OPS=$(curl -sS -G -H "Authorization: Bearer $TOKEN" -H "X-Goog-User-Project: kiev-prueba" \
  --data-urlencode "filter=State=RUNNING" --data-urlencode "pageSize=20" "$BASE")

echo "$OPS" | python3 -c "
import json,sys
ops=json.load(sys.stdin).get('operations',[])
found=False
for op in ops:
    typ=op.get('metadata',{}).get('@type','')
    if 'AutoLabel' in typ:
        print(op['name'])
        found=True
if not found:
    print('NONE')
"

NAME=$(echo "$OPS" | python3 -c "
import json,sys
for op in json.load(sys.stdin).get('operations',[]):
    if 'AutoLabel' in op.get('metadata',{}).get('@type',''):
        print(op['name']); break
")

if [[ -z "${NAME:-}" || "$NAME" == "NONE" ]]; then
  echo "No hay auto-label colgado."
  exit 0
fi

echo "Cancelando: $NAME"
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "X-Goog-User-Project: kiev-prueba" \
  "https://us-documentai.googleapis.com/v1/${NAME}:cancel"
echo ""
echo "Listo. Refrescá la consola en Chrome (Cmd+Shift+R)."
