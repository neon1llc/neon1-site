#!/usr/bin/env node
// scripts/corpus.mjs - Writes the case studies and questions in index.html from neon1-corpus, or checks they match.
// Usage: node scripts/corpus.mjs sync|check SITE_DIR CORPUS_EXPORT   (make corpus, and make corpus-check in make check)
//
// neon1-corpus holds the words, and this page shows them. CORPUS_EXPORT is a corpus bundle written by its
// tools/export.mjs --target site, from CORPUS_TAG (the newest corpus release unless the Makefile is told
// otherwise). Each generated block sits between <!-- corpus:NAME --> and <!-- /corpus:NAME -->. The committed
// copy is the last sync; every check and deploy runs make content first, so a release always carries the
// blocks of the corpus it was built from, as static HTML: nothing is fetched while someone reads the page.
// sync rewrites the blocks; check fails if a block differs from that corpus, so a hand edit here is caught.

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { bindExtArrows } from "./knowledge-lib.mjs"


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
// Links between corpus documents name their Markdown sources (../company/contact.md). On the home page the contact
// document is the contact section itself, and every other document is its Knowledge Center page (RC-C1)
const forPage = (html) =>
  bindExtArrows(html
    .replace(/<a href="(?:\.\.\/)+company\/contact\.md">/g, '<a href="#contact">')
    .replace(/<a href="(?:\.\.\/)+([a-z0-9-]+)\/([a-z0-9-]+)\.md">/g, '<a href="/knowledge/$1/$2/">')
    .replace(/<a href="(https?:[^"]+)">/g, '<a class="ext" href="$1" target="_blank" rel="noopener">')
    .replace(/<\/?(thead|tbody)>/g, "")
    .replace(/<(h[1-6]) id="[^"]*">/g, "<$1>"))

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>'
// A case study's four sections, by their keys in the corpus, with the front-matter summary each one shortens to
// and the word the card's glance shows beside it. old names the field before neon1-corpus renamed it, so a build
// from an older corpus release still fills the card
const STAGES = [
  { key: "the-problem", short: "short_problem", old: "short_needs", word: "problem" },
  { key: "the-work", short: "short_work", old: "short_execute", word: "work" },
  { key: "the-results", short: "short_results", old: "short_observe", word: "results" },
  { key: "after-handover", short: "short_after", old: "short_normalize", word: "after" },
]
const STAGE_KEYS = STAGES.map((s) => s.key)



// Client quotes stay in the Knowledge Center case study; the home page panel leaves them out (Pradeep, 2026-11-13)
const withoutQuotes = (html) => html.replace(/(<p>[^<]*client's words:<\/p>)?<blockquote>[\s\S]*?<\/blockquote>/g, "")

// The kind of work, then in what capacity and when, such as "Partner engagement: As neon1, 2026". The corpus
// export (from v0.42) writes the kind's label and says "not yet confirmed" for a missing role or year, so every
// card carries its context; an older export without them shows whatever it has
const confirmed = (v) => typeof v === "string" && v.trim() !== "" && v.trim() !== "TBD"
const roleLine = (d) => {
  // Client work assumes neon1, so a neon1 or subcontracted engagement's label already says the role (Pradeep, 2026-11-15)
  const role = d.kind === "neon1" || d.kind === "partner" ? null : d.role
  const facts = [role, d.when].filter(confirmed).join(", ")
  if (!d.kind_label) return facts
  return confirmed(role) ? `${d.kind_label}: ${facts}` : [d.kind_label, facts].filter(Boolean).join(", ")
}

// One case study card. The full story waits in a template until js/cases.js opens it
function caseCard(c) {
  const d = c.data
  if (!d.kind_label) console.warn(`corpus: case ${d.key} has no kind yet; its card shows only its role and years`)
  const role = roleLine(d)
  const glance = STAGES.map((s) => `<dt>${s.word}</dt><dd>${esc(d[s.short] ?? d[s.old])}</dd>`).join("")
  const deep = c.sections
    .filter((s) => STAGE_KEYS.includes(s.key))
    .map((s) => `<h4>${s.headingHtml}</h4>${withoutQuotes(forPage(s.html).replace(/\n/g, ""))}`)
    .join("")
  return [
    `        <article class="case reveal-on" id="case-${d.key}">`,
    `          <p class="idx">${esc(`${d.client} · ${d.area}`)}</p>`,
    `          <h3>${esc(c.title)}</h3>`,
    ...(role ? [`          <p class="role">${esc(role)}</p>`] : []),
    `          <dl class="glance">${glance}</dl>`,
    `          <p class="stat"><b>${esc(d.stat_key)}</b> ${esc(d.stat)}</p>`,
    `          <button class="open" type="button" data-case="${d.key}" aria-haspopup="dialog" aria-label="Open case study: ${esc(c.title)}">${ARROW}</button>`,
    `          <template class="deep">${deep}</template>`,
    `        </article>`,
  ].join("\n")
}

// One question from the FAQ, as a details element
const question = (s) => `        <details class="n1-fold reveal-on"><summary>${s.headingHtml}</summary>${forPage(s.html).replace(/\n/g, "")}</details>`


// The home page keeps its questions short: the FAQ's `home` list (corpus v0.47 on) names which questions it
// shows and in what order, and each shows only its answer's first paragraph. The Knowledge Center and Neo carry
// every question in full, from the same text, so the short and long answers can't disagree
const firstParagraph = (s) => ({ ...s, html: (s.html.match(/<p>[\s\S]*?<\/p>/) ?? [s.html])[0] })
const homeQuestions = (faq) => {
  const asked = faq.sections.filter((s) => s.heading)
  if (Array.isArray(faq.data.home)) return faq.data.home.map((q) => asked.find((s) => s.heading === q)).filter(Boolean).map(firstParagraph)
  // An older corpus without the list: every question but those the contact view's "where, when, size" list answers
  const onContact = new Set(["Do you come on site?", "When do you work?", "How long does a project take?"])
  return asked.filter((s) => !onContact.has(s.heading))
}

const BLOCKS = {
  "case-studies": () =>
    ofType("case-study")
      .filter((c) => c.data.consumers.includes("site"))
      .sort((a, b) => a.data.order - b.data.order)
      .map(caseCard)
      .join("\n"),
  questions: () =>
    homeQuestions(doc(manifest.files.find((f) => f.id === "faq-working-with-neon1")))
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
  console.error(`corpus: ${stale.join(", ")} in index.html differ from the corpus. Edit neon1-corpus, then run make corpus`)
  process.exit(1)
} else console.log(`corpus: case studies and questions match ${manifest.digest.slice(0, 19)}`)
