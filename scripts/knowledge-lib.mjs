// scripts/knowledge-lib.mjs - What the Knowledge Center pages and their PDFs share: where each corpus document
// lives on the site, and how its links are pointed at those places.
//
// The corpus export (tools/export.mjs --target knowledge) has already turned every document into HTML, so
// nothing here parses Markdown. This module only decides addresses.

import { readFileSync } from "node:fs"
import { join, posix } from "node:path"


export const SITE = "https://neon1.tech"
export const BASE = "/knowledge/"
export const CORPUS_BLOB = "https://github.com/neon1llc/neon1-corpus/blob/main/"

// Escapes text for HTML written by hand
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }
export const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (c) => ESC[c])

// Words a section's ids may start with, so "policy-privacy" on the policies shelf becomes /knowledge/policies/privacy/
const PREFIXES = {
  policies: ["policies-", "policy-"],
  products: ["products-", "product-"],
  "case-studies": ["case-studies-", "case-"],
}
export function slugOf(id, section) {
  for (const p of PREFIXES[section] ?? [`${section}-`]) if (id.startsWith(p) && id.length > p.length) return id.slice(p.length)
  return id
}


// The whole export: the manifest, every document with its address, and lookups by id and by corpus path
export function load(exportDir) {
  const manifest = JSON.parse(readFileSync(join(exportDir, "manifest.json"), "utf8"))
  const docs = manifest.files.map((entry) => {
    const doc = JSON.parse(readFileSync(join(exportDir, entry.json), "utf8"))
    const slug = slugOf(doc.id, doc.section)
    const dir = `${BASE}${doc.section}/${slug}/`
    const pdf = doc.data.pdf ? `${dir}neon1-${slug}.pdf` : null
    return { ...doc, slug, url: dir, pdf }
  })
  const byId = new Map(docs.map((d) => [d.id, d]))
  const bySource = new Map(docs.map((d) => [d.source, d]))
  const shelves = Object.entries(manifest.shelves).map(([key, s]) => ({ key, ...s, url: `${BASE}#${key}`, docs: docs.filter((d) => d.section === key) }))
  // Shelves in their groups, resources first, in the order the corpus gives
  const groups = Object.entries(manifest.groups ?? {}).map(([key, g]) => ({ key, ...g, shelves: shelves.filter((s) => s.group === key) })).filter((g) => g.shelves.length)
  const featured = docs.filter((d) => d.data.featured)
  return { manifest, docs, byId, bySource, shelves, groups, featured }
}


// Points every relative link in a document's HTML at its page in the Knowledge Center, or at the corpus on
// GitHub when the document isn't shown here. absolute: true writes full URLs, for PDFs that travel on their own
export function relink(html, doc, { bySource }, { absolute = false } = {}) {
  const from = posix.dirname(doc.source)
  return html.replace(/href="([^"]+)"/g, (whole, href) => {
    if (/^[a-z]+:/i.test(href) || href.startsWith("#") || href.startsWith("/")) return whole
    const [path, hash] = href.split("#")
    const target = posix.normalize(posix.join(from, path))
    const page = bySource.get(target)
    const url = page ? (absolute ? SITE : "") + page.url : CORPUS_BLOB + target
    return `href="${url}${hash ? `#${hash}` : ""}"`
  })
}


// "2026-11-09" as "November 9, 2026", the way the site writes dates
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
export function longDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number)
  return y && m && d ? `${MONTHS[m - 1]} ${d}, ${y}` : String(iso ?? "")
}

// The label for a document's type, as a reader would say it
export const TYPE_LABELS = {
  page: "Page", standard: "Standard", guide: "Guide", policy: "Policy", template: "Template", form: "Form",
  example: "Filled-out example", faq: "Questions", "case-study": "Case study", comparison: "Comparison", directive: "Directive",
}


// ---- Body repair, done once here so the page and the PDF agree ----

const plain = (s) => String(s).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim().toLowerCase()

// The page's own heading is the generated title, so a body <h1> that repeats it is dropped (even when a callout comes
// first), and any other body <h1> becomes an <h2>. The document then has exactly one H1.
export function singleH1(html, title) {
  const want = plain(title)
  return html
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>\s*/g, (whole, inner) => (plain(inner) === want ? "" : whole))
    .replace(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/g, "<h2$1>$2</h2>")
}

// Links to this site's own origin are internal: written as paths so they open in the same tab. Other http(s)
// links are marked external and open in a new tab. mailto: and the like are left alone.
const SAME_ORIGIN = /^https?:\/\/(?:www\.)?neon1\.tech(?=[/?#]|$)/i
export function classifyLinks(html) {
  return html.replace(/<a href="(https?:[^"]+)">/g, (whole, href) => {
    if (SAME_ORIGIN.test(href)) return `<a href="${href.replace(SAME_ORIGIN, "") || "/"}">`
    return `<a class="ext" href="${href}" target="_blank" rel="noopener">`
  })
}

// An outbound link's arrow is drawn after its last word, and that word and the arrow never part at a line
// break: the last word goes in a nowrap span that carries the arrow (css/frame.css a.ext .ext-end). The rest
// of a long link still wraps normally. Already-bound links are left as they are
export function bindExtArrows(html) {
  return html.replace(/(<a class="ext"[^>]*>)([\s\S]*?)(<\/a>)/g, (whole, open, inner, close) => {
    if (inner.includes('class="ext-end"')) return whole
    // The last run of text outside any tag, split at its last space; a link ending in markup binds whole
    const m = /^([\s\S]*\s)?([^\s<>]+)$/.exec(inner)
    if (!m) return `${open}<span class="ext-end">${inner}</span>${close}`
    // A long last word (a pasted address, say) keeps only its last few letters with the arrow, so it can still wrap
    const [lead, word] = [m[1] ?? "", m[2]]
    if (word.length > 20 && !/&/.test(word.slice(-8))) return `${open}${lead}${word.slice(0, -4)}<span class="ext-end">${word.slice(-4)}</span>${close}`
    return `${open}${lead}<span class="ext-end">${word}</span>${close}`
  })
}

// A document's body as the web page shows it
// Checkboxes in forms, templates, and examples are printed marks, not controls: the page saves nothing, so
// they show their state without taking focus or clicks (AS-08). Fill in a downloaded or printed copy
export function staticChecks(html) {
  return html.replace(/<input type="checkbox"( checked)?>/g, (whole, on) => `<input type="checkbox"${on ?? ""} disabled>`)
}

export function pageBody(doc, corpus) {
  return bindExtArrows(staticChecks(classifyLinks(relink(singleH1(doc.html, doc.title), doc, corpus))))
}

// Counts and the PDF claim, read from the documents so no sentence can say more than the manifest does
export function catalogFacts(docs) {
  const count = docs.length
  const pdfs = docs.filter((d) => d.pdf).length
  const pdfClaim = pdfs === 0 ? "" : `${pdfs} with a PDF to download`
  return { count, pdfs, pdfClaim, summary: `${count} documents${pdfClaim ? `, ${pdfClaim}` : ""}` }
}


// ---- Search index ----

// A section's HTML as plain text for searching and snippets
export function htmlToText(html) {
  return String(html)
    .replace(/<\/(p|li|h[1-6]|tr|aside|div|blockquote)>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

// One small JSON file the browser fetches on first use: for each document its title, summary, shelf, and sections
// as plain text with the anchor each heading has on the page. Matching, weights, and synonyms live in the
// browser module, so the file holds only text.
const CITATION_LISTS = new Set(["company-sources"])

export function searchIndex(corpus) {
  return {
    v: 1,
    docs: corpus.docs.map((d) => ({
      u: d.url,
      t: d.title,
      s: d.summary,
      sh: corpus.manifest.shelves[d.section].label,
      ty: TYPE_LABELS[d.type] ?? d.type,
      // [anchor id, heading, text]; the lead has no heading. Citations say where a method comes from, not what a
      // document is about, so a Sources section and the reading list's entries stay out of search; the reading
      // list is still found by its title, summary, and lead
      k: d.sections
        .filter((x) => x.heading !== "Sources" && !(CITATION_LISTS.has(d.id) && x.heading))
        .map((x) => [x.heading ? x.key : "", x.heading || "", htmlToText(x.html)]).filter((x) => x[2] || x[1]),
    })),
  }
}


// Four ways in for someone who doesn't know the library's shelves yet, with documents chosen by id
export const TASK_PATHS = [
  { key: "considering", title: "Considering a project", blurb: "Before the first call, or before you spend anything.",
    ids: ["guides-first-call", "guides-before-you-buy", "case-security-for-non-security-people"] },
  { key: "recurring", title: "Fixing a recurring problem", blurb: "The same thing keeps going wrong, and you want it to stop.",
    ids: ["guides-backups-you-can-trust", "guides-use-case-workflows"] },
  { key: "using", title: "Using 1NEON", blurb: "Answers for the client portal, and what it is.",
    ids: ["faq-1neon-help", "product-1neon"] },
  { key: "diligence", title: "Technical due diligence", blurb: "How I handle security, data, and recovery, in writing.",
    ids: ["standards-security-and-data", "standards-reliability-and-recovery", "policy-security"] },
]


// A bold label and the blank after it travel as one unit, so a line break never strands a date's blank on the next line
const BLANK = '<span class="blank"[^>]*></span>'
export const keepFields = (html) => html.replace(new RegExp(`(<strong>[^<]*</strong>)\\s*(${BLANK})`, "g"), '<span class="field">$1 $2</span>')


// Templates, forms, and the examples that fill them may be completed and reused; the blank is not for republishing.
// Other document types keep only the CC BY-ND credit line
export const FILL_NOTE = "You may fill in, adapt, and share completed copies of this template for your own work, with or without credit. Please don't republish the blank template as your own."
export const fillNote = (doc) => (["template", "form", "example"].includes(doc.type) ? FILL_NOTE : "")
