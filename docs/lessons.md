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
- Lesson: Put every state change behind a pure function in
  `frontend/js/palette.js` and keep `frontend/js/app.js` to events and drawing. Free mode
  went in as five pure functions with unit tests before the UI touched
  it.
- Lesson: When the user names a later step, such as a BeeBaby deploy,
  read only enough of that contract to keep the layout compatible.
  Stop before adding its files. Here that meant a health endpoint and a
  root-path setting, not a Dockerfile or workflows.
- Lesson: Never stop a process by name pattern. A `pkill -f` on the app
  name killed the user's own reload server. Start test servers on a
  port the user does not use, keep the process ID, and stop only that
  ID. A reload server does not need a restart after edits.

## 2026-10-01 — Export copy on Chromebook

- Lesson: While a `<dialog>` is open through `showModal()`, everything
  outside it is inert. A temporary textarea appended to `document.body`
  can't take focus or a selection, so `execCommand('copy')` copies an
  empty selection and still returns `true`. Put the temporary element
  inside the open dialog, and check focus and selection before you count
  the copy as a success.
- Lesson: Never show a success state without checking the result. The
  Copy button got `copied` on every click, and the class had no style,
  so the operator saw no signal either way.
- Lesson: To reproduce a clipboard fallback in headless Chromium, grant
  `clipboard-read` and `clipboard-write`, seed the clipboard with a
  marker, override `navigator.clipboard.writeText` to reject, then read
  the clipboard back. An unchanged marker proves that nothing was copied.
- Lesson: The rule against `pkill -f` applies to your own commands too.
  A `pkill -f "http.server PORT"` in a compound command matched its own
  shell and stopped the whole command. Keep the background task ID and
  stop only that task.
