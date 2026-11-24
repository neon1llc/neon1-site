// scripts/whats-new-lib.mjs - The "What's new" page (/knowledge/company/whats-new/): one feed of releases, updated
// documents, and hand-listed outside updates since the relaunch, newest day first. scripts/knowledge.mjs calls
// feedBody() with the releases gathered by releases-lib.mjs, the corpus documents, and scripts/whats-new-external.json.
// Releases and documents are never typed here, so the page can't drift from GitHub or the corpus.

import { esc, longDate, classifyLinks, bindExtArrows, BASE, SITE } from "./knowledge-lib.mjs"

const GH = "https://github.com/neon1llc/"

// The day neon1.tech went back up (the 2025 landing page was restored on 2026-11-05); nothing earlier is listed
export const SINCE = "2026-11-05"

// More documents than this on one day fold into a single line, so a corpus-wide edit doesn't bury the releases
const FOLD_AT = 6

export const WHATS_NEW_URL = `${BASE}company/whats-new/`


// ---- Turning sources into one list of items ----

// Plain version order, newest last
const cmp = (a, b) => {
  const p = (v) => v.replace(/^v/, "").split(".").map(Number)
  const [x, y] = [p(a), p(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

// One item per product per day: the newest version that day, and how many shipped. Pre-releases and anything before SINCE drop out
export function releaseItems(all) {
  const byKey = new Map()
  for (const r of all) {
    if (r.version.includes("-") || !r.date || r.date < SINCE) continue
    const key = `${r.date}|${r.repo}`
    if (!byKey.has(key)) byKey.set(key, { kind: "release", date: r.date, repo: r.repo, name: r.name, runs: [] })
    byKey.get(key).runs.push(r)
  }
  return [...byKey.values()].map(({ runs, ...it }) => {
    const top = runs.sort((a, b) => cmp(b.version, a.version))[0]
    return { ...it, version: top.version, tagged: top.tagged, count: runs.length }
  })
}

// Corpus documents updated since SINCE. A document first written in the window is new, any other is updated
export function docItems(docs) {
  return docs
    .filter((d) => d.data.updated && d.data.updated >= SINCE)
    .map((d) => ({ kind: "doc", date: d.data.updated, title: d.title, url: d.url, fresh: (d.data.created || "") >= SINCE }))
}

// Entries of the hand-kept file: { date, source, title, url }. Anything malformed fails the build rather than showing half a row
export function externalItems(list) {
  return list.map((e, i) => {
    for (const k of ["date", "source", "title", "url"]) if (!e[k]) throw new Error(`whats-new-external.json item ${i} has no ${k}`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error(`whats-new-external.json item ${i} has a date that is not YYYY-MM-DD`)
    if (!/^https:\/\//.test(e.url)) throw new Error(`whats-new-external.json item ${i} needs an https url`)
    return { kind: "external", ...e }
  }).filter((e) => e.date >= SINCE)
}


// ---- The page ----

// Newest day first; inside a day: releases, then outside updates, then documents
const ORDER = { release: 0, external: 1, doc: 2 }
const label = (i) => i.name || i.source || i.title
export function groupByDay(items) {
  const days = new Map()
  for (const it of items) (days.get(it.date) ?? days.set(it.date, []).get(it.date)).push(it)
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({ date, list: list.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || label(a).localeCompare(label(b))) }))
}

const relUrl = (r) => (r.tagged ? `${GH}${r.repo}/releases/tag/${r.version}` : `${GH}${r.repo}/blob/main/CHANGELOG.md`)

// One row; a release or outside update links out, a document links to its own page
function itemHtml(it) {
  if (it.kind === "release") {
    return `<li><a href="${esc(relUrl(it))}">${esc(it.name)} ${esc(it.version)}</a>${it.count > 1 ? `<span class="kc-new-n"> · ${it.count} releases</span>` : ""}</li>`
  }
  if (it.kind === "external") return `<li><a href="${esc(it.url)}">${esc(it.source)}: ${esc(it.title)}</a></li>`
  return `<li><a href="${esc(it.url)}">${esc(it.title)}</a><span class="kc-new-n"> · ${it.fresh ? "new" : "updated"}</span></li>`
}

// One day: its date as a heading, then its items; a long run of documents folds
function dayHtml({ date, list }) {
  const docs = list.filter((i) => i.kind === "doc")
  const rest = list.filter((i) => i.kind !== "doc")
  const folded = docs.length > FOLD_AT
  const docHtml = folded
    ? `\n<details class="n1-fold kc-fold kc-new-docs"><summary>${docs.length} documents updated</summary><ul class="kc-new-list">${docs.map(itemHtml).join("")}</ul></details>`
    : ""
  return `<section class="kc-new-day" aria-labelledby="d-${date}">
<h3 id="d-${date}">${longDate(date)}</h3>
<ul class="kc-new-list">${[...rest, ...(folded ? [] : docs)].map(itemHtml).join("")}</ul>${docHtml}
</section>`
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
export const monthLabel = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`

// The body docMain wraps: one heading per month, days under it. sections feeds docMain's contents list
export function feedBody(items) {
  const days = groupByDay(items)
  const months = []
  for (const d of days) {
    const key = d.date.slice(0, 7)
    if (!months.length || months.at(-1).key !== key) months.push({ key, label: monthLabel(d.date), days: [] })
    months.at(-1).days.push(d)
  }
  const html = months.map((m) => `<h2 id="m-${m.key}">${m.label}</h2>\n${m.days.map(dayHtml).join("\n")}`).join("\n\n")
  return { html: bindExtArrows(classifyLinks(html)), sections: months.map((m) => ({ heading: m.label, key: `m-${m.key}` })), latest: days[0]?.date }
}

export const whatsNewLd = (updated) => ({ "@type": "CollectionPage", "@id": `${SITE}${WHATS_NEW_URL}#page`, url: `${SITE}${WHATS_NEW_URL}`, name: "What's new at neon1", inLanguage: "en-US", ...(updated ? { dateModified: updated } : {}) })
