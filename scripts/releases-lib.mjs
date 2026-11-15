// scripts/releases-lib.mjs - The Knowledge Center's releases page (/knowledge/releases/), written from each public
// neon1 repository's CHANGELOG.md at its newest release tag. scripts/knowledge.mjs calls releasesPage() with the
// folder that `make releases-export` fills: <repo>.md (the changelog) and <repo>.tags (each tag and its date).
// Nothing is written by hand, so the page can't drift from the changelogs or from GitHub's Releases pages.

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { esc, longDate, classifyLinks, bindExtArrows, BASE, SITE } from "./knowledge-lib.mjs"


// ---- Which repositories, under the names readers know them by ----

// Order is the order of the current-versions table. The org profile repository (.github) has no releases
export const PRODUCTS = [
  ["neon1-site", "neon1.tech"],
  ["neon1-1NEON", "1NEON"],
  ["neon1-chat", "Neo"],
  ["neon1-corpus", "Knowledge Center documents"],
  ["neon1-aws-infrastructure", "neon1's AWS infrastructure"],
  ["refmark", "Refmark"],
  ["deploy-ops", "DeployOps"],
  ["aws-clip", "AWS CLIP"],
  ["ready-secure-go", "Ready Secure Go"],
  ["soc-2-readiness", "SOC 2 readiness"],
  ["compliance-basics", "Compliance basics"],
  ["incident-response-for-small-teams", "Incident response for small teams"],
  ["phishing-awareness-kit", "Phishing awareness kit"],
  ["household-tech-handbook", "Household tech handbook"],
]
export const REPOS = PRODUCTS.map(([r]) => r)
const GH = "https://github.com/neon1llc/"

// How many releases the timeline shows; every older one is a click away on GitHub
export const RECENT = 40


// ---- Reading a changelog ----

// Every "## vX.Y.Z" or "### vX.Y.Z-alpha.N" heading starts an entry, with an optional " - YYYY-MM-DD"; any other
// "## " heading (Unreleased, Before v0.1.0) ends one. Unreleased work is never shown
const HEAD = /^(#{2,3}) (v\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)(?:\s*[-–]\s*(\d{4}-\d{2}-\d{2}))?\s*$/
export function parseChangelog(text) {
  const out = []
  let cur = null
  for (const line of text.split("\n")) {
    const m = line.match(HEAD)
    if (m) { cur = { version: m[2], date: m[3] || "", lines: [] }; out.push(cur); continue }
    if (line.startsWith("## ")) { cur = null; continue }
    if (cur && !line.trim().startsWith("<!-- commit:")) cur.lines.push(line)
  }
  return out.map((e) => ({ version: e.version, date: e.date, md: e.lines.join("\n").trim() }))
}

// "v0.13.0 2026-11-15" per line, from git for-each-ref on the repository's tags
export function parseTags(text) {
  return new Map(text.split("\n").filter(Boolean).map((l) => l.trim().split(/\s+/)).map(([t, d]) => [t, d]))
}

// Newest first by number; a pre-release sorts below its release
export function compareVersions(a, b) {
  const parse = (v) => { const m = v.match(/^v(\d+)\.(\d+)\.(\d+)(?:-[a-z]+\.(\d+))?/) || []; return [+m[1], +m[2], +m[3], m[4] === undefined ? Infinity : +m[4]] }
  const x = parse(a), y = parse(b)
  for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return y[i] - x[i]
  return 0
}


// ---- A changelog entry's Markdown as HTML ----

// Changelogs use a small part of Markdown: headings, bullets (one level of nesting), paragraphs, bold, code, and
// links. Everything is escaped first. A relative link points into its repository at that release's tag
function inline(text, repo, tag) {
  const codes = []
  // Code is lifted out of the already escaped text, so it is never escaped twice or read as bold or a link
  let s = esc(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`)
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const url = href.replace(/&amp;/g, "&")
    const abs = /^(https?:|mailto:|#)/.test(url) ? url : `${GH}${repo}/blob/${tag}/${url.replace(/^\.?\//, "")}`
    return `<a href="${esc(abs)}">${label}</a>`
  })
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`)
}

export function entryHtml(md, repo, tag) {
  const out = []
  let para = [], list = null
  const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(" "), repo, tag)}</p>`); para = [] }
  const flushList = () => {
    if (!list) return
    out.push(`<ul>\n${list.map((i) => `<li>${inline(i.text, repo, tag)}${i.sub.length ? `<ul>${i.sub.map((s) => `<li>${inline(s, repo, tag)}</li>`).join("")}</ul>` : ""}</li>`).join("\n")}\n</ul>`)
    list = null
  }
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\s+$/, "")
    const head = line.match(/^#{3,6} (.+)/)
    const item = line.match(/^- (.*)/)
    const sub = line.match(/^ {2,}- (.*)/)
    if (!line.trim()) { flushPara(); flushList(); continue }
    if (head) { flushPara(); flushList(); out.push(`<p class="kc-rel-kind">${inline(head[1], repo, tag)}</p>`); continue }
    if (item) { flushPara(); list ??= []; list.push({ text: item[1], sub: [] }); continue }
    if (sub && list) { list.at(-1).sub.push(sub[1]); continue }
    // A wrapped line continues the bullet or paragraph above it
    if (list) list.at(-1).text += " " + line.trim()
    else para.push(line.trim())
  }
  flushPara(); flushList()
  return out.join("\n")
}


// ---- Gathering every release ----

// One release per changelog entry. Its date is the changelog's, or else its tag's, or else (an entry never
// tagged, which some early site versions are) the date of the next newer entry. Only tagged versions link to
// their GitHub release
export function gather(dir) {
  const all = [], current = []
  for (const [repo, name] of PRODUCTS) {
    const file = join(dir, `${repo}.md`)
    if (!existsSync(file)) continue
    const tags = existsSync(join(dir, `${repo}.tags`)) ? parseTags(readFileSync(join(dir, `${repo}.tags`), "utf8")) : new Map()
    const entries = parseChangelog(readFileSync(file, "utf8"))
    let carry = ""
    for (const e of entries) {
      const date = e.date || tags.get(e.version) || carry
      carry = date
      all.push({ repo, name, ...e, date, tagged: tags.has(e.version) })
    }
    const top = entries.find((e) => !e.version.includes("-"))
    if (top) current.push({ repo, name, version: top.version, date: all.find((x) => x.repo === repo && x.version === top.version).date })
  }
  all.sort((a, b) => b.date.localeCompare(a.date) || compareVersions(a.version, b.version) || REPOS.indexOf(a.repo) - REPOS.indexOf(b.repo))
  return { all, current }
}


// ---- The page ----

export const RELEASES_URL = `${BASE}releases/`

// The body docMain wraps: the current versions, then the newest releases across every product
// The page links to GitHub dozens of times, so only links inside the release notes and each product's name
// (its full history) carry the outbound arrow; version numbers open GitHub without one (the link rule's exception)
const plainOut = (href, text) => `<a class="kc-plain" href="${href}" target="_blank" rel="noopener">${text}</a>`
export function releasesBody({ all, current }) {
  const relUrl = (r) => (r.tagged ? `${GH}${r.repo}/releases/tag/${r.version}` : `${GH}${r.repo}/blob/main/CHANGELOG.md`)
  // Each product links to its whole history on GitHub; the version opens that release's notes
  const table = `<h2 id="current">Current versions</h2>
<table>
<thead><tr><th>Product</th><th>Version</th></tr></thead>
<tbody>
${current.map((c) => `<tr><td><a href="${GH}${c.repo}/releases">${esc(c.name)}</a></td><td>${plainOut(`${GH}${c.repo}/releases/tag/${c.version}`, c.version)}</td></tr>`).join("\n")}
</tbody>
</table>`
  const recent = all.slice(0, RECENT).map((r) => `<section class="kc-rel" aria-labelledby="${r.repo}-${r.version}">
<h3 id="${r.repo}-${r.version}">${esc(r.name)} ${plainOut(relUrl(r), r.version)}</h3>
<p class="kc-rel-date">${r.date ? longDate(r.date) : ""}</p>
${entryHtml(r.md, r.repo, r.version)}
</section>`).join("\n")
  const html = `${table}

<h2 id="recent">Newest releases</h2>
${recent}`
  return bindExtArrows(classifyLinks(html))
}

export const releasesSections = [{ heading: "Current versions", key: "current" }, { heading: "Newest releases", key: "recent" }]

// The pin the deploy watch compares: every repository's newest tag, so a new release anywhere republishes the page
export const pinOf = (dir) => (existsSync(join(dir, "pin.txt")) ? readFileSync(join(dir, "pin.txt"), "utf8").trim() : "local")

export const releasesLd = (updated) => ({ "@type": "CollectionPage", "@id": `${SITE}${RELEASES_URL}#page`, url: `${SITE}${RELEASES_URL}`, name: "neon1 releases", inLanguage: "en-US", ...(updated ? { dateModified: updated } : {}) })
