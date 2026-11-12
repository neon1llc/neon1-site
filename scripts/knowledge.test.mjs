// scripts/knowledge.test.mjs - Behavior tests for the knowledge center generator: one H1, internal links, counts
// from the manifest, task paths that fail loudly, and search that finds the words people use. Run: node --test scripts/
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { TASK_PATHS, singleH1, classifyLinks, catalogFacts, keepFields, fillNote, FILL_NOTE, load } from "./knowledge-lib.mjs"
import { prepare, search } from "../src/app/public/js/knowledge-search-core.js"

const here = dirname(fileURLToPath(import.meta.url))
const SHELVES = { guides: { label: "Guides", description: "How-tos.", group: "resources" }, faq: { label: "Questions", description: "Answers.", group: "resources" } }

// A small export in the corpus's bundle shape. Every task-path document exists; a few more carry the test's cases
function fixture({ dropId = null, noPdf = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "kc-test-"))
  const exp = join(root, "export")
  const site = join(root, "site")
  mkdirSync(exp, { recursive: true })
  mkdirSync(join(site, "knowledge"), { recursive: true })
  const docs = new Map()
  const add = (id, title, html, extra = {}) => docs.set(id, {
    id, type: "guide", section: extra.section ?? "guides", title, summary: extra.summary ?? `About ${title}.`, source: `corpus/${id}.md`,
    data: { pdf: !noPdf.includes(id), updated: "2026-11-09", ...extra.data },
    html,
    sections: extra.sections ?? [{ key: "lead", heading: "", headingHtml: "", html }],
  })
  for (const id of TASK_PATHS.flatMap((p) => p.ids)) add(id, `Doc ${id}`, "<p>Plain.</p>")
  const sec = (key, heading, body) => ({ key, heading, headingHtml: heading, html: body })
  add("guides-use-case-cloud", "Use case: cloud", '<aside class="callout"><p>Note</p></aside><h1 id="x">Use case: cloud</h1><p>Body.</p><h2 id="a">Part</h2>')
  add("faq-1neon-help", "1NEON help", '<p>See <a href="https://neon1.tech/knowledge/guides/first-call/">the call guide</a> and <a href="https://example.org/x">elsewhere</a>.</p>', {
    section: "faq",
    sections: [sec("lead", "", "<p>Short answers.</p>"), sec("sign-in", "Signing in", "<p>1NEON supports passkeys (WebAuthn) and an authenticator app (TOTP) for two-factor sign-in.</p>")],
  })
  add("guides-password-manager-for-family", "Password manager for a family", "<p>Turn on MFA and 2FA everywhere. Check the Wi-Fi router too, and your home WiFi password.</p>")
  add("guides-spot-phishing", "Spotting phishing", "<p>Phishing messages and ransomware demands are the two things I see most.</p>")
  add("guides-backups-you-can-trust", "Backups you can trust", "<h2 id=\"ransom\">Ransomware</h2><p>A backup you cannot restore is not a backup. Backups matter against ransomware.</p>", {
    sections: [sec("lead", "", "<p>Start here.</p>"), sec("ransom", "Ransomware", "<p>Ransomware locks your files, so a backup you cannot restore is not a backup.</p>")],
  })
  if (dropId) docs.delete(dropId)
  const list = [...docs.values()]
  for (const d of list) writeFileSync(join(exp, `${d.id}.json`), JSON.stringify(d))
  writeFileSync(join(exp, "manifest.json"), JSON.stringify({ target: "knowledge", groups: { resources: { label: "For you", description: "Docs." } }, shelves: SHELVES, files: list.map((d) => ({ id: d.id, json: `${d.id}.json` })) }))
  const frame = (n) => `<!-- frame:${n} -->x<!-- /frame:${n} -->`
  // The bar and phone menu links come from the home page, so the fixture home page carries a few
  const bar = `<ul class="links">\n        <li><a href="#work">p.r.o.s.e</a></li>\n        <li><a href="/knowledge/">knowledge</a></li>\n        ${frame("actions")}</ul>`
  const menu = `<div class="menu" id="menu" hidden>\n    <ul>\n      <li><a href="#work">p.r.o.s.e</a></li>\n      <li><a href="/1NEON/" data-handoff>1NEON client portal</a></li>\n    </ul>\n  </div>`
  writeFileSync(join(site, "index.html"), `<meta name="version" content="v0">${["logo", "menu-button", "footer"].map(frame).join("")}${bar}${menu}`)
  writeFileSync(join(site, "sitemap.xml"), "<urlset>\n  <!-- knowledge -->\n  <!-- /knowledge -->\n</urlset>")
  return { exp, site, list }
}

const build = (f) => spawnSync(process.execPath, [join(here, "knowledge.mjs"), "sync", f.site, f.exp], { encoding: "utf8" })
const read = (f, path) => readFileSync(join(f.site, path), "utf8")

test("a body H1 that repeats the title is dropped, even after a callout, leaving one H1", () => {
  const f = fixture()
  assert.equal(build(f).status, 0)
  const html = read(f, "knowledge/guides/use-case-cloud/index.html")
  assert.equal((html.match(/<h1\b/g) || []).length, 1)
  assert.match(html, /<h2 id="a">Part<\/h2>/)
  assert.equal((singleH1("<h1>Other</h1><p>x</p>", "Title").match(/<h1/g) || []).length, 0, "a different body H1 is demoted, not kept")
  assert.match(singleH1("<h1>Other</h1>", "Title"), /<h2>Other<\/h2>/)
})

test("same-origin absolute links are internal; other origins open in a new tab", () => {
  assert.equal(classifyLinks('<a href="https://neon1.tech/knowledge/x/">a</a>'), '<a href="/knowledge/x/">a</a>')
  assert.equal(classifyLinks('<a href="https://neon1.tech">a</a>'), '<a href="/">a</a>')
  assert.match(classifyLinks('<a href="https://example.org/">a</a>'), /target="_blank" rel="noopener"/)
  // A lookalike host is not this site
  assert.match(classifyLinks('<a href="https://neon1.tech.evil.example/">a</a>'), /target="_blank"/)
  const f = fixture()
  build(f)
  const html = read(f, "knowledge/faq/1neon-help/index.html")
  assert.match(html, /<a href="\/knowledge\/guides\/first-call\/">the call guide<\/a>/)
  for (const tag of html.match(/<a [^>]*>/g)) assert.ok(!(tag.includes("neon1.tech") && tag.includes("_blank")), tag)
})

test("counts and the PDF claim come from the manifest, in the text and the head", () => {
  const f = fixture({ noPdf: ["guides-spot-phishing", "faq-1neon-help"] })
  build(f)
  const total = f.list.length
  const pdfs = f.list.filter((d) => d.data.pdf).length
  const facts = catalogFacts(load(f.exp).docs)
  assert.equal(facts.count, total)
  assert.equal(facts.pdfs, pdfs)
  const html = read(f, "knowledge/index.html")
  const claim = `${total} documents, ${pdfs} with a PDF to download`
  assert.ok(html.includes(`${claim}.</p>`), "visible lead")
  assert.ok(html.includes(`content="neon1&#x27;s public documents`) && html.match(/name="description" content="[^"]*"/)[0].includes(claim), "description meta")
  assert.doesNotMatch(html, /each with a PDF/)
  // Every document with a PDF says so, and a document without one does not
  assert.equal(catalogFacts([{ pdf: null }]).pdfClaim, "")
})

test("task paths link existing documents, and the build fails when one disappears", () => {
  const f = fixture()
  assert.equal(build(f).status, 0)
  const html = read(f, "knowledge/index.html")
  assert.equal(TASK_PATHS.length, 4)
  for (const p of TASK_PATHS) {
    assert.ok(p.ids.length >= 2 && p.ids.length <= 3)
    for (const id of p.ids) assert.ok(html.includes(`<li><a href="${load(f.exp).byId.get(id).url}">`), id)
  }
  assert.match(html, /href="\/#contact"/)
  const gone = fixture({ dropId: TASK_PATHS[0].ids[0] })
  const r = build(gone)
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, new RegExp(TASK_PATHS[0].ids[0]))
})

// What each query must surface, as document ids. The fixture and the release-built corpus both have to satisfy these
const QUERIES = {
  passkey: ["faq-1neon-help"],
  authenticator: ["faq-1neon-help"],
  mfa: ["guides-password-manager-for-family", "faq-1neon-help"],
  wifi: ["guides-password-manager-for-family"],
  "wi-fi": ["guides-password-manager-for-family"],
  "two factor": ["faq-1neon-help"],
  "two-factor": ["faq-1neon-help"],
  phishing: ["guides-spot-phishing"],
  ransomware: ["guides-backups-you-can-trust"],
}
const rank = (exp, q) => {
  const corpus = load(exp)
  const byUrl = new Map(corpus.docs.map((d) => [d.url, d.id]))
  const index = JSON.parse(readFileSync(join(exp, "..", "site", "knowledge", "search-index.json"), "utf8"))
  return search(prepare(index), q).results.map((r) => byUrl.get(r.url.split("#")[0]))
}

test("the listed queries return relevant documents from the built index", () => {
  const f = fixture()
  build(f)
  for (const [q, ids] of Object.entries(QUERIES)) {
    const got = rank(f.exp, q)
    for (const id of ids) assert.ok(got.includes(id), `${q} should find ${id}, got ${got.join(", ")}`)
  }
  // Title and heading matches outrank a body mention, and a heading match links to its section
  const res = search(prepare(JSON.parse(read(f, "knowledge/search-index.json"))), "ransomware").results
  assert.equal(res[0].url, "/knowledge/guides/backups-you-can-trust/#ransom")
  assert.ok(res[0].snippet.some((p) => p.hit))
  // Nonsense finds nothing, so the empty state shows
  assert.equal(search(prepare(JSON.parse(read(f, "knowledge/search-index.json"))), "zzqx").results.length, 0)
})

// The same queries against the real export of CORPUS_TAG, when a checkout has built one (make knowledge-export)
const realExport = join(here, "..", ".corpus", "export", "knowledge")
test("the listed queries return documents from the built corpus", { skip: !existsSync(join(realExport, "manifest.json")) }, () => {
  const site = mkdtempSync(join(tmpdir(), "kc-real-"))
  mkdirSync(join(site, "knowledge"), { recursive: true })
  const src = join(here, "..", "src", "app", "public")
  writeFileSync(join(site, "index.html"), readFileSync(join(src, "index.html")))
  writeFileSync(join(site, "sitemap.xml"), readFileSync(join(src, "sitemap.xml")))
  assert.equal(spawnSync(process.execPath, [join(here, "knowledge.mjs"), "sync", site, realExport]).status, 0)
  const corpus = load(realExport)
  const byUrl = new Map(corpus.docs.map((d) => [d.url, d.id]))
  const prepared = prepare(JSON.parse(readFileSync(join(site, "knowledge", "search-index.json"), "utf8")))
  const expect = {
    passkey: "faq-1neon-help", authenticator: "faq-1neon-help", mfa: "company-glossary", wifi: "guides-password-manager-for-family",
    "wi-fi": "guides-password-manager-for-family", "two factor": "case-security-for-non-security-people", "two-factor": "case-security-for-non-security-people",
    phishing: "guides-use-case-security-awareness", ransomware: "guides-backups-you-can-trust",
  }
  for (const [q, id] of Object.entries(expect)) {
    const got = search(prepared, q).results.map((r) => byUrl.get(r.url.split("#")[0]))
    // The top 10: product pages on the same topic (Phish Out of Water) can fairly rank beside the guide
    assert.ok(got.slice(0, 10).includes(id), `${q} should rank ${id} near the top, got ${got.slice(0, 10).join(", ")}`)
  }
})

test("a printed label and its blank are wrapped as one unit", () => {
  const blank = '<span class="blank" role="img" aria-label="blank to fill in"></span>'
  assert.equal(keepFields(`<strong>Date:</strong> ${blank}`), `<span class="field"><strong>Date:</strong> ${blank}</span>`)
  assert.equal(keepFields("<strong>Note:</strong> text"), "<strong>Note:</strong> text")
})

test("only templates, forms, and examples carry the fill-in permission", () => {
  for (const type of ["template", "form", "example"]) assert.equal(fillNote({ type }), FILL_NOTE)
  for (const type of ["guide", "policy", "standard", "faq"]) assert.equal(fillNote({ type }), "")
  const f = fixture()
  f.list.find((d) => d.id === "guides-spot-phishing").type = "template"
  writeFileSync(join(f.exp, "guides-spot-phishing.json"), JSON.stringify(f.list.find((d) => d.id === "guides-spot-phishing")))
  build(f)
  assert.ok(read(f, "knowledge/guides/spot-phishing/index.html").includes("Please don&#x27;t republish the blank template as your own."))
  assert.ok(!read(f, "knowledge/guides/use-case-cloud/index.html").includes("republish the blank"))
})

// An outbound link's last word carries the arrow and never parts from it at a line break
test("bindExtArrows keeps the arrow with the last word", async () => {
  const { bindExtArrows } = await import("./knowledge-lib.mjs")
  assert.equal(bindExtArrows('<a class="ext" href="x">WCAG 2.2</a>'), '<a class="ext" href="x">WCAG <span class="ext-end">2.2</span></a>')
  assert.equal(bindExtArrows('<a class="ext" href="x">one</a>'), '<a class="ext" href="x"><span class="ext-end">one</span></a>')
  assert.equal(bindExtArrows('<a class="ext" href="x"><code>a b</code></a>'), '<a class="ext" href="x"><span class="ext-end"><code>a b</code></span></a>')
  const once = bindExtArrows('<a class="ext" href="x">a b</a>')
  assert.equal(bindExtArrows(once), once)
  assert.match(bindExtArrows('<a class="ext" href="x">github.com/neon1llc/neon1-corpus</a>'), /neon1llc\/neon1-co<span class="ext-end">rpus<\/span>/)
})

test("the bar and phone menu use the home page's links and words, pointed back at the home page", () => {
  const f = fixture()
  assert.equal(build(f).status, 0)
  const html = read(f, "knowledge/index.html")
  assert.match(html, /<li><a href="\/#work">p\.r\.o\.s\.e<\/a><\/li>/)
  assert.match(html, /<a href="\/knowledge\/" aria-current="page">knowledge<\/a>/)
  assert.match(html, /<a href="\/1NEON\/" data-handoff>1NEON client portal<\/a>/)
  assert.doesNotMatch(html, /tools I'm building|href="#work"/)
})
