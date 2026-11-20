// scripts/scale.test.cjs - The site's CSS sizes text by naming a step of the shared type scale (shared/neon1.css), never a number.
// Usage: node --test scripts/scale.test.cjs   (make logic)

"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const PUBLIC = path.join(__dirname, "..", "src", "app", "public");
const FILES = ["css/frame.css", "css/site.css", "css/sentinel.css", "css/knowledge.css", "css/report-bug.css", "shared/chat.css", "shared/not-found.css", "shared/neon1.css"];
// Declarations of text size: font or font-size
const SIZE = /(?<![\w-])font(?:-size)?\s*:([^;{}]*)/g;

test("the scale defines every step and the spacing steps", () => {
  const css = fs.readFileSync(path.join(PUBLIC, "shared/neon1.css"), "utf8");
  for (const t of ["xs", "sm", "ui", "md", "base", "lg", "xl", "2xl", "3xl"]) assert.match(css, new RegExp(`--fs-${t}:`), `--fs-${t} is missing`);
  for (let i = 0; i <= 7; i++) assert.match(css, new RegExp(`--sp-${i}:`), `--sp-${i} is missing`);
});

test("text is sized by a step, or by a fluid clamp() for the page's own headline sizes", () => {
  const loose = [];
  for (const f of FILES) {
    const css = fs.readFileSync(path.join(PUBLIC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(SIZE)) {
      const v = m[1].replace(/clamp\([^;]*?\)(?=\s|$)/g, "").replace(/var\(--[^)]*\)/g, "").replace(/\/\s*[\d.]+/g, "");
      if (/[\d.]+(px|rem)\b/.test(v) && !/clamp\(/.test(m[1])) loose.push(`${f}: ${m[0].trim()}`);
    }
  }
  assert.deepStrictEqual(loose, [], "write a size as a step (var(--fs-md)), not a number");
});
