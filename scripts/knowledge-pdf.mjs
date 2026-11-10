#!/usr/bin/env node
// scripts/knowledge-pdf.mjs - Prints every knowledge center document that has pdf: true to a branded PDF, next to its page.
// Usage: node scripts/knowledge-pdf.mjs SITE_DIR CORPUS_EXPORT [--only text]   (make knowledge-pdf)
//
// The method is Ready, Secure, Go's: the corpus's HTML in a print page styled by knowledge/print.css, printed by
// Chromium through Playwright, with a running footer. Playwright comes from knowledge/package.json (npm ci --prefix
// knowledge, then npx --prefix knowledge playwright install chromium). The deploy job runs this before syncing, so
// PDFs are never committed. Links in a PDF point at neon1.tech, since a PDF travels on its own.
//
// Fonts: Aptos when the machine has it (Microsoft 365), otherwise the site's own Inter, which every build has.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import { tmpdir } from "node:os"
import { load, relink, singleH1, keepFields, fillNote, esc, longDate, TYPE_LABELS, SITE } from "./knowledge-lib.mjs"


const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const [siteDir, exportDir] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--only")
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : ""
if (!siteDir || !exportDir) {
  console.error("usage: node scripts/knowledge-pdf.mjs SITE_DIR CORPUS_EXPORT [--only text]")
  process.exit(2)
}

const require = createRequire(join(root, "knowledge", "package.json"))
let chromium
try {
  ;({ chromium } = require("playwright"))
} catch {
  console.error("knowledge-pdf: run npm ci --prefix knowledge first, then npx --prefix knowledge playwright install chromium")
  process.exit(1)
}

const corpus = load(exportDir)
const mark = readFileSync(join(root, "knowledge", "mark.svg"), "utf8")
const docs = corpus.docs.filter((d) => d.pdf && (!only || d.id.includes(only)))


// The facts under the title, as in the page's header
function glance(d) {
  const facts = [
    ["Type", TYPE_LABELS[d.type] ?? d.type],
    d.data.edition ? ["Edition", d.data.edition] : null,
    d.data.created && d.data.created !== d.data.updated ? ["First written", longDate(d.data.created)] : null,
    ["Updated", longDate(d.data.updated)],
    d.data.reviewed ? ["Facts checked", longDate(d.data.reviewed)] : null,
    d.data.audience ? ["For", d.data.audience] : null,
  ].filter(Boolean)
  return `<div class="glance">${facts.map(([k, v]) => `<span><b>${esc(k)}</b>${esc(v)}</span>`).join("")}</div>`
}

// The full page Chromium prints. Fonts and styles resolve from knowledge/
function pageHtml(d) {
  const shelf = corpus.manifest.shelves[d.section].label
  const fillable = ["form", "template"].includes(d.type)
  const note = d.type === "template" || d.type === "example" ? " Templates and examples are illustrations, not legal advice." : ""
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(d.title)} · neon1</title>
  <base href="${pathToFileURL(join(root, "knowledge")).href}/">
  <link rel="stylesheet" href="print.css">
</head>
<body class="${fillable ? "fillable" : ""}">
  <header class="band">${mark}<span class="wordmark">neon1</span><span class="kind">${esc(d.type === "page" ? shelf : TYPE_LABELS[d.type] ?? d.type)}</span></header>
  ${d.data.fictional ? '<p class="flag">Fictional example</p>' : ""}
  <h1>${esc(d.title)}</h1>
  <p class="summary">${esc(d.summary)}</p>
  ${glance(d)}
  <main>${keepFields(relink(singleH1(d.html, d.title), d, corpus, { absolute: true }))}</main>
  <p class="colophon">© neon1 LLC (neon1.tech). Shared under CC BY-ND 4.0: copy and share it word for word with credit.${note}${fillNote(d) ? ` ${esc(fillNote(d))}` : ""} The latest version is at <a href="${SITE}${d.url}">${esc(`neon1.tech${d.url}`)}</a>.</p>
</body>
</html>`
}

// Running footer on every page. Chromium needs inline styles here
function footerHtml(d) {
  const edition = d.data.edition ? ` · edition ${esc(d.data.edition)}` : ""
  return `<div style="width:100%;margin:0 0.75in;display:flex;justify-content:space-between;font:7.5pt Aptos,Inter,Helvetica,sans-serif;color:#56665c;">
    <span>neon1 · ${esc(d.title)}${edition}</span>
    <span>neon1.tech/knowledge · page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`
}


const browser = await chromium.launch()
const page = await browser.newPage()
const scratch = join(tmpdir(), "neon1-knowledge-pdf")
mkdirSync(scratch, { recursive: true })

for (const d of docs) {
  const html = join(scratch, `${d.id}.html`)
  writeFileSync(html, pageHtml(d))
  await page.goto(pathToFileURL(html).href, { waitUntil: "load" })
  await page.evaluate(() => document.fonts.ready)
  const out = join(resolve(siteDir), d.pdf.slice(1))
  mkdirSync(dirname(out), { recursive: true })
  await page.pdf({
    path: out,
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: footerHtml(d),
    tagged: true,
    outline: true,
  })
}

await browser.close()
rmSync(scratch, { recursive: true, force: true })
console.log(`knowledge-pdf: printed ${docs.length} PDF(s)`)
