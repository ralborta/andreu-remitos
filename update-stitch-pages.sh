#!/bin/bash
FILES=(
  "frontend/src/app/(app)/finanzas/page.tsx"
  "frontend/src/app/(app)/finanzas/clientes/page.tsx"
  "frontend/src/app/(app)/finanzas/comunicacion/page.tsx"
  "frontend/src/app/(app)/finanzas/conciliacion/page.tsx"
  "frontend/src/app/(app)/finanzas/facturas/cobranzas/page.tsx"
  "frontend/src/app/(app)/finanzas/facturas/pagos/page.tsx"
  "frontend/src/app/(app)/marketing/page.tsx"
  "frontend/src/app/(app)/marketing/contenidos/page.tsx"
  "frontend/src/app/(app)/marketing/difusion/page.tsx"
  "frontend/src/app/(app)/marketing/email/page.tsx"
  "frontend/src/app/(app)/marketing/estrategia/page.tsx"
  "frontend/src/app/(app)/marketing/ofertas/page.tsx"
  "frontend/src/app/(app)/marketing/resultados/page.tsx"
  "frontend/src/app/(app)/marketing/visibilidad/page.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # Replace import line
    sed -i '/^import { StitchRedesignFrame }/d' "$file"
    # Replace return statement
    sed -i 's|return <StitchRedesignFrame path="[^"]*" />;|// Stitch iframe rendered by AppShell layout\n  return null;|' "$file"
    echo "✓ $file"
  fi
done
