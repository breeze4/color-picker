# Lessons

## 2026-09-10 — Palette Wheel first build

- Lesson: To clone a web tool, download its compiled script and read the
  math from the source instead of relying on third-party reverse
  engineering. Paletton's `app.compiled.js` holds the exact anchor table,
  shade formula, and all 24 presets. The public reconstructions on GitHub
  only approximate them.
- Lesson: Confirm the math against the live page before building the
  UI. Reading the computed swatch colors from the DOM gave reference
  vectors for the unit tests.
- Lesson: When the reverse conversion picks a segment by which channel
  is the max and which is the min, handle ties by the max and min index
  and not by searching for a distinct middle value.
