#!/bin/bash
for f in finanzas/page.tsx finanzas/*/page.tsx marketing/page.tsx marketing/*/page.tsx; do
  if [ -f "$f" ]; then
    cat > "$f" << 'PAGEFILE'
export default function Page() {
  // Stitch iframe rendered by AppShell layout
  return null;
}
PAGEFILE
    echo "✓ $f"
  fi
done
