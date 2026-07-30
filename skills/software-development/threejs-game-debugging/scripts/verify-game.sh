#!/usr/bin/env bash
# Quick verification script for Three.js browser games
# Checks: missing files, EventBus consistency, HTML routing, shader deprecations

set -e

SRC_DIR="src"
PROJECT_ROOT="."

echo "=== Missing Import Files ==="
MISSING=0
for file in $(grep -rh "^import.*from" "$SRC_DIR/" | grep -oP "(?<=[\"'])([^.\"'][^'\"]+)(?=['\"])" | sort -u); do
  if [ ! -f "${SRC_DIR}/${file}" ]; then
    echo "✗ MISSING: ${file}"
    MISSING=$((MISSING + 1))
  fi
done
if [ $MISSING -eq 0 ]; then
  echo "✓ All imports resolved"
fi

echo ""
echo "=== EventBus Consistency ==="
EMITS=$(grep -rn "EventBus\.emit" "$SRC_DIR/" | wc -l)
LISTENS=$(grep -rn "EventBus\.on" "$SRC_DIR/" | wc -l)
echo "Emit count: $EMITS"
echo "Listen count: $LISTENS"

echo ""
echo "=== Shader Deprecations ==="
if grep -rn "texture2D" "$SRC_DIR/" 2>/dev/null; then
  echo "⚠ Found texture2D (deprecated in Three.js r125+)"
else
  echo "✓ No deprecated shader APIs"
fi

echo ""
echo "=== HTML Routing ==="
if [ -f "vite.config.js" ]; then
  OPEN_PATH=$(grep -A1 "open:" vite.config.js | grep -oP "(?<=[\"'])([^\"']+)(?=['\"])" | head -1)
  echo "Vite open path: $OPEN_PATH"
fi

if ls public/*.html 2>/dev/null; then
  echo "✓ Entry points in public/"
else
  echo "⚠ No HTML files found in public/"
fi

echo ""
echo "=== Scene Disposal Check ==="
if grep -rn "\.dispose()" "$SRC_DIR/" | grep -q "geometry\|material"; then
  echo "✓ Found dispose calls for geometries/materials"
else
  echo "⚠ No geometry/material disposal found (potential memory leak)"
fi

echo ""
echo "Done."
