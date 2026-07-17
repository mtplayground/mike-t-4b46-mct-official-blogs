#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
INPUT="$ROOT_DIR/assets/styles/input.css"
OUTPUT="$ROOT_DIR/public/assets/app.css"
CONFIG="$ROOT_DIR/tailwind.config.ts"

if [ ! -f "$INPUT" ]; then
  echo "Tailwind input not found: $INPUT" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

if [ -n "${TAILWINDCSS_BIN:-}" ]; then
  CLI="$TAILWINDCSS_BIN"
elif command -v tailwindcss >/dev/null 2>&1; then
  CLI="$(command -v tailwindcss)"
elif [ -x "$ROOT_DIR/node_modules/.bin/tailwindcss" ]; then
  CLI="$ROOT_DIR/node_modules/.bin/tailwindcss"
else
  echo "Tailwind CSS CLI not found. Install the standalone tailwindcss binary on PATH or set TAILWINDCSS_BIN." >&2
  exit 1
fi

"$CLI" -c "$CONFIG" -i "$INPUT" -o "$OUTPUT" --minify
