# Palette Wheel

A color palette tool with an artistic (RYB) color wheel, five shades per
color, and a one-click Markdown export. It reproduces the color math of
paletton.com without the ads.

## Run

To start the page, run the following command and open
`http://localhost:8080`:

```
pnpm start
```

The page is static HTML, CSS, and ES modules. Any static file server
works. Opening `index.html` from the file system does not work because
browsers block ES modules on `file://` URLs.

## Use

1. Click a scheme: **Mono**, **Analog**, **Triad**, or **Tetrad**.
2. Drag the large dot on the outer ring to set the base hue. Drag a small
   ring dot to set the angle between hues.
3. Drag the dots inside the wheel to set the five shades. The large dot
   moves all five. Or pick a preset from the **Shades** list.
4. Click **Export** and then **Copy** to get the palette as Markdown,
   CSS, or JSON. Click any swatch to copy its hex.

The square above the swatches shows the scheme colors together, the
same way the paletton.com preview does.

The URL holds the whole palette. Copy the URL to save or share it.

## Test

To run the unit tests, run:

```
pnpm test
```

The tests compare the wheel and shade math against values read from
paletton.com.

## Layout

- `index.html`, `css/style.css`: the page.
- `js/color.js`: RYB wheel math and conversions.
- `js/presets.js`: the shade preset table.
- `js/field.js`: geometry of the inner shade disc.
- `js/palette.js`: scheme logic, export text, and URL state.
- `js/app.js`: canvas drawing and UI events.
- `docs/2026-09-10-01-spec.md`: the specification.
