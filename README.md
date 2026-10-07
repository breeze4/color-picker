# Palette Wheel

A color palette tool with an artistic (RYB) color wheel, five shades per
color, and a one-click Markdown export. It reproduces the color math of
paletton.com without the ads.

The frontend is live at https://breeze4.github.io/color-picker/ and
updates on every push to `main`.

## Layout

- `frontend/`: static HTML, CSS, and vanilla JavaScript ES modules. No
  build step.
- `backend/`: a FastAPI app that serves the frontend and a health
  endpoint at `/api/health`.
- `scripts/`: the dev server and the test gates.
- `docs/`: the specification and lessons.

## Run

To start the app with auto-reload, run the following command and open
`http://127.0.0.1:8080`:

```
scripts/dev.sh
```

The script creates `backend/.venv` with uv on the first run. Set `PORT`
to use another port.

## Test

To run the workflow check, the backend and frontend tests, and the
deployment contract check, run:

```
scripts/ci-gates.sh
```

To run the same gate in the pinned BeeBaby CI image, run
`sh scripts/ci-local.sh all`.

The `.woodpecker/` workflows come from the BeeBaby CI template in
`beebaby-infra`. A pull request runs `check.yaml`, which runs the gate,
and `build-image.yaml`, which builds the image with no secret and pushes
nothing. A push to `main` runs the same two workflows, then
`publish.yaml` pushes the image and `deploy.yaml` deploys it.

## Use

1. Click a scheme: **Mono**, **Analog**, **Triad**, or **Tetrad**.
2. Drag the large dot on the outer ring to set the base hue. Drag a small
   ring dot to set the angle between hues. Drag the complement dot to
   unlock **Free** mode, where every dot moves alone. Click a scheme
   button to lock the hues again.
3. Drag the numbered dots inside the wheel to set the five shades. Dot 0
   moves all five. Or pick a preset from the **Shades** list.
   The chips above the inner disc pick which color the dots edit. In
   Free mode each color keeps its own shades.
4. Click **Export** and then **Copy** to get the palette as Markdown,
   CSS, or JSON. Click any swatch to copy its hex.

The URL holds the whole palette. Copy the URL to save or share it.

## Hosting

The backend is a standard ASGI app. To serve it under a path prefix
behind a reverse proxy, set `PALETTE_WHEEL_ROOT_PATH` to that prefix.
To serve the frontend from another directory, set
`PALETTE_WHEEL_FRONTEND_DIR`. The frontend uses relative URLs, so it
works at any prefix. Start it in production with:

```
python -m uvicorn main:app --app-dir backend --host 0.0.0.0 --port 8080
```
