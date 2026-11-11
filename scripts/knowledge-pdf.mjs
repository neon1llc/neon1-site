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


// The facts under the title, as a small bordered table: two facts to a row, and "For" on a row of its own
function facts(d) {
  const pairs = [
    ["Type", TYPE_LABELS[d.type] ?? d.type],
    d.data.edition ? ["Edition", d.data.edition] : null,
    // Published is when the content first appeared; Updated shows only once it has changed since
    d.data.created ? ["Published", longDate(d.data.created)] : null,
    !d.data.created || d.data.created !== d.data.updated ? ["Updated", longDate(d.data.updated)] : null,
    d.data.reviewed ? ["Facts checked", longDate(d.data.reviewed)] : null,
  ].filter(Boolean)
  const cell = ([k, v]) => `<th scope="row">${esc(k)}</th><td>${esc(v)}</td>`
  const rows = []
  for (let i = 0; i < pairs.length; i += 2) rows.push(`<tr>${cell(pairs[i])}${pairs[i + 1] ? cell(pairs[i + 1]) : ""}</tr>`.replace(/<td>([^<]*)<\/td><\/tr>$/, (m, v) => (pairs[i + 1] ? m : `<td colspan="3">${v}</td></tr>`)))
  if (d.data.audience) rows.push(`<tr><th scope="row">For</th><td colspan="3">${esc(d.data.audience)}</td></tr>`)
  return `<table class="facts"><caption>About this document</caption><tbody>${rows.join("")}</tbody></table>`
}

// The full page Chromium prints. Fonts and styles resolve from knowledge/
function pageHtml(d) {
  const shelf = corpus.manifest.shelves[d.section].label
  const fillable = ["form", "template"].includes(d.type)
  const kind = d.type === "page" ? shelf : TYPE_LABELS[d.type] ?? d.type
  const dated = longDate(d.data.updated)
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
  <header class="letterhead">
    <div class="brand">${mark}<span class="wordmark">neon1</span></div>
    <div class="titles">
      ${d.data.fictional ? '<p class="flag">Fictional example</p>' : ""}
      <p class="kind">${esc(kind)}${d.data.edition ? ` · edition ${esc(d.data.edition)}` : ""}</p>
      <h1>${esc(d.title)}</h1>
      <p class="dates">${esc(dated)}</p>
    </div>
  </header>
  <p class="summary">${esc(d.summary)}</p>
  ${facts(d)}
  <main>${keepFields(relink(singleH1(d.html, d.title), d, corpus, { absolute: true }))}</main>
  <p class="colophon">© neon1 LLC (neon1.tech). Shared under CC BY-ND 4.0: copy and share it word for word with credit.${note}${fillNote(d) ? ` ${esc(fillNote(d))}` : ""} The latest version is at <a href="${SITE}${d.url}">${esc(`neon1.tech${d.url}`)}</a>.</p>
</body>
</html>`
}

// Running footer on every page, as on neon1's letters: the document centered in italics, the slogan in
// green under it, and the page number at the right. Chromium draws it in its own frame, so styles are inline
function footerHtml(d) {
  const edition = d.data.edition ? ` · edition ${esc(d.data.edition)}` : ""
  return `<div style="width:100%;margin:0 0.75in;display:grid;grid-template-columns:1fr auto 1fr;align-items:end;font-family:Aptos,Inter,Helvetica,sans-serif;font-size:7.5pt;color:#59625c;">
    <span></span>
    <span style="text-align:center;line-height:1.45;"><i>neon1 · ${esc(d.title)}${edition} · neon1.tech/knowledge</i><br><b style="color:#035704;font-style:italic;">1 is glad to be of service.</b></span>
    <span style="text-align:right;font-weight:700;color:#035704;font-size:9pt;"><span class="pageNumber"></span></span>
  </div>`
}

// Page breaks that keep ideas whole. The page is laid out at the printed width, then each section (an h2 and
// what follows it) is checked against where the pages fall: a section that would split, but fits on one page,
// moves to a new page when that leaves at most a third of a page empty. Inside a section longer than a page,
// each h3 group gets the same test with a quarter page. Anything else flows, so space isn't wasted.
// Measures match @page in print.css: Letter, 7in wide, 9.5in tall inside the margins, at 96 px an inch
const PAGE_W = 7 * 96, PAGE_H = 9.5 * 96
function paginate({ H }) {
  const main = document.querySelector("main")
  const group = (parent, tag, cls) => {
    const kids = [...parent.children]
    let box = null
    for (const el of kids) {
      if (el.tagName === tag) {
        box = document.createElement(tag === "H2" ? "section" : "div")
        box.className = cls
        el.before(box)
      }
      if (box) box.append(el)
    }
  }
  group(main, "H2", "sec")
  for (const sec of main.querySelectorAll(".sec")) group(sec, "H3", "sub")
  const top = (el) => el.getBoundingClientRect().top + scrollY
  let shift = 0
  const SLOP = 14
  const place = (el, waste) => {
    const y = top(el) + shift, h = el.getBoundingClientRect().height
    const used = y % H, left = H - used
    if (h + SLOP > left && h <= H - SLOP && left <= H * waste && used > H * 0.05) {
      el.classList.add("fresh")
      shift += left
      return true
    }
    return false
  }
  for (const sec of main.querySelectorAll(".sec")) {
    if (place(sec, 1 / 3)) continue
    if (sec.getBoundingClientRect().height <= H) continue
    const subs = [...sec.querySelectorAll(":scope > .sub")]
    // A section's first group moving would strand its heading and a line or two at the foot of a page, so
    // when the intro before it is short, the whole section starts on the new page instead
    const intro = subs[0] ? top(subs[0]) - top(sec) : Infinity
    const y = top(sec) + shift
    if (subs[0] && intro < H * 0.2 && (y % H) + intro + subs[0].getBoundingClientRect().height + SLOP > H && (H - (y % H)) <= H / 3) {
      sec.classList.add("fresh")
      shift += H - (y % H)
    }
    for (const sub of subs) place(sub, 1 / 4)
  }
}


const browser = await chromium.launch()
// Laid out at the printed width with print styles, so the pagination measures what will print
const page = await browser.newPage({ viewport: { width: PAGE_W, height: PAGE_H } })
await page.emulateMedia({ media: "print" })
const scratch = join(tmpdir(), "neon1-knowledge-pdf")
mkdirSync(scratch, { recursive: true })

for (const d of docs) {
  const html = join(scratch, `${d.id}.html`)
  writeFileSync(html, pageHtml(d))
  await page.goto(pathToFileURL(html).href, { waitUntil: "load" })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(paginate, { H: PAGE_H })
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
