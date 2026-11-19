// scripts/theme.test.cjs - Preference regressions against the real pre-paint script, without a browser.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(process.env.THEME_SCRIPT || 'src/app/public/js/theme.js', 'utf8');

// The minimal DOM exposes the switches and pending transitions, while storage survives a simulated reload
// A page with nothing stored opens in Sentinel; the checks that follow the Matrix family start from a stored Matrix choice
function page(values = {}, options = {}) {
  const storage = new Map(Object.entries(options.fresh || options.blocked ? values : { 'neon1.style': 'matrix', ...values })), listeners = {}, pending = [];
  const button = () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, fn) { this[k] = fn; } });
  const mode = button(), family = button();
  const root = { dataset: {}, classList: { add() {}, remove() {} } };
  const document = { documentElement: root, readyState: 'complete', querySelector: () => null,
    querySelectorAll: (s) => s.includes(':not') ? [mode] : s === '.style-sw' ? [family] : [],
    getElementById: () => null, dispatchEvent() {} };
  if (options.transition) document.startViewTransition = (fn) => { pending.push(fn); return { finished: Promise.resolve() }; };
  vm.runInNewContext(source, { document, localStorage: {
    getItem(k) { if (options.blocked) throw Error('blocked'); return storage.get(k) ?? null; },
    setItem(k, v) { if (options.blocked || options.readOnly) throw Error('blocked'); storage.set(k, v); },
  }, matchMedia: (q) => ({ matches: q.includes('reduced') ? !options.transition : !!options.deviceDark }),
    addEventListener: (k, fn) => { listeners[k] = fn; }, CustomEvent: function () {},
    setTimeout: () => 0, clearTimeout() {}, getComputedStyle: () => ({ getPropertyValue: () => '' }),
  });
  return { root, storage, mode, family, listeners, pending };
}

// Each family switch preserves the mode, even when the old per-family choices disagree
for (const dark of [false, true]) test(`family round trip preserves ${dark ? 'dark' : 'light'}`, () => {
  const p = page({ 'neon1.theme': dark ? 'matrix' : 'awake', 'neon1.theme.business': dark ? 'alert' : 'lamp' }, { deviceDark: !dark });
  p.family.click();
  assert.equal(p.root.dataset.siteTheme, dark ? 'matrix' : 'awake');
  p.family.click();
  assert.equal(p.root.dataset.siteTheme, dark ? 'matrix' : 'awake');
  p.mode.click();
  assert.equal(p.root.dataset.siteTheme, dark ? 'awake' : 'matrix');
});

test('legacy sentinel choice migrates and both mode tooltips stay literal', () => {
  const p = page({ 'neon1.style': 'business', 'neon1.theme.business': 'lamp' });
  assert.equal(p.root.dataset.siteLook, 'desert-of-the-real');
  assert.equal(p.storage.get('neon1.mode'), 'dark');
  assert.equal(p.mode.title, 'light or dark');
  p.mode.click();
  assert.equal(p.root.dataset.siteLook, 'providence');
});

test('a first visit opens in Sentinel, light', () => {
  const p = page({}, { fresh: true });
  assert.equal(p.root.dataset.siteLook, 'providence');
  assert.equal(p.root.dataset.siteStyle, 'sentinel');
});

test('blocked storage still permits both switches on this page', () => {
  const p = page({}, { blocked: true });
  p.mode.click(); p.family.click();
  assert.equal(p.root.dataset.siteLook, 'plugged');
  p.mode.click();
  assert.equal(p.root.dataset.siteLook, 'awake');
});

test('a stale dawn callback cannot reverse a rapid second mode toggle', () => {
  const p = page({ 'neon1.mode': 'dark' }, { transition: true });
  p.mode.click(); p.mode.click();
  p.pending.forEach((fn) => fn());
  assert.equal(p.root.dataset.siteLook, 'plugged');
});

test('other tabs and Back restore both axes', () => {
  const p = page();
  p.storage.set('neon1.mode', 'dark'); p.listeners.storage({ key: 'neon1.mode' });
  assert.equal(p.root.dataset.siteLook, 'plugged');
  p.storage.set('neon1.style', 'sentinel'); p.listeners.pageshow({ persisted: true });
  assert.equal(p.root.dataset.siteLook, 'desert-of-the-real');
});

test('readable storage with rejected writes retains the current page choice', () => {
  const p = page({ 'neon1.mode': 'light' }, { readOnly: true });
  p.mode.click(); p.family.click();
  assert.equal(p.root.dataset.siteLook, 'desert-of-the-real');
  p.mode.click();
  assert.equal(p.root.dataset.siteLook, 'providence');
});
