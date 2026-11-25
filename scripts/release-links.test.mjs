// scripts/release-links.test.mjs - Behavior tests for the links release notes get: each named thing opens that thing,
// a name with no target stays text, and a GitHub address that doesn't exist is reported. Run: node --test scripts/
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { linkIndex, linkEntry, checkGithubLinks, githubSlug } from "./release-links.mjs"

const root = mkdtempSync(join(tmpdir(), "links-test-"))
mkdirSync(join(root, "corpus/company"), { recursive: true })
mkdirSync(join(root, "corpus/1neon"), { recursive: true })
writeFileSync(join(root, "corpus/company/architecture-decisions.md"), "# Architecture decisions\n\n## ADR-001: Static first\n")
writeFileSync(join(root, "corpus/1neon/pages.md"), "# 1NEON pages\n")
mkdirSync(join(root, "site/report-bug"), { recursive: true })
writeFileSync(join(root, "site/report-bug/index.html"), "x")

const docs = [
  { title: "How 1NEON accounts work", url: "/knowledge/guides/free-accounts/", source: "corpus/guides/free-accounts.md", html: '<h2 id="what-to-write">What to write</h2>' },
  { title: "Contact", url: "/knowledge/engagement/contact/", source: "corpus/engagement/contact.md" },
  { title: "About neon1", url: "/knowledge/company/about/", source: "corpus/company/about.md" },
]
const tags = new Map([["neon1-corpus", new Set(["v0.52.9"])]])
const index = linkIndex({ docs, corpusDir: root, siteDir: join(root, "site"), tags })

test("a named section, page, file, record, and release each open that exact thing, once", () => {
  const html = linkEntry("<li>the What to write section of How 1NEON accounts work. About (edition 2.9), the 1NEON pages guide, ADR-001, neon1-corpus v0.52.9, <code>/report-bug</code>. About (edition 3).</li>", index)
  assert.match(html, /the <a href="\/knowledge\/guides\/free-accounts\/#what-to-write">What to write section<\/a> of <a href="\/knowledge\/guides\/free-accounts\/">How 1NEON accounts work<\/a>/)
  assert.match(html, /<a href="\/knowledge\/company\/about\/">About<\/a> \(edition 2\.9\)/)
  assert.match(html, /blob\/main\/corpus\/1neon\/pages\.md">1NEON pages guide</)
  assert.match(html, /architecture-decisions\.md#adr-001-static-first">ADR-001</)
  assert.match(html, /releases\/tag\/v0\.52\.9">neon1-corpus v0\.52\.9</)
  assert.match(html, /<a href="\/report-bug\/"><code>\/report-bug<\/code><\/a>/)
  assert.equal(html.match(/company\/about\//g).length, 1)
})

test("no precise target, no link", () => {
  const text = "<li>Contact says the call is free. Contacts page. <code>/knowledge/gone/</code> and neon1-corpus v9.9.9. <a href=\"#x\">About (edition 1)</a></li>"
  assert.equal(linkEntry(text, index), text)
})

test("GitHub addresses that don't exist are reported", () => {
  const gh = "https://github.com/neon1llc/"
  const html = `<a href="${gh}neon1-corpus/releases/tag/v9.9.9"></a><a href="${gh}neon1-corpus/blob/main/corpus/gone.md"></a><a href="${gh}neon1-corpus/blob/main/corpus/company/architecture-decisions.md#adr-9"></a><a href="${gh}neon1-site/blob/main/CHANGELOG.md#v012---2025-11-02"></a>`
  const found = checkGithubLinks(html, { tags, corpusDir: root, changelogs: new Map([["neon1-site", "## v0.1.2 - 2025-11-02\n"]]) })
  assert.equal(found.length, 3)
  assert.equal(githubSlug("v0.1.2 - 2025-11-02"), "v012---2025-11-02")
})
