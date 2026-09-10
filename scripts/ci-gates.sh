#!/usr/bin/env bash
# Runs every check for the project: backend tests and frontend tests.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -x backend/.venv/bin/python ]]; then
  uv venv --python 3.12 backend/.venv
fi
uv pip install --quiet --python backend/.venv/bin/python -r backend/requirements-dev.txt
(cd backend && .venv/bin/python -m pytest -q)

(cd frontend && node --test 'test/*.test.mjs')
