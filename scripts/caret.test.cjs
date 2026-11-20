// scripts/caret.test.cjs - The Matrix input caret stays Matrix-only, token-only, and free of inline styles.
//
// Usage: node --test scripts/caret.test.cjs

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const css = readFileSync('src/app/public/shared/neon1.css', 'utf8');
const js = readFileSync('src/app/public/shared/caret.js', 'utf8');
const block = css.slice(css.indexOf("The Matrix look's input caret"));

// Every caret rule keeps out of Sentinel, in the site's attribute and 1NEON's
test('caret rules exclude Sentinel', () => {
  const rules = block.split('\n').filter((l) => /^:root:not\(/.test(l));
  assert.ok(rules.length >= 3);
  for (const rule of rules) assert.match(rule, /^:root:not\(\[data-site-style="sentinel"\], \[data-style="sentinel"\]\)/);
  assert.match(js, /siteStyle !== "sentinel" && root\.dataset\.style !== "sentinel"/);
});

// Colors and sizes come from tokens: no numeric font size, no hex color
test('caret CSS uses tokens only', () => {
  assert.doesNotMatch(block, /font-size/);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/);
});

// A strict CSP blocks the style attribute, so the script only sets properties through the CSSOM
test('caret script writes no style attribute and no inline markup', () => {
  assert.doesNotMatch(js, /setAttribute\(["']style["']/);
  assert.doesNotMatch(js, /cssText|innerHTML|insertAdjacentHTML/);
});
