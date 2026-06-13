import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSavedTheme, resolveInitialTheme, saveTheme, nextTheme } from '../js/theme.js';

function memStore() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}
function throwingStore() {
  return { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {} };
}

test('readSavedTheme returns a valid saved value, else null', () => {
  const s = memStore();
  assert.equal(readSavedTheme(s), null);
  s.setItem('tmc.v1.theme', 'light');
  assert.equal(readSavedTheme(s), 'light');
  s.setItem('tmc.v1.theme', 'banana');
  assert.equal(readSavedTheme(s), null);
});

test('readSavedTheme is null for a null or throwing store', () => {
  assert.equal(readSavedTheme(null), null);
  assert.equal(readSavedTheme(throwingStore()), null);
});

test('resolveInitialTheme prefers a saved value over the OS preference', () => {
  const s = memStore();
  s.setItem('tmc.v1.theme', 'light');
  assert.equal(resolveInitialTheme(s, true), 'light');
});

test('resolveInitialTheme falls back to the OS preference when unsaved or invalid', () => {
  const s = memStore();
  assert.equal(resolveInitialTheme(s, true), 'dark');
  assert.equal(resolveInitialTheme(s, false), 'light');
  s.setItem('tmc.v1.theme', 'nonsense');
  assert.equal(resolveInitialTheme(s, true), 'dark');
});

test('saveTheme persists valid values, refuses invalid ones, and survives a throwing store', () => {
  const s = memStore();
  assert.equal(saveTheme('dark', s), true);
  assert.equal(s.getItem('tmc.v1.theme'), 'dark');
  assert.equal(saveTheme('chartreuse', s), false);
  assert.equal(saveTheme('light', null), false);
  assert.equal(saveTheme('light', throwingStore()), false);
});

test('nextTheme flips between light and dark', () => {
  assert.equal(nextTheme('dark'), 'light');
  assert.equal(nextTheme('light'), 'dark');
});
