#!/bin/bash
# Add inline background to html/body BEFORE any CSS loads

BG_COLOR="#f1f5f9" # slate-50 equivalent

for html in *.html; do
  # Check if already has inline style on html
  if grep -q '<html[^>]*style=' "$html"; then
    echo "⏭️  $html (already has inline styles)"
    continue
  fi
  
  # Add inline background to <html> tag
  perl -i -pe 's|(<html[^>]*)(>)|$1 style="background-color: '"$BG_COLOR"';"$2|' "$html"
  
  # Add inline background to <body> tag if it doesn't have it
  if ! grep -q '<body[^>]*style=' "$html"; then
    perl -i -pe 's|(<body[^>]*)(>)|$1 style="background-color: '"$BG_COLOR"';"$2|' "$html"
  fi
  
  echo "✅ $html"
done
