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
  return { manifest, docs, byId, bySource, shelves }
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
