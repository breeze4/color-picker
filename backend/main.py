"""Palette Wheel backend.

Serves the static frontend and a read-only health endpoint. The app can
run behind a path prefix, set with the PALETTE_WHEEL_ROOT_PATH variable,
so a reverse proxy can mount it under a sub-path.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

FRONTEND_DIR = Path(
    os.environ.get("PALETTE_WHEEL_FRONTEND_DIR", Path(__file__).resolve().parent.parent / "frontend")
)
ROOT_PATH = os.environ.get("PALETTE_WHEEL_ROOT_PATH", "")

app = FastAPI(title="Palette Wheel", root_path=ROOT_PATH, docs_url=None, redoc_url=None)


@app.get("/api/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "palette-wheel"})


@app.get("/")
def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="frontend")
