// scripts/whats-new.test.mjs - Behavior tests for the What's new feed: what counts, how a day groups, and what the
// hand-kept outside list must contain. Run: node --test scripts/
import { test } from "node:test"
import assert from "node:assert/strict"
import { releaseItems, docItems, externalItems, groupByDay, feedBody, SINCE } from "./whats-new-lib.mjs"

const rel = (repo, version, date, tagged = true) => ({ repo, name: repo, version, date, tagged })

// Several versions of one product on one day show once, as the newest, with the count; pre-releases drop out
test("releases collapse to one row per product per day", () => {
  const items = releaseItems([rel("a", "v0.9.0", "2026-11-10"), rel("a", "v0.10.0", "2026-11-10"), rel("a", "v0.10.0-alpha.1", "2026-11-10"), rel("a", "v0.1.0", "2025-09-07"), rel("b", "v0.2.0", "2026-11-10")], { "a@v0.1.0": "first version" })
  assert.equal(items.length, 3)
  assert.equal(items.find((i) => i.date === "2025-09-07").note, "first version")
  const a = items.find((i) => i.repo === "a")
  assert.deepEqual([a.version, a.earlier.map((r) => r.version)], ["v0.10.0", ["v0.9.0"]])
})

// A document written inside the window is new; one first written earlier and edited since is updated
test("documents split new from updated and skip anything before the relaunch", () => {
  const d = (title, created, updated) => ({ title, url: `/knowledge/x/${title}/`, data: { created, updated } })
  const items = docItems([d("n", "2026-11-12", "2026-11-12"), d("u", "2025-09-07", "2026-11-12"), d("old", "2025-09-07", "2026-11-01")])
  assert.deepEqual(items.map((i) => [i.title, i.fresh]), [["n", true], ["u", false]])
})

// The hand-kept file fails the build when a row is incomplete or its link is not https
test("outside updates are validated", () => {
  assert.throws(() => externalItems([{ date: "2026-11-12", source: "Upwork", title: "t" }]), /no url/)
  assert.throws(() => externalItems([{ date: "Nov 12", source: "Upwork", title: "t", url: "https://x.example/" }]), /YYYY-MM-DD/)
  assert.throws(() => externalItems([{ date: "2026-11-12", source: "Upwork", title: "t", url: "http://x.example/" }]), /https/)
  assert.equal(externalItems([{ date: "2026-11-12", source: "Upwork", title: "t", url: "https://x.example/" }]).length, 1)
  assert.equal(externalItems([]).length, 0)
})

// Newest day first, releases before outside updates before documents inside a day
test("days sort newest first with releases leading", () => {
  const days = groupByDay([
    { kind: "doc", date: "2026-11-10", title: "Doc" },
    { kind: "release", date: "2026-11-10", name: "Site" },
    { kind: "external", date: "2026-11-10", source: "LinkedIn" },
    { kind: "release", date: "2026-11-12", name: "Neo" },
  ])
  assert.deepEqual(days.map((d) => d.date), ["2026-11-12", "2026-11-10"])
  assert.deepEqual(days[1].list.map((i) => i.kind), ["release", "external", "doc"])
})

// Releases and outside rows open in a new tab with the arrow; documents stay in the tab; a long run of documents folds
test("rows link the right way and a long document day folds", () => {
  const docs = Array.from({ length: 7 }, (_, i) => ({ kind: "doc", date: "2026-11-10", title: `D${i}`, url: `/knowledge/d${i}/`, fresh: false }))
  const { html, sections } = feedBody([...docs, { kind: "release", date: "2026-11-10", repo: "neon1-chat", name: "Neo", version: "v0.4.0", tagged: true, earlier: [{ version: "v0.3.1", tagged: true }, { version: "v0.1.0", tagged: false, heading: "v0.1.0 - 2026-11-10" }] }, { kind: "external", date: "2026-11-09", source: "Upwork", title: "Profile", url: "https://www.upwork.com/x" }])
  assert.match(html, /<a class="ext" href="https:\/\/github.com\/neon1llc\/neon1-chat\/releases\/tag\/v0.4.0" target="_blank" rel="noopener">Neo <span class="ext-end">v0.4.0<\/span>/)
  assert.match(html, /<a class="ext" href="https:\/\/www.upwork.com\/x"/)
  assert.match(html, /<a href="\/knowledge\/d0\/">D0<\/a>/)
  assert.match(html, /<summary>7 documents updated<\/summary>/)
  // Every older version of the day has its own link; one without a tag opens its changelog entry
  assert.match(html, /releases\/tag\/v0\.3\.1"/)
  assert.match(html, /neon1-chat\/blob\/main\/CHANGELOG\.md#v010---2026-11-10"/)
  assert.deepEqual(sections, [{ heading: "November 2026", key: "m-2026-11" }])
  assert.ok(SINCE === "2026-11-05")
})
