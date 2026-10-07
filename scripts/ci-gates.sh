#!/bin/sh
# Every check that color-picker must pass. The check workflow runs
# `bash scripts/ci-gates.sh all` inside the shared BeeBaby CI image, and
# `sh scripts/ci-local.sh all` runs the same command in the same image on your
# machine. scripts/stamp-ci.py stamps this file only when the repository has
# none, so add the project's own checks to gate_project.
#
# Usage: bash scripts/ci-gates.sh [workflows|project|all]
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

usage() {
  printf '%s\n' "Usage: bash scripts/ci-gates.sh [workflows|project|all]" >&2
}

# Woodpecker gives ghcr_token to plugin steps only. The check reads every
# workflow file, the main-only publish and deploy workflows too, so a pull
# request fails before main does.
gate_workflows() {
  python3 "$root/scripts/check-ghcr-token.py" "$root"
}

# The backend tests, the frontend tests, and the service-side deployment
# contract.
gate_project() {
  if [ ! -x "$root/backend/.venv/bin/python" ]; then
    uv venv --python 3.12 "$root/backend/.venv"
  fi
  uv pip install --quiet --python "$root/backend/.venv/bin/python" \
    -r "$root/backend/requirements-dev.txt"
  (cd "$root/backend" && .venv/bin/python -m pytest -q)
  (cd "$root/frontend" && node --test 'test/*.test.mjs')
  sh "$root/scripts/check-deployment.sh"
}

target="${1:-all}"

case "$target" in
  workflows) gate_workflows ;;
  project) gate_project ;;
  all)
    gate_workflows
    gate_project
    ;;
  *)
    usage
    exit 2
    ;;
esac
