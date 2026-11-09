#!/usr/bin/env node
// scripts/corpus.mjs - Writes the case studies and questions in index.html from neon1-corpus, or checks they match.
// Usage: node scripts/corpus.mjs sync|check SITE_DIR CORPUS_EXPORT   (make corpus, and make corpus-check in make check)
//
// neon1-corpus holds the words, and this page shows them. CORPUS_EXPORT is a corpus bundle written by its
// tools/export.mjs --target site, from the tag pinned in the Makefile (CORPUS_TAG). Each generated block sits
// between <!-- corpus:NAME --> and <!-- /corpus:NAME --> and is committed, so deploys stay a plain copy of the
// folder and nothing is fetched while someone reads the page. sync rewrites the blocks; check fails if a block
// differs from what the pinned corpus gives, so a hand edit here, or a corpus change not yet pulled in, is caught.

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"


const [mode, siteDir, exportDir] = process.argv.slice(2)
if (!["sync", "check"].includes(mode) || !siteDir || !exportDir) {
  console.error("usage: node scripts/corpus.mjs sync|check SITE_DIR CORPUS_EXPORT")
  process.exit(2)
}

const manifest = JSON.parse(readFileSync(join(exportDir, "manifest.json"), "utf8"))
const doc = (entry) => JSON.parse(readFileSync(join(exportDir, entry.json), "utf8"))
const ofType = (type) => manifest.files.filter((f) => f.type === type).map(doc)

// Card text is escaped the way the rest of the page is, apostrophes included
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }
const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ESC[c])

// The corpus writes plain HTML. The page wants links out marked and opened in a new tab, and tables without
// thead and tbody, as its case panel styles them
const forPage = (html) =>
  html
    .replace(/<a href="(https?:[^"]+)">/g, '<a class="ext" href="$1" target="_blank" rel="noopener">')
    .replace(/<\/?(thead|tbody)>/g, "")
    .replace(/<(h[1-6]) id="[^"]*">/g, "<$1>")

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>'
const STAGES = ["needs", "execute", "observe", "normalize"]



// One case study card. The full story waits in a template until js/cases.js opens it
function caseCard(c) {
  const d = c.data
  const glance = STAGES.map((s) => `<dt>${s[0].toUpperCase()}</dt><dd>${esc(d["short_" + s])}</dd>`).join("")
  const deep = c.sections
    .filter((s) => STAGES.includes(s.key))
    .map((s) => `<h4><span>${s.headingHtml[0]}</span>${s.headingHtml.slice(1)}</h4>${forPage(s.html).replace(/\n/g, "")}`)
    .join("")
  return [
    `        <article class="case reveal-on" id="case-${d.key}">`,
    `          <p class="idx">${esc(`${d.client} · ${d.area}`)}</p>`,
    `          <h3>${esc(c.title)}</h3>`,
    `          <dl class="neon">${glance}</dl>`,
    `          <p class="stat"><b>${esc(d.stat_key)}</b> ${esc(d.stat)}</p>`,
    `          <button class="open" type="button" data-case="${d.key}" aria-haspopup="dialog" aria-label="Open case study: ${esc(c.title)}">${ARROW}</button>`,
    `          <template class="deep">${deep}</template>`,
    `        </article>`,
  ].join("\n")
}

// One question from the FAQ, as a details element
const question = (s) => `        <details class="reveal-on"><summary>${s.headingHtml}</summary>${forPage(s.html).replace(/\n/g, "")}</details>`


const BLOCKS = {
  "case-studies": () =>
    ofType("case-study")
      .filter((c) => c.data.consumers.includes("site"))
      .sort((a, b) => a.data.order - b.data.order)
      .map(caseCard)
      .join("\n"),
  questions: () =>
    doc(manifest.files.find((f) => f.id === "faq-working-with-neon1"))
      .sections.filter((s) => s.heading)
      .map(question)
      .join("\n"),
}



const file = join(siteDir, "index.html")
const page = readFileSync(file, "utf8")
let next = page
const stale = []
for (const [name, build] of Object.entries(BLOCKS)) {
  const re = new RegExp(`(<!-- corpus:${name} [^>]*-->\\n)[\\s\\S]*?(\\n *<!-- /corpus:${name} -->)`)
  if (!re.test(next)) {
    console.error(`corpus: ${file} has no <!-- corpus:${name} --> block`)
    process.exit(1)
  }
  const updated = next.replace(re, (_, open, close) => open + build() + close)
  if (updated !== next) stale.push(name)
  next = updated
}

if (mode === "sync") {
  if (stale.length) writeFileSync(file, next)
  console.log(stale.length ? `corpus: rewrote ${stale.join(", ")} from ${manifest.digest.slice(0, 19)}` : "corpus: already matches")
} else if (stale.length) {
  console.error(`corpus: ${stale.join(", ")} in index.html differ from the pinned corpus. Edit neon1-corpus, then run make corpus`)
  process.exit(1)
} else console.log(`corpus: case studies and questions match ${manifest.digest.slice(0, 19)}`)
