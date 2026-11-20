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
  const links = [];
  const root = { dataset: { ...options.dataset }, classList: { add() {}, remove() {} } };
  const document = { documentElement: root, readyState: 'complete', querySelector: () => null,
    querySelectorAll: (s) => s.includes(':not') ? [mode] : s === '.style-sw' ? [family] : [],
    getElementById: () => null, dispatchEvent() {}, createElement: () => ({}), visibilityState: 'visible', addEventListener: (k, fn) => { listeners['doc:' + k] = fn; },
    head: options.dataset ? { appendChild: (link) => links.push(link) } : undefined };
  if (options.transition) document.startViewTransition = (fn) => { pending.push(fn); return { finished: Promise.resolve() }; };
  vm.runInNewContext(source, { document, localStorage: {
    getItem(k) { if (options.blocked) throw Error('blocked'); return storage.get(k) ?? null; },
    setItem(k, v) { if (options.blocked || options.readOnly) throw Error('blocked'); storage.set(k, v); },
  }, matchMedia: (q) => ({ matches: q.includes('reduced') ? !options.transition : !!options.deviceDark }),
    addEventListener: (k, fn) => { listeners[k] = fn; }, CustomEvent: function () {},
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    setTimeout: () => 0, clearTimeout() {}, getComputedStyle: () => ({ getPropertyValue: () => '' }),
  });
  return { root, storage, mode, family, listeners, pending, links };
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

// The landing's Matrix-only hints (rain and rabbit modules, the Matrix font) are added only for a Matrix visitor
const hints = { matrixPreload: '/shared/rain.js /js/white-rabbit.js', matrixFont: '/fonts/mono.woff2' };
test('Sentinel adds no preload hints, and Matrix adds the module and font hints', () => {
  assert.equal(page({}, { fresh: true, dataset: hints }).links.length, 0);
  const matrix = page({ 'neon1.style': 'matrix' }, { dataset: hints }).links;
  assert.deepEqual(matrix.map((l) => [l.rel, l.href]), [['modulepreload', '/shared/rain.js'], ['modulepreload', '/js/white-rabbit.js'], ['preload', '/fonts/mono.woff2']]);
  assert.equal(matrix[2].as, 'font');
});

// ---- Rapid and interleaved switches: the page always ends on the newest saved choice ----
// The pending list is the dawn's view-transition callbacks, which a browser runs a frame or more after the click
const lookOf = (family, dark) => family === 'sentinel' ? (dark ? 'desert-of-the-real' : 'providence') : (dark ? 'plugged' : 'awake');
for (const family of ['matrix', 'sentinel']) for (const dark of [true, false]) for (const order of ['forward', 'reverse', 'each']) {
  const runs = [];
  const build = (prefix) => { if (prefix.length) runs.push(prefix); if (prefix.length < 4) for (const op of ['mode', 'family']) build([...prefix, op]); };
  build([]);
  test(`rapid switches from ${family} ${dark ? 'dark' : 'light'} end on the newest choice (callbacks ${order})`, () => {
    for (const run of runs) {
      const p = page({ 'neon1.style': family, 'neon1.mode': dark ? 'dark' : 'light' }, { transition: true });
      let f = family, d = dark;
      for (const op of run) {
        if (op === 'mode') { d = !d; p.mode.click(); } else { f = f === 'matrix' ? 'sentinel' : 'matrix'; p.family.click(); }
        if (order === 'each') p.pending.splice(0).forEach((fn) => fn());
      }
      const fns = p.pending.splice(0);
      (order === 'reverse' ? fns.reverse() : fns).forEach((fn) => fn());
      assert.equal(p.root.dataset.siteLook, lookOf(f, d), run.join());
      assert.equal(p.storage.get('neon1.mode'), d ? 'dark' : 'light', run.join());
      assert.equal(p.storage.get('neon1.style'), f, run.join());
    }
  });
}

test('another tab changing the choice while a dawn is waiting is not painted over by it', () => {
  const p = page({ 'neon1.mode': 'dark' }, { transition: true });
  p.mode.click();                                   // dark to light: the dawn waits
  p.storage.set('neon1.mode', 'dark'); p.listeners.storage({ key: 'neon1.mode' });
  p.pending.splice(0).forEach((fn) => fn());
  assert.equal(p.root.dataset.siteLook, 'plugged');
});

test('the family switch flips the saved family even while a dawn has not painted yet', () => {
  const p = page({ 'neon1.mode': 'dark' }, { transition: true });
  p.mode.click();                                   // dark to light: painted state is still plugged
  p.family.click();                                 // matrix to sentinel, from the saved family
  p.pending.splice(0).forEach((fn) => fn());
  assert.equal(p.root.dataset.siteLook, 'providence');
  assert.equal(p.storage.get('neon1.style'), 'sentinel');
  assert.equal(p.storage.get('neon1.mode'), 'light');
});

test('a tab brought forward catches up with a change it slept through', () => {
  const p = page();
  p.storage.set('neon1.mode', 'dark');
  p.listeners['doc:visibilitychange']();
  assert.equal(p.root.dataset.siteLook, 'plugged');
});
