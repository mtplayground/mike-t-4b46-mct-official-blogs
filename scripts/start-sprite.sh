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
export PORT="${PORT:-8080}"
export APP_ROOT="${APP_ROOT:-/opt/app}"

exec /opt/app/rust-backend/target/release/ideavibes-official-blog-backend
