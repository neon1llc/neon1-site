// scripts/release-links.mjs - Links each thing a release note or feed row names to that exact thing: a Knowledge Center
// page or section, a page on the site, a corpus file on GitHub, or a release tag. A name with no precise target stays
// plain text. checkGithubLinks() then fails the build on a tag, corpus file, or heading that doesn't exist.

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { esc, CORPUS_BLOB } from "./knowledge-lib.mjs"

const GH = "https://github.com/neon1llc/"
const plain = (s) => String(s).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim()
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// The anchor GitHub gives a Markdown heading
export const githubSlug = (heading) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-")
const headings = (md) => md.split("\n").map((l) => l.match(/^#{1,6} (.+?)\s*$/)?.[1]).filter(Boolean)

// An entry's heading in a changelog, for a version that has no tag to point at
export const changelogUrl = (r) => `${GH}${r.repo}/blob/main/CHANGELOG.md${r.heading ? `#${githubSlug(r.heading)}` : ""}`

// A corpus file's history: every change to that document
export const historyUrl = (source) => `${GH}neon1-corpus/commits/main/${source}`

// Names release notes use for a page that isn't its title. Each value is a corpus path or a site path
const ALIASES = {
  "About": "corpus/company/about.md",
  "Capability statement": "corpus/engagement/capabilities.md",
  "Services page": "corpus/engagement/services.md",
  "1NEON pages guide": "corpus/1neon/pages.md",
  "1NEON projects guide": "corpus/1neon/projects.md",
  "free accounts guide": "corpus/guides/free-accounts.md",
  "account guide": "corpus/guides/free-accounts.md",
  "working-with FAQ": "corpus/faq/working-with-neon1.md",
  "privacy and data policy": "corpus/policies/privacy.md",
  "privacy policy": "corpus/policies/privacy.md",
  "AI-use policy": "corpus/policies/ai-use.md",
  "writing standard": "corpus/standards/writing.md",
  "1NEON overview": "corpus/1neon/overview.md",
  "What's new": "/knowledge/company/whats-new/",
  "releases page": "/knowledge/company/releases/",
  "Report a bug page": "/report-bug/",
}
// One-word titles ("Contact", "Writing") are ordinary words, so they link only when an edition number follows
const distinctive = (name) => /\s/.test(name)

// Every corpus Markdown file's title, so a document the Knowledge Center doesn't show still links to its file
function corpusFiles(dir, rel = "corpus", out = new Map()) {
  if (!dir || !existsSync(join(dir, rel))) return out
  for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const path = `${rel}/${e.name}`
    if (e.isDirectory()) corpusFiles(dir, path, out)
    else if (e.name.endsWith(".md")) out.set(path, readFileSync(join(dir, path), "utf8"))
  }
  return out
}

// The targets: names to addresses, section ids by page, decision records, and corpus tags
export function linkIndex({ docs = [], corpusDir = "", siteDir = "", tags = new Map() } = {}) {
  const bySource = new Map(docs.map((d) => [d.source, d.url]))
  const files = corpusFiles(corpusDir)
  const urlFor = (target) => {
    if (target.startsWith("/")) return target
    return bySource.get(target) ?? (files.has(target) ? CORPUS_BLOB + target : null)
  }
  const names = new Map()
  const sections = new Map()
  // A document the Knowledge Center doesn't show links to its file, under the title its front matter gives
  for (const [path, md] of files) {
    const title = md.match(/^---\n[\s\S]*?^title: *"?(.+?)"? *$/m)?.[1]
    if (title && !path.startsWith("corpus/blog/")) names.set(title, urlFor(path))
  }
  for (const [name, target] of Object.entries(ALIASES)) { const url = urlFor(target); if (url) names.set(name, url) }
  for (const d of docs) {
    names.set(d.title, d.url)
    sections.set(d.title, new Map([...String(d.html ?? "").matchAll(/<h[23] id="([^"]+)"[^>]*>([\s\S]*?)<\/h[23]>/g)].map((m) => [plain(m[2]).toLowerCase(), `${d.url}#${m[1]}`])))
  }
  const records = new Map()
  const adr = "corpus/company/architecture-decisions.md"
  for (const h of headings(files.get(adr) ?? "")) {
    const id = h.match(/^(ADR-\d+)/)?.[1]
    if (id) records.set(id, `${urlFor(adr)}#${bySource.has(adr) ? "" : githubSlug(h)}`)
  }
  return { names, sections, records, tags, siteDir }
}

// A public address on neon1.tech, as written in code: linked when the build holds it (1NEON is another app)
function sitePath(path, siteDir) {
  if (/^\/1NEON\/(live|example)(\/|\?|$)/.test(path)) return path
  if (!/^\/(knowledge|blog|report-bug|feedback)(\/[a-z0-9-]*)*\/?$/.test(path)) return null
  const dir = path.replace(/\/?$/, "/")
  // This build may write the page after the page that links to it, so the feed and releases pages count as present
  if (dir === "/knowledge/company/whats-new/" || dir === "/knowledge/company/releases/") return dir
  return siteDir && existsSync(join(siteDir, dir, "index.html")) ? dir : null
}

// Applies fn to the text between tags, leaving links and code as they are
function inText(html, fn) {
  let skip = 0
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith("<")) {
      if (/^<(a|code)[\s>]/.test(part)) skip++
      else if (/^<\/(a|code)>/.test(part)) skip--
      return part
    }
    return skip || !part ? part : fn(part)
  }).join("")
}

// One entry's HTML with its named things linked, each target once
export function linkEntry(html, index) {
  if (!index) return html
  const used = new Set()
  const held = []
  const hold = (url, label) => { used.add(url); return `\u0001${held.push(`<a href="${esc(url)}">${label}</a>`) - 1}\u0001` }

  // A page's address in code opens that page
  let out = html.replace(/(<a [^>]*>[\s\S]*?<\/a>)|<code>(\/[^<]*)<\/code>/g, (whole, link, path) => {
    if (link) return whole
    const url = sitePath(path, index.siteDir)
    return url && !used.has(url) ? (used.add(url), `<a href="${esc(url)}"><code>${path}</code></a>`) : whole
  })

  // Longest names first, so "How I work with AI" wins over a shorter name inside it
  const names = [...index.names.keys()].sort((a, b) => b.length - a.length)
  const forms = (name) => [esc(name), name]

  out = inText(out, (text) => {
    let s = text
    // "the What to write section of How 1NEON accounts work" links the section itself
    for (const [title, byHeading] of index.sections) {
      for (const t of forms(title)) {
        s = s.replace(new RegExp(`\\b([Tt]he )([^.,;:()\u0001]{2,60}?)( section (?:of|in) )(?=${reEsc(t)}(?![\\w-]))`, "g"), (whole, the, heading, tail) => {
          const url = byHeading.get(plain(heading).toLowerCase())
          return url && !used.has(url) ? `${the}${hold(url, `${heading} section`)}${tail.replace(/^ section/, "")}` : whole
        })
      }
    }
    for (const name of names) {
      const url = index.names.get(name)
      const after = distinctive(name) ? "(?![\\w-])" : "(?= \\(edition )"
      for (const t of forms(name)) {
        if (used.has(url)) break
        s = s.replace(new RegExp(`(?<![\\w/-])${reEsc(t)}${after}`), (m) => hold(url, m))
      }
    }
    s = s.replace(/\bADR-\d+\b/g, (id) => (index.records.has(id) && !used.has(index.records.get(id)) ? hold(index.records.get(id), id) : id))
    // "neon1-corpus v0.52.9" opens that release
    s = s.replace(/\b(neon1-[A-Za-z0-9-]+|refmark|deploy-ops|aws-clip) (v\d+\.\d+\.\d+)\b/g, (whole, repo, tag) => {
      const url = `${GH}${repo}/releases/tag/${tag}`
      return index.tags.get(repo)?.has(tag) && !used.has(url) ? hold(url, whole) : whole
    })
    return s
  })
  return out.replace(/\u0001(\d+)\u0001/g, (_, i) => held[+i])
}

// Every GitHub address these pages write into neon1's repositories: a release must be a known tag, a corpus file must
// exist in the corpus being built, and a heading anchor must match one of that file's headings
export function checkGithubLinks(html, { tags, corpusDir, changelogs = new Map() }) {
  const problems = []
  for (const [, repo, tag] of html.matchAll(/href="https:\/\/github\.com\/neon1llc\/([\w.-]+)\/releases\/tag\/([^"#?]+)"/g)) {
    if (tags.has(repo) && !tags.get(repo).has(tag)) problems.push(`${repo} has no tag ${tag}`)
  }
  for (const [, path, hash] of html.matchAll(/href="https:\/\/github\.com\/neon1llc\/neon1-corpus\/(?:blob|commits)\/main\/(corpus\/[^"#?]+)(?:#([^"]*))?"/g)) {
    if (!corpusDir || !existsSync(join(corpusDir, "corpus"))) continue
    if (!existsSync(join(corpusDir, path))) problems.push(`neon1-corpus has no ${path}`)
    else if (hash && !headings(readFileSync(join(corpusDir, path), "utf8")).some((h) => githubSlug(h) === hash)) problems.push(`${path} has no heading #${hash}`)
  }
  for (const [, repo, hash] of html.matchAll(/href="https:\/\/github\.com\/neon1llc\/([\w.-]+)\/blob\/main\/CHANGELOG\.md#([^"]+)"/g)) {
    if (changelogs.has(repo) && !headings(changelogs.get(repo)).some((h) => githubSlug(h) === hash)) problems.push(`${repo}'s changelog has no heading #${hash}`)
  }
  return [...new Set(problems)]
}
