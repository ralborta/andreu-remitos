#!/bin/bash
# Add Material Symbols font preload to all HTMLs

FONT_PRELOAD='  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" as="style" onload="this.onload=null;this.rel='\''stylesheet'\''">\n  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"></noscript>'

for html in *.html; do
  # Skip if already has Material Symbols preload
  if grep -q 'rel="preload".*Material.Symbols' "$html"; then
    echo "⏭️  $html (already has preload)"
    continue
  fi
  
  # Add preload after <head> tag
  if grep -q '<head>' "$html"; then
    # Use perl for better multiline handling
    perl -i -pe 's|(<head>)|$1\n'"$FONT_PRELOAD"'|' "$html"
    echo "✅ $html"
  else
    echo "⚠️  $html (no <head> tag found)"
  fi
done
