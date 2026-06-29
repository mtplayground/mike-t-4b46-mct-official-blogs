#!/bin/bash
set -euo pipefail

cd /opt/app

if [ -f /opt/app/.env.production ]; then
  set -a
  . /opt/app/.env.production
  set +a
fi

export PATH="$HOME/.cargo/bin:/usr/local/cargo/bin:$PATH"
export RUST_LOG="${RUST_LOG:-info}"
export RUST_API_BASE_URL="${RUST_API_BASE_URL:-http://127.0.0.1:8081}"

cleanup() {
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

PORT=8081 /opt/app/rust-backend/target/release/mct-official-blogs-backend &
BACKEND_PID=$!

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8081/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

export PORT="${PORT:-8080}"
exec npm run start
