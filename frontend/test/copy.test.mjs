import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyText } from '../js/copy.js';

// A small fake DOM that models what Chromium does with a modal dialog open:
// an element outside the dialog is inert and can't take focus or a selection,
// and execCommand('copy') returns true even when it copies nothing.
class El {
  constructor(doc, tag) {
    this.doc = doc;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parent = null;
    this.attrs = {};
    this.style = {};
    this.value = '';
    this.selectionStart = 0;
    this.selectionEnd = 0;
  }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  inside(node) { for (let n = this; n; n = n.parent) if (n === node) return true; return false; }
  inert() {
    const modal = this.doc.modal;
    return !this.inside(this.doc.body) || (modal !== null && !this.inside(modal));
  }
  focus() { if (!this.inert()) this.doc.activeElement = this; }
  select() {
    if (this.inert()) return;
    this.selectionStart = 0;
    this.selectionEnd = this.value.length;
  }
}

function fakeDoc({ execResult = true } = {}) {
  const doc = {
    modal: null,
    clipboard: null,
    execCalls: 0,
    ranges: [],
    createElement: (tag) => new El(doc, tag),
    querySelector: (q) => (q === 'dialog[open]' ? doc.modal : null),
    getSelection: () => ({
      get rangeCount() { return doc.ranges.length; },
      getRangeAt: (i) => doc.ranges[i],
      removeAllRanges: () => { doc.ranges = []; },
      addRange: (r) => { doc.ranges.push(r); },
    }),
    execCommand(cmd) {
      doc.execCalls++;
      const a = doc.activeElement;
      if (cmd === 'copy' && a && a.tagName === 'TEXTAREA') doc.clipboard = a.value.slice(a.selectionStart, a.selectionEnd);
      return execResult;
    },
  };
  doc.body = new El(doc, 'body');
  doc.activeElement = doc.body;
  return doc;
}

function openModal(doc) {
  const dialog = doc.body.appendChild(new El(doc, 'dialog'));
  const button = dialog.appendChild(new El(doc, 'button'));
  doc.modal = dialog;
  button.focus();
  return { dialog, button };
}

const rejecting = { writeText: () => Promise.reject(new Error('NotAllowedError')) };

test('writeText success copies without the fallback', async () => {
  const doc = fakeDoc();
  let written = null;
  const ok = await copyText('abc', { doc, clipboard: { writeText: async (t) => { written = t; } } });
  assert.equal(ok, true);
  assert.equal(written, 'abc');
  assert.equal(doc.execCalls, 0);
});

test('fallback copies inside an open modal dialog', async () => {
  const doc = fakeDoc();
  const { dialog, button } = openModal(doc);
  doc.ranges = ['user-range'];
  let host = null;
  const append = dialog.appendChild.bind(dialog);
  dialog.appendChild = (c) => { host = dialog; return append(c); };

  const ok = await copyText('# Palette\n#ff0000', { doc, clipboard: rejecting });

  assert.equal(ok, true);
  assert.equal(doc.clipboard, '# Palette\n#ff0000');
  assert.equal(host, dialog, 'the temporary textarea goes inside the dialog');
  assert.equal(dialog.children.length, 1, 'the temporary textarea is removed');
  assert.equal(doc.activeElement, button, 'focus comes back to the button');
  assert.deepEqual(doc.ranges, ['user-range'], 'the user selection comes back');
});

test('fallback copies from the page when no dialog is open', async () => {
  const doc = fakeDoc();
  const ok = await copyText('#00ff00', { doc, clipboard: rejecting });
  assert.equal(ok, true);
  assert.equal(doc.clipboard, '#00ff00');
  assert.equal(doc.body.children.length, 0);
});

test('fallback runs when the clipboard API is missing', async () => {
  const doc = fakeDoc();
  const ok = await copyText('#0000ff', { doc, clipboard: undefined });
  assert.equal(ok, true);
  assert.equal(doc.clipboard, '#0000ff');
});

test('copy reports failure when execCommand fails', async () => {
  const doc = fakeDoc({ execResult: false });
  openModal(doc);
  const ok = await copyText('abc', { doc, clipboard: rejecting });
  assert.equal(ok, false);
});

test('copy reports failure when the textarea cannot take focus', async () => {
  // An inert textarea is what broke the export: execCommand still returns
  // true, so the copy must not count as a success.
  const doc = fakeDoc();
  openModal(doc);
  doc.querySelector = () => null; // forces the textarea onto the inert body
  const ok = await copyText('abc', { doc, clipboard: rejecting });
  assert.equal(ok, false);
  assert.equal(doc.clipboard, null);
  assert.equal(doc.execCalls, 0);
});
