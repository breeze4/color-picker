#!/usr/bin/env bash
# Starts the backend with auto-reload on http://127.0.0.1:8080
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -x backend/.venv/bin/python ]]; then
  uv venv --python 3.12 backend/.venv
  uv pip install --quiet --python backend/.venv/bin/python -r backend/requirements-dev.txt
fi
exec backend/.venv/bin/python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port "${PORT:-8080}" --reload
