#!/usr/bin/env node
// scripts/blog.mjs - Writes the blog (/blog/) from neon1-corpus, or checks it matches.
// Usage: node scripts/blog.mjs sync|check SITE_DIR BLOG_EXPORT KNOWLEDGE_EXPORT   (make blog, and make blog-check)
//
// BLOG_EXPORT is the corpus's blog bundle (tools/export.mjs --target blog) from the tag pinned in the Makefile;
// KNOWLEDGE_EXPORT is its knowledge bundle, so a post's links to other corpus documents open their Knowledge
// Center pages. Every post becomes /blog/<slug>/index.html, newest first on /blog/index.html, with an RSS feed at
// /blog/feed.xml. Like the Knowledge Center, the pages are committed and generated: sync rewrites the folder and
// the sitemap's blog block; check fails if anything differs, so a hand edit or an unpulled corpus change is caught.

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, existsSync } from "node:fs"
import { join, dirname, relative, posix } from "node:path"
import { load, slugOf, singleH1, classifyLinks, bindExtArrows, staticChecks, esc, longDate, SITE, CORPUS_BLOB } from "./knowledge-lib.mjs"
import { homeFrame, page as page_ } from "./page-shell.mjs"


const [mode, siteDir, blogExport, knowledgeExport] = process.argv.slice(2)
if (!["sync", "check"].includes(mode) || !siteDir || !blogExport || !knowledgeExport) {
  console.error("usage: node scripts/blog.mjs sync|check SITE_DIR BLOG_EXPORT KNOWLEDGE_EXPORT")
  process.exit(2)
}

const BLOG = "/blog/"
const FEED = `${BLOG}feed.xml`
const frame = homeFrame(readFileSync(join(siteDir, "index.html"), "utf8"))


// ---- The posts ----

// The three kinds of post (neon1-corpus schema, post.topic), as a reader would name them
const TOPICS = {
  questions: "Local questions",
  "whats-and-whys": "Whats and whys",
  lessons: "From the repos",
}

// Posts newest first, each with its address; ties keep the corpus's order
const manifest = JSON.parse(readFileSync(join(blogExport, "manifest.json"), "utf8"))
const posts = manifest.files
  .map((entry) => JSON.parse(readFileSync(join(blogExport, entry.json), "utf8")))
  .filter((d) => d.type === "post")
  .map((d) => ({ ...d, slug: slugOf(d.id, "blog"), url: `${BLOG}${slugOf(d.id, "blog")}/` }))
  .sort((a, b) => b.data.created.localeCompare(a.data.created))
for (const p of posts) if (!TOPICS[p.data.topic]) {
  console.error(`blog: ${p.id} has topic "${p.data.topic}", which the blog doesn't label`)
  process.exit(1)
}

// Every page a post can link to: other posts, and the Knowledge Center's documents
const knowledge = load(knowledgeExport)
const bySource = new Map([...knowledge.docs.map((d) => [d.source, d]), ...posts.map((p) => [p.source, p])])
const byId = new Map([...knowledge.docs.map((d) => [d.id, d]), ...posts.map((p) => [p.id, p])])

// A post's relative links (../products/x.md) open that document's page here, or its source on GitHub
function relink(html, doc, { absolute = false } = {}) {
  const from = posix.dirname(doc.source)
  return html.replace(/href="([^"]+)"/g, (whole, href) => {
    if (/^[a-z]+:/i.test(href) || href.startsWith("#") || href.startsWith("/")) return whole
    const [path, hash] = href.split("#")
    const target = posix.normalize(posix.join(from, path))
    const found = bySource.get(target)
    const url = found ? (absolute ? SITE : "") + found.url : CORPUS_BLOB + target
    return `href="${url}${hash ? `#${hash}` : ""}"`
  })
}
const bodyOf = (p) => bindExtArrows(staticChecks(classifyLinks(relink(singleH1(p.html, p.title), p))))


// ---- Structured data ----

const ORG = { "@id": `${SITE}/#organization` }
const WEBSITE = { "@id": `${SITE}/#website` }
const AUTHOR = { "@type": "Person", "@id": `${SITE}/#pradeep`, name: "Pradeep Tathineni", url: "https://www.linkedin.com/in/pradeep-tathineni/", worksFor: ORG }
const BLOG_ID = { "@id": `${SITE}${BLOG}#blog` }
const LICENSE = "https://creativecommons.org/licenses/by-nd/4.0/"
const crumbs = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, ...(item ? { item } : {}) })),
})
const posting = (p) => ({
  "@type": "BlogPosting",
  "@id": `${SITE}${p.url}#post`,
  url: `${SITE}${p.url}`,
  headline: p.title,
  description: p.summary,
  datePublished: p.data.created,
  dateModified: p.data.updated,
  author: AUTHOR,
})


// ---- Pages ----

const feedLink = `\n  <link rel="alternate" type="application/rss+xml" title="neon1 blog" href="${FEED}" />`
const page = (opts) => page_(frame, {
  ...opts,
  current: "blog",
  generator: "scripts/blog.mjs from neon1-corpus. Edit the corpus, then run make blog",
  styles: ["/css/knowledge.css"],
  scripts: ["/js/knowledge-toc.js"],
  head: feedLink,
})

// The facts under a post's title: when, what kind, and who it's for. Updated shows only once it has changed
const factsOf = (p) => [
  ["Published", longDate(p.data.created)],
  p.data.updated !== p.data.created ? ["Updated", longDate(p.data.updated)] : null,
  ["Topic", TOPICS[p.data.topic]],
  p.data.audience ? ["For", p.data.audience] : null,
].filter(Boolean)

// A post as a card on the index: its date and kind, title, and summary
const card = (p) => `        <li class="kc-card">
          <a href="${p.url}">
            <span class="kc-kicker"><time datetime="${p.data.created}">${longDate(p.data.created)}</time> · ${esc(TOPICS[p.data.topic])}</span>
            <span class="kc-card-title">${esc(p.title)}</span>
            <span class="kc-card-summary">${esc(p.summary)}</span>
          </a>
        </li>`

function indexPage() {
  const list = posts.length
    ? `      <ul class="kc-cards">
${posts.map(card).join("\n")}
      </ul>`
    : "      <p>The first post is on its way.</p>"
  const main = `    <section class="kc-band" aria-labelledby="blog-title">
      <div class="kc-band-inner">
        <p class="kc-eyebrow">neon1 · blog</p>
        <h1 id="blog-title">Blog</h1>
        <p class="kc-lead">Questions from local businesses answered in plain words, the whats and whys of how neon1 works, and lessons from building its open repositories. A new post about once a week.</p>
      </div>
    </section>

    <div class="kc-body">
      <section class="kc-shelf" aria-labelledby="blog-posts-h">
        <div class="kc-shelf-head">
          <h2 id="blog-posts-h">Posts</h2>
          <p>Newest first. <a href="${FEED}">Follow with RSS</a>.</p>
        </div>
${list}
      </section>

      <p class="kc-colophon">Posts come from <a class="ext" href="https://github.com/neon1llc/neon1-corpus" target="_blank" rel="noopener"><span class="ext-end">neon1-corpus</span></a> and are shared under CC BY-ND 4.0. They explain things in general terms and aren't legal advice.</p>
    </div>`
  return page({
    title: "Blog · neon1",
    description: "Posts from neon1: questions from local businesses answered in plain words, the whats and whys of neon1, and lessons from its open repositories.",
    path: BLOG,
    main,
    kind: "index",
    ld: [
      { "@type": "Blog", ...BLOG_ID, url: `${SITE}${BLOG}`, name: "neon1 blog", inLanguage: "en-US", isPartOf: WEBSITE, publisher: ORG, author: AUTHOR, blogPost: posts.map(posting) },
      crumbs([["neon1", `${SITE}/`], ["Blog"]]),
    ],
  })
}

function postPage(p) {
  const body = bodyOf(p)
  // Read next: the post's related documents, then the two newest other posts not already listed
  const related = (p.data.related ?? []).map((id) => byId.get(id)).filter(Boolean)
  const more = posts.filter((x) => x.id !== p.id && !related.some((r) => r.id === x.id)).slice(0, 2)
  const kicker = (d) => (d.type === "post" ? "Blog" : knowledge.manifest.shelves[d.section]?.label ?? "Knowledge center")
  const next = [...related, ...more].map((d) => `          <li><a href="${d.url}"><span class="kc-kicker">${esc(kicker(d))}</span><span class="kc-card-title">${esc(d.title)}</span></a></li>`)

  // On this post: its sections, for posts with three or more, beside the text on wide screens and folded on narrow ones
  const heads = p.sections.filter((x) => x.heading && x.key && body.includes(`id="${x.key}"`))
  const tocLinks = heads.map((x) => `            <li><a href="#${esc(x.key)}">${esc(x.heading)}</a></li>`).join("\n")
  const toc = heads.length >= 3 ? {
    side: `
    <nav class="kc-toc kc-toc-side" aria-label="On this page">
      <p class="kc-toc-title">On this page</p>
      <ol>
${tocLinks}
      </ol>
    </nav>`,
    fold: `
        <details class="kc-toc kc-toc-fold">
          <summary>On this page <span>${heads.length} sections</span></summary>
          <ol>
${tocLinks}
          </ol>
        </details>`,
  } : { side: "", fold: "" }

  const main = `    <div class="kc-doc-wrap${toc.side ? " has-toc" : ""}">
    <article class="kc-doc">
      <header class="kc-doc-head">
        <nav class="kc-crumbs" aria-label="Breadcrumb"><a href="${BLOG}">Blog</a><span aria-hidden="true">/</span><span>${esc(TOPICS[p.data.topic])}</span></nav>
        <h1>${esc(p.title)}</h1>
        <p class="kc-summary">${esc(p.summary)}</p>
        <dl class="kc-facts">
${factsOf(p).map(([k, v]) => `          <div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("\n")}
        </dl>${toc.fold}
      </header>

      <div class="kc-text">
${body}
      </div>
${next.length ? `
      <aside class="kc-next" aria-labelledby="kc-next-h">
        <h2 id="kc-next-h">Read next</h2>
        <ul>
${next.join("\n")}
        </ul>
      </aside>` : ""}

      <p class="kc-colophon">By <a href="/knowledge/company/about/">Pradeep Tathineni</a>. © neon1 LLC (neon1.tech). Shared under CC BY-ND 4.0: copy and share it word for word with credit. <a class="ext" href="${esc(`https://github.com/neon1llc/neon1-corpus/blob/main/${p.source}`)}" target="_blank" rel="noopener">Source on <span class="ext-end">GitHub</span></a>. <a href="${FEED}">Follow with RSS</a>.</p>
    </article>${toc.side}
    </div>`
  const ld = [
    {
      ...posting(p),
      mainEntityOfPage: `${SITE}${p.url}`,
      inLanguage: "en-US",
      publisher: ORG,
      isPartOf: BLOG_ID,
      license: LICENSE,
      image: `${SITE}/media/og-card-1.png`,
      articleSection: TOPICS[p.data.topic],
      ...(p.data.audience ? { audience: { "@type": "Audience", audienceType: p.data.audience } } : {}),
    },
    crumbs([["neon1", `${SITE}/`], ["Blog", `${SITE}${BLOG}`], [p.title]]),
  ]
  return page({ title: `${p.title} · neon1 blog`, description: p.summary, path: p.url, main, kind: "doc", ld })
}


// ---- The feed ----

// RSS 2.0, newest first, each item with its summary and the whole post. Dates are noon New York time on the day
// published, so readers in any US time zone see the same day
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const rfc822 = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`)
  return `${DAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()} 12:00:00 -0500`
}
// The whole post with absolute links, since a feed reader shows it away from neon1.tech
const feedBody = (p) => classifyLinks(relink(singleH1(p.html, p.title), p, { absolute: true })).replace(/\]\]>/g, "]]&gt;")
function feed() {
  const latest = posts[0]?.data.created
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${FEED} - Generated by scripts/blog.mjs from neon1-corpus. Edit the corpus, then run make blog. -->
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>neon1 blog</title>
    <link>${SITE}${BLOG}</link>
    <atom:link href="${SITE}${FEED}" rel="self" type="application/rss+xml" />
    <description>Questions from local businesses answered in plain words, the whats and whys of neon1, and lessons from its open repositories.</description>
    <language>en-us</language>
    <copyright>© neon1 LLC. CC BY-ND 4.0.</copyright>${latest ? `
    <lastBuildDate>${rfc822(latest)}</lastBuildDate>` : ""}
${posts.map((p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${SITE}${p.url}</link>
      <guid isPermaLink="true">${SITE}${p.url}</guid>
      <pubDate>${rfc822(p.data.created)}</pubDate>
      <category>${xml(TOPICS[p.data.topic])}</category>
      <description>${xml(p.summary)}</description>
      <content:encoded><![CDATA[${feedBody(p)}]]></content:encoded>
    </item>`).join("\n")}
  </channel>
</rss>
`
}


// ---- Writing or checking ----

const want = new Map([["blog/index.html", indexPage()], ["blog/feed.xml", feed()]])
for (const p of posts) want.set(`${p.url.slice(1)}index.html`, postPage(p))

// The sitemap lists the blog between its <!-- blog --> markers, each post with its updated date
const sitemapFile = join(siteDir, "sitemap.xml")
const sitemapNow = readFileSync(sitemapFile, "utf8")
if (!sitemapNow.includes("<!-- blog -->")) throw new Error("sitemap.xml has no <!-- blog --> block")
const lastmod = posts.map((p) => p.data.updated).sort().at(-1)
const urls = [`  <url><loc>${SITE}${BLOG}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
  ...posts.map((p) => `  <url><loc>${SITE}${p.url}</loc><lastmod>${p.data.updated}</lastmod></url>`)]
const sitemapWant = sitemapNow.replace(/  <!-- blog -->[\s\S]*?<!-- \/blog -->/, `  <!-- blog -->\n${urls.join("\n")}\n  <!-- /blog -->`)

const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)])) : [])
const have = walk(join(siteDir, "blog")).map((f) => relative(siteDir, f))

// Each page stays light: one post plus the shared frame
const PAGE_MAX = 120 * 1024
for (const [path, text] of want) if (!path.endsWith(".xml") && Buffer.byteLength(text) > PAGE_MAX) {
  console.error(`blog: ${path} is ${Math.round(Buffer.byteLength(text) / 1024)} KB, over its limit`)
  process.exit(1)
}

if (mode === "check") {
  const problems = []
  for (const [path, text] of want) {
    const file = join(siteDir, path)
    if (!existsSync(file)) problems.push(`missing ${path}`)
    else if (readFileSync(file, "utf8") !== text) problems.push(`differs ${path}`)
  }
  for (const path of have) if (!want.has(path)) problems.push(`not from the corpus ${path}`)
  if (sitemapNow !== sitemapWant) problems.push("differs sitemap.xml blog block")
  if (problems.length) {
    console.error(problems.join("\n") + "\nblog: run make blog to rewrite the blog from the pinned corpus")
    process.exit(1)
  }
  console.log(`blog: ${want.size} files match the corpus`)
} else {
  for (const path of have) if (!want.has(path)) rmSync(join(siteDir, path))
  for (const [path, text] of want) {
    const file = join(siteDir, path)
    mkdirSync(dirname(file), { recursive: true })
    if (!existsSync(file) || readFileSync(file, "utf8") !== text) writeFileSync(file, text)
  }
  if (sitemapNow !== sitemapWant) writeFileSync(sitemapFile, sitemapWant)
  // Folders left empty by a removed post go too
  const prune = (dir) => {
    for (const f of readdirSync(dir)) if (statSync(join(dir, f)).isDirectory()) prune(join(dir, f))
    if (dir !== join(siteDir, "blog") && !readdirSync(dir).length) rmSync(dir, { recursive: true })
  }
  prune(join(siteDir, "blog"))
  console.log(`blog: wrote ${want.size} files`)
}
