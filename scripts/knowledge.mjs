#!/usr/bin/env node
// scripts/knowledge.mjs - Writes the Knowledge Center (/knowledge/) from neon1-corpus, or checks it matches.
// Usage: node scripts/knowledge.mjs sync|check SITE_DIR CORPUS_EXPORT [BLOG_EXPORT]   (make knowledge, and make knowledge-check)
//
// CORPUS_EXPORT is the corpus's knowledge bundle (tools/export.mjs --target knowledge) from CORPUS_TAG, the newest
// corpus release unless the Makefile is told otherwise. Every document becomes /knowledge/<shelf>/<slug>/index.html,
// and the shelves and search live at /knowledge/index.html. The folder is built, never committed: make content
// writes it before checks and deploys, so each release carries static pages from one corpus release, and
// /knowledge/corpus.json names that release for the deploy job's watch. The bar and footer come from index.html's
// frame blocks, so they match every other page. sync rewrites the folder; check fails if anything differs.
// PDFs are not written here: scripts/knowledge-pdf.mjs prints them in the deploy job.

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { load, pageBody, relink, classifyLinks, bindExtArrows, catalogFacts, fillNote, TASK_PATHS, searchIndex, esc, longDate, TYPE_LABELS, SITE, BASE, slugOf } from "./knowledge-lib.mjs"
import { homeFrame, page as page_, ORG, WEBSITE, AUTHOR, LICENSE, OG_IMAGE, crumbs, band, card as cardOf, CORPUS_LINK, rights, dateFacts, docMain, sitemapWith, syncFolder } from "./page-shell.mjs"


// BLOG_EXPORT, the corpus's blog bundle, adds the blog's posts to llms.txt, which this script writes whole
const [mode, siteDir, exportDir, blogDir] = process.argv.slice(2)
if (!["sync", "check"].includes(mode) || !siteDir || !exportDir) {
  console.error("usage: node scripts/knowledge.mjs sync|check SITE_DIR CORPUS_EXPORT [BLOG_EXPORT]")
  process.exit(2)
}

const corpus = load(exportDir)
const home = readFileSync(join(siteDir, "index.html"), "utf8")
const frame = homeFrame(home)

// An open page: the PDF opens in the browser's own viewer, which can save or print it from there
const ICON_VIEW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/></svg>'
const ICON_PDF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"/></svg>'


// Structured data (ORG, WEBSITE, AUTHOR, and crumbs) comes from page-shell.mjs, shared with the blog
// Plain text from a section's HTML, for answers in FAQ data
const plain = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim()


// Every Knowledge Center page is the shared page (scripts/page-shell.mjs) with its own styles and scripts
const page = (opts) => page_(frame, {
  ...opts,
  current: "knowledge",
  generator: "scripts/knowledge.mjs from neon1-corpus. Edit the corpus, then run make knowledge",
  styles: ["/css/knowledge.css"],
  scripts: ["/js/knowledge.js", "/js/knowledge-toc.js"],
})


// A document as a small card: title, summary, and whether it has a PDF. The shelf heading already
// names the kind, so the card doesn't repeat it. Search reads search-index.json, not the cards
const card = (d) => cardOf({ url: d.url, title: d.title, summary: d.summary, tags: d.pdf ? ["PDF"] : [] })


// The four task paths come from knowledge-lib.mjs. The build fails if a chosen document disappears, so a path never points at nothing
const PATHS = TASK_PATHS
for (const p of PATHS) for (const id of p.ids) if (!corpus.byId.has(id)) {
  console.error(`knowledge: task path "${p.title}" names ${id}, which is not in the corpus export`)
  process.exit(1)
}

function pathsSection() {
  return `    <section class="kc-paths" aria-labelledby="kc-paths-h">
      <h2 id="kc-paths-h">Start here</h2>
      <ul class="kc-path-list">
${PATHS.map((p) => `        <li class="kc-path">
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.blurb)}</p>
          <ul>
${p.ids.map((id) => `            <li><a href="${corpus.byId.get(id).url}">${esc(corpus.byId.get(id).title)}</a></li>`).join("\n")}
          </ul>
        </li>`).join("\n")}
      </ul>
      <p class="kc-paths-more">Not sure where you fit? <a href="/#services">See what I offer</a> or <a href="/#contact">get in touch</a>.</p>
    </section>`
}


// The front door: what this is, a search box, then the two groups and their shelves. Featured documents
// lead their shelf, and documents for developers sit in a closed fold at its end
const DEVELOPERS = "Developers"
const cardList = (docs) => `<ul class="kc-cards">
${docs.map(card).join("\n")}
        </ul>`
function shelfSection(s) {
  const lead = s.docs.filter((d) => d.data.featured)
  const rest = s.docs.filter((d) => !d.data.featured && d.data.audience !== DEVELOPERS)
  const dev = s.docs.filter((d) => !d.data.featured && d.data.audience === DEVELOPERS)
  const fold = dev.length
    ? `
        <details class="kc-fold">
          <summary>For developers <span>${dev.length}</span></summary>
          ${cardList(dev)}
        </details>`
    : ""
  return `      <section class="kc-shelf" id="${s.key}" aria-labelledby="${s.key}-h">
        <div class="kc-shelf-head">
          <h3 id="${s.key}-h">${esc(s.label)}</h3>
          <p>${esc(s.description)}</p>
        </div>
        ${cardList([...lead, ...rest])}${fold}
      </section>`
}

function indexPage() {
  const facts = catalogFacts(corpus.docs)
  const groups = corpus.groups
    .map((g) => `    <section class="kc-group" id="${g.key}" aria-labelledby="${g.key}-h">
      <div class="kc-group-head">
        <h2 id="${g.key}-h">${esc(g.label)}</h2>
        <p>${esc(g.description)}</p>
      </div>
${g.shelves.map(shelfSection).join("\n\n")}
    </section>`)
    .join("\n\n")
  const nav = corpus.groups
    .map((g) => `        <li class="kc-nav-group"><span>${esc(g.label)}</span></li>
${g.shelves.map((s) => `        <li><a href="#${s.key}">${esc(s.label)} <span>${s.docs.length}</span></a></li>`).join("\n")}`)
    .join("\n")
  const main = `${band({ id: "kc-title", eyebrow: "neon1 · knowledge center", title: "Everything neon1", lead: `Guides, templates, forms, and filled-out examples, plus how I work, services, and policies. ${facts.summary}.`, after: `
        <form class="kc-search" role="search" action="${BASE}" method="get" hidden>
          <label for="kc-q">Search the knowledge center</label>
          <input id="kc-q" name="q" type="search" placeholder="Try &quot;backup&quot;, &quot;passkey&quot;, or &quot;privacy&quot;" autocomplete="off" />
          <p class="kc-results" id="kc-results" role="status" aria-live="polite" aria-atomic="true"></p>
        </form>` })}

    <section class="kc-found" id="kc-found" aria-label="Search results" hidden>
      <ol class="kc-hits" id="kc-found-list"></ol>
    </section>

    <section class="kc-none" id="kc-none" aria-label="No results" hidden>
      <h2>I don't have a page for that yet</h2>
      <p>Try one of these, or ask me directly.</p>
      <ul>
        <li><a href="${BASE}?q=backups" data-term="backups">backups</a></li>
        <li><a href="${BASE}?q=phishing" data-term="phishing">phishing</a></li>
        <li><a href="${BASE}?q=proposal" data-term="proposal">proposal</a></li>
        <li><a href="${BASE}?q=privacy" data-term="privacy">privacy</a></li>
      </ul>
      <p><a href="${BASE}faq/1neon-help/">1NEON help</a> answers portal questions, and <a href="/#contact">contact</a> reaches me.</p>
    </section>

    <div id="kc-browse">
${pathsSection()}

    <nav class="kc-shelves" aria-label="Shelves">
      <ul>
${nav}
      </ul>
    </nav>

    <div class="kc-body">
${groups}

    <p class="kc-colophon">These documents come from ${CORPUS_LINK} and are shared under CC BY-ND 4.0. Templates and examples are illustrations, not legal advice.</p>
    </div>
    </div>`
  return page({
    title: "Knowledge center · neon1",
    description: `neon1's public documents in one place: guides, templates, forms, filled-out examples, and alternatives, plus standards, services, and policies. ${facts.summary}.`,
    path: BASE,
    main,
    kind: "index",
    ld: [
      { "@type": "CollectionPage", "@id": `${SITE}${BASE}#page`, url: `${SITE}${BASE}`, name: "neon1 knowledge center", inLanguage: "en-US", isPartOf: WEBSITE, publisher: ORG, about: ORG },
      crumbs([["Knowledge center"]]),
    ],
  })
}


// One document: where it sits, its title and facts, the PDF, the text, and where to go next
function docPage(d) {
  const shelf = corpus.manifest.shelves[d.section]
  const facts = [
    ["Type", TYPE_LABELS[d.type] ?? d.type],
    d.data.edition ? ["Edition", d.data.edition] : null,
    ...dateFacts(d.data.created, d.data.updated),
    d.data.reviewed ? ["Facts checked", longDate(d.data.reviewed)] : null,
    d.data.audience ? ["For", d.data.audience] : null,
    // A case study's role and years; the corpus export already leaves out TBD placeholders
    d.data.role && d.data.role !== "TBD" ? ["Role", d.data.role] : null,
    d.data.when && d.data.when !== "TBD" ? ["When", d.data.when] : null,
  ].filter(Boolean)

  const pairs = []
  if (d.data.example_of && corpus.byId.has(d.data.example_of)) pairs.push(["The blank version", corpus.byId.get(d.data.example_of)])
  for (const ex of corpus.docs.filter((x) => x.data.example_of === d.id)) pairs.push(["See it filled in", ex])
  const related = (d.data.related ?? []).map((id) => corpus.byId.get(id)).filter((r) => r && !pairs.some(([, p]) => p.id === r.id))

  const next = [
    ...pairs.map(([label, p]) => ({ cls: "kc-pair", url: p.url, kicker: label, title: p.title })),
    ...related.map((r) => ({ url: r.url, kicker: corpus.manifest.shelves[r.section].label, title: r.title })),
  ]
  const body = pageBody(d, corpus)
  // The short version, linked the same way as the text
  const short = (d.shortHtml ?? []).map((h) => bindExtArrows(classifyLinks(relink(h, d, corpus))))
  // The actions row also draws the line under the header, so it stays even when a document has no PDF
  const actions = `
        <div class="kc-actions">${d.pdf ? `
          <a class="btn btn-primary" href="${d.pdf}" download>${ICON_PDF}Download PDF</a>
          <a class="btn btn-outline" href="${d.pdf}" target="_blank" rel="noopener">${ICON_VIEW}Preview PDF<span class="kc-sr"> (opens in a new tab)</span></a>` : ""}
        </div>`
  const note = d.type === "template" || d.type === "example" ? "Templates and examples are illustrations, not legal advice. " : ""
  const main = docMain({
    crumbs: [["Knowledge center", BASE], [shelf.label, `${BASE}#${d.section}`]],
    flag: d.data.fictional ? '<p class="kc-flag">Fictional example</p>' : "",
    title: d.title, summary: d.summary, facts, short, actions, sections: d.sections, body, next,
    colophon: `${rights(d.source)} ${note}${esc(fillNote(d))}`,
  })
  // An article for every document; a questions page also lists each question with its answer
  const url = SITE + d.url
  const article = {
    "@type": d.type === "faq" ? "FAQPage" : "Article",
    "@id": `${url}#page`,
    url,
    [d.type === "faq" ? "name" : "headline"]: d.title,
    description: d.summary,
    ...(d.shortHtml?.length ? { abstract: d.shortHtml.map((h) => plain(h.replace(/\s*<a href="#[^"]*">[^<]*<\/a>\.?/g, ""))).join(" ") } : {}),
    inLanguage: "en-US",
    ...(d.data.created ? { datePublished: d.data.created } : {}),
    dateModified: d.data.updated,
    ...(d.data.edition ? { version: d.data.edition } : {}),
    author: AUTHOR,
    publisher: ORG,
    isPartOf: WEBSITE,
    license: LICENSE,
    image: OG_IMAGE,
    ...(d.data.audience ? { audience: { "@type": "Audience", audienceType: d.data.audience } } : {}),
  }
  if (d.type === "faq") article.mainEntity = d.sections.filter((x) => x.heading?.endsWith("?") && x.html)
    .map((x) => ({ "@type": "Question", name: x.heading, acceptedAnswer: { "@type": "Answer", text: plain(x.html) } }))
  const ld = [article, crumbs([["Knowledge center", `${SITE}${BASE}`], [shelf.label, `${SITE}${BASE}#${d.section}`], [d.title]])]
  return page({ title: `${d.title} · neon1 knowledge center`, description: d.summary, path: d.url, main, kind: "doc", ld })
}


// Everything the folder should hold, by path under the site
const want = new Map([["knowledge/index.html", indexPage()]])
for (const d of corpus.docs) want.set(`${d.url.slice(1)}index.html`, docPage(d))
// The search index sits beside the shelves and is fetched only when someone searches
want.set("knowledge/search-index.json", JSON.stringify(searchIndex(corpus)) + "\n")
// Which corpus release these pages came from. The deploy workflow's watch reads it from the live site and
// publishes when a newer release exists, so it must name the tag and the bundle's digest exactly
want.set("knowledge/corpus.json", JSON.stringify({ tag: process.env.CORPUS_TAG || "local", digest: corpus.manifest.digest }) + "\n")
// Pages that left the Knowledge Center but still live in the corpus on GitHub (corpus v0.40: the standards, the
// charter, How neon1.tech works, and five education products). Each old address keeps a small page that sends a
// reader, or a saved link, to the document on GitHub, so nothing someone bookmarked turns into a 404
const RETIRED = {
  "company/charter": "company/charter.md",
  "company/how-it-works": "company/how-it-works.md",
  "neo/motifs": null,
  ...Object.fromEntries(["ai-quality", "code-style", "customers", "design-and-accessibility", "development",
    "discovery-and-delivery", "documentation", "measurement", "operating-principles", "outreach", "partners",
    "reliability-and-recovery", "security-and-data", "technology-decisions", "testing-and-review", "version-control",
    "versioning", "writing"].map((n) => [`standards/${n}`, `standards/${n}.md`])),
  ...Object.fromEntries(["soc-it-2-me", "there-are-no-incidents", "you-have-20-seconds-to-comply", "phish-out-of-water",
    "home-is-where-the-smart-is"].map((n) => [`products/${n}`, `products/${n}.md`])),
}
const moved = (to) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${to}">
<link rel="canonical" href="${to}">
<title>Moved · neon1</title>
</head>
<body><p>This page moved to <a href="${to}">${to}</a>.</p></body>
</html>
`
for (const [path, source] of Object.entries(RETIRED)) {
  const key = `knowledge/${path}/index.html`
  if (want.has(key)) continue
  want.set(key, moved(source ? `https://github.com/neon1llc/neon1-corpus/blob/main/corpus/${source}` : "/knowledge/"))
}

// Diagrams the documents draw (neon1-corpus tools/diagrams.mjs), served beside them as image files
const diagramsDir = join(exportDir, "diagrams")
if (existsSync(diagramsDir)) for (const f of readdirSync(diagramsDir)) if (f.endsWith(".svg")) want.set(`knowledge/diagrams/${f}`, readFileSync(join(diagramsDir, f), "utf8"))

// The sitemap lists every knowledge center page between its <!-- knowledge --> markers, with each document's updated date
const sitemapFile = join(siteDir, "sitemap.xml")
const sitemapNow = readFileSync(sitemapFile, "utf8")
const lastmod = corpus.docs.map((d) => d.data.updated).sort().at(-1)
const sitemapWant = sitemapWith(sitemapNow, "knowledge", [[`${SITE}${BASE}`, lastmod], ...corpus.docs.map((d) => [`${SITE}${d.url}`, d.data.updated])])

// llms.txt (llmstxt.org): a plain map of the site for AI assistants and answer engines, written from the same
// corpus so it never drifts from the pages. Each shelf lists its documents with their one-line summaries
const llmsFile = join(siteDir, "llms.txt")
const llmsNow = existsSync(llmsFile) ? readFileSync(llmsFile, "utf8") : ""
const homeDesc = home.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "neon1 LLC"
const llmsShelves = Object.entries(corpus.manifest.shelves).map(([key, s]) => {
  const docs = corpus.docs.filter((d) => d.section === key)
  if (!docs.length) return ""
  return `\n## ${s.label}\n\n${docs.map((d) => `- [${d.title}](${SITE}${d.url}): ${d.summary}${d.data.fictional ? " (fictional example)" : ""}`).join("\n")}\n`
}).join("")
// The blog's posts, newest first, each at /blog/<slug>/ (scripts/blog.mjs writes the pages)
const blogPosts = blogDir
  ? JSON.parse(readFileSync(join(blogDir, "manifest.json"), "utf8")).files
    .map((f) => JSON.parse(readFileSync(join(blogDir, f.json), "utf8"))).filter((d) => d.type === "post")
    .sort((a, b) => b.data.created.localeCompare(a.data.created))
  : []
const llmsBlog = blogPosts.length
  ? `\n## Blog\n\n${blogPosts.map((d) => `- [${d.title}](${SITE}/blog/${slugOf(d.id, "blog")}/): ${d.summary} (${d.data.created})`).join("\n")}\n`
  : ""
const llmsWant = `# neon1

> ${homeDesc}

neon1 is the DBA of neon1 LLC, run by Pradeep Tathineni. Work is remote, on site within about 30 miles of Queens, NY, or over a secure temporary connection. Contact: hello@neon1.tech, +1 424-326-3661, or the form at ${SITE}/#contact.

- [Home page](${SITE}/): services, client work, process, public code and resources, and questions
- [Knowledge center](${SITE}${BASE}): every public document below, most with a PDF to download
${blogPosts.length ? `- [Blog](${SITE}/blog/): posts on local businesses' questions, the whats and whys of neon1, and lessons from its public repositories ([RSS](${SITE}/blog/feed.xml))\n` : ""}- Source for these documents: https://github.com/neon1llc/neon1-corpus (CC BY-ND 4.0)
${llmsShelves}${llmsBlog}`

// Write or check the folder, PDFs left alone since the deploy job writes those. The search index is the one file
// that holds every document's text, so it has its own cap. CloudFront compresses it to about a third on the
// wire, and it's fetched once, on the first search
syncFolder({
  name: "knowledge", mode, siteDir, folder: "knowledge", want,
  extras: [
    { file: sitemapFile, now: sitemapNow, want: sitemapWant, label: "sitemap.xml knowledge block" },
    { file: llmsFile, now: llmsNow, want: llmsWant, label: "llms.txt" },
  ],
  skip: (f) => f.endsWith(".pdf"),
  limit: (path) => (path.endsWith(".json") ? 384 : 120) * 1024,
  hint: "run make knowledge to rewrite the knowledge center from the corpus",
})
