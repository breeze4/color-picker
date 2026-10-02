// Clipboard copy with a fallback that works while a modal dialog is open.

// Copies text and returns true only when a copy path reports success.
// `doc` and `clipboard` default to the page's and exist so tests can pass fakes.
export async function copyText(text, { doc = document, clipboard = globalThis.navigator?.clipboard } = {}) {
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the selection copy.
    }
  }
  return selectionCopy(text, doc);
}

// Copies through a temporary textarea and document.execCommand('copy').
// A modal dialog makes everything outside it inert, so an element appended to
// the body can't take focus or a selection. The textarea goes inside the open
// dialog instead, and the user's focus and selection come back afterward.
function selectionCopy(text, doc) {
  const host = doc.querySelector('dialog[open]') || doc.body;
  const focused = doc.activeElement;
  const sel = doc.getSelection();
  const ranges = [];
  for (let i = 0; i < (sel?.rangeCount || 0); i++) ranges.push(sel.getRangeAt(i));

  const ta = doc.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  host.appendChild(ta);

  let ok = false;
  try {
    ta.focus();
    ta.select();
    // execCommand reports true even when nothing is selected, so check that the
    // textarea really holds focus and the whole text is selected first.
    const selected = doc.activeElement === ta && ta.selectionStart === 0 && ta.selectionEnd === ta.value.length;
    ok = selected && doc.execCommand('copy') === true;
  } catch {
    ok = false;
  } finally {
    ta.remove();
    if (focused && typeof focused.focus === 'function') focused.focus({ preventScroll: true });
    if (sel && ranges.length) {
      sel.removeAllRanges();
      ranges.forEach((r) => sel.addRange(r));
    }
  }
  return ok;
}
