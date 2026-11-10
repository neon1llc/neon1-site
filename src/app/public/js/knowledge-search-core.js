// src/app/public/js/knowledge-search-core.js - The knowledge center's matching rules, with no page code, so the
// browser and the tests run the same thing. It reads search-index.json (built by scripts/knowledge.mjs).

// Words that mean the same thing to a reader. Each line is written the way normalize() leaves text, so
// "Wi-Fi" is "wi fi". A query that contains any variant matches a document that contains any other.
export const SYNONYMS = [
  ["passkey", "passkeys", "webauthn", "web authn"],
  ["authenticator", "authenticator app", "totp"],
  ["mfa", "2fa", "two factor", "multi factor", "multifactor", "two step"],
  ["wifi", "wi fi", "wireless"],
  ["phishing", "phish"],
  ["ransomware"],
  ["backup", "backups", "back up", "back ups"],
  ["invoice", "invoices", "billing"],
]

// Words too common to narrow anything
const STOP = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "is", "it", "my", "i", "do", "how", "what", "with"])

// Where a match counts most: the title, then a heading, then the summary, then the body
export const WEIGHTS = { title: 10, heading: 6, summary: 4, body: 1 }
export const MAX_RESULTS = 25

// Lowercase, drop apostrophes, and turn every other run of punctuation into one space
export function normalize(text) {
  return String(text ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
}

// The query as clauses. Each clause is the set of normalized phrases that satisfy it: a synonym group, or one word
export function parseQuery(query) {
  let rest = ` ${normalize(query)} `
  const clauses = []
  for (const group of SYNONYMS) {
    // Longest variant first, so "two factor" is taken whole
    const hit = [...group].sort((a, b) => b.length - a.length).find((v) => rest.includes(` ${v} `))
    if (hit) {
      clauses.push({ phrases: group, label: hit })
      rest = rest.replace(` ${hit} `, " ")
    }
  }
  for (const w of rest.split(" ").filter((w) => w && !STOP.has(w))) clauses.push({ phrases: [w], label: w })
  return clauses
}

// A phrase starts at a word start, so "backup" finds "backups" and "wi fi" finds "Wi-Fi". Fields are kept
// padded with a space on each side so the first word counts too
const has = (haystack, phrase) => haystack.includes(` ${phrase}`)
const count = (haystack, phrase) => {
  let n = 0
  for (let at = haystack.indexOf(` ${phrase}`); at !== -1 && n < 3; at = haystack.indexOf(` ${phrase}`, at + 1)) n++
  return n
}

// Normalizes each field once so a search is only string scans
export function prepare(index) {
  return index.docs.map((d) => ({
    doc: d,
    title: ` ${normalize(d.t)} `,
    summary: ` ${normalize(`${d.s} ${d.sh} ${d.ty}`)} `,
    sections: d.k.map(([id, heading, text]) => ({ id, heading, h: ` ${normalize(heading)} `, b: ` ${normalize(text)} `, text })),
  }))
}

// Score of one clause against one document, with the section that matched best
function scoreClause(entry, clause) {
  let score = 0
  let best = { id: "", weight: 0, text: "", heading: "" }
  for (const p of clause.phrases) {
    if (has(entry.title, p)) score = Math.max(score, WEIGHTS.title)
    if (has(entry.summary, p)) score = Math.max(score, WEIGHTS.summary)
  }
  let section = 0
  for (const s of entry.sections) {
    let w = 0
    for (const p of clause.phrases) {
      if (s.heading && has(s.h, p)) w = Math.max(w, WEIGHTS.heading)
      const n = count(s.b, p)
      if (n) w += Math.min(n, 3) * WEIGHTS.body
    }
    if (w > best.weight) best = { id: s.id, weight: w, text: s.text, heading: s.heading }
    section = Math.max(section, w)
  }
  return { score: Math.max(score, section), section: best }
}

// Documents for a query, best first. Every word must match; when nothing does, documents matching any word are
// returned and `relaxed` says so
export function search(prepared, query) {
  const clauses = parseQuery(query)
  if (!clauses.length) return { clauses, results: [], relaxed: false }
  const scored = prepared.map((entry) => {
    const per = clauses.map((c) => scoreClause(entry, c))
    return { entry, per, all: per.every((p) => p.score > 0), any: per.some((p) => p.score > 0), total: per.reduce((n, p) => n + p.score, 0) }
  })
  let hits = scored.filter((s) => s.all)
  let relaxed = false
  if (!hits.length) { hits = scored.filter((s) => s.any); relaxed = hits.length > 0 }
  hits.sort((a, b) => b.total - a.total || a.entry.doc.t.localeCompare(b.entry.doc.t))
  const results = hits.slice(0, MAX_RESULTS).map((h) => {
    // Link to the section where the most weight landed, with its anchor when it has a heading
    const top = h.per.reduce((a, b) => (b.section.weight > a.section.weight ? b : a)).section
    return {
      url: h.entry.doc.u + (top.id && top.weight ? `#${top.id}` : ""),
      title: h.entry.doc.t,
      shelf: h.entry.doc.sh,
      type: h.entry.doc.ty,
      score: h.total,
      section: top.weight ? top.heading : "",
      snippet: snippet(top.weight ? top.text : h.entry.doc.s, clauses),
    }
  })
  return { clauses, results, relaxed, total: hits.length }
}

// Regex source for a phrase against raw text: "wi fi" finds "Wi-Fi", "WiFi", and "wi fi"
const rawPattern = (phrase) => `(?<![a-z0-9])${phrase.split(" ").join("[^a-z0-9]*")}`

// About 160 characters around the first match, as parts: { text, hit } so the page can mark hits without HTML
export function snippet(text, clauses, size = 160) {
  const re = new RegExp(clauses.flatMap((c) => c.phrases).map(rawPattern).join("|"), "gi")
  const first = re.exec(text)
  const start = first ? Math.max(0, first.index - 50) : 0
  let from = start
  // Begin at a word boundary so the snippet doesn't open mid-word
  if (from > 0) { const sp = text.indexOf(" ", from); if (sp !== -1 && sp < first.index) from = sp + 1 }
  const piece = text.slice(from, from + size)
  const parts = []
  let last = 0
  const again = new RegExp(re.source, "gi")
  for (let m = again.exec(piece); m; m = again.exec(piece)) {
    if (!m[0]) { again.lastIndex++; continue }
    // Hit extends over the rest of the word, so "backup" marks "backups"
    const end = m.index + m[0].length + (/^[a-z0-9]*/i.exec(piece.slice(m.index + m[0].length))?.[0].length ?? 0)
    if (m.index > last) parts.push({ text: piece.slice(last, m.index), hit: false })
    parts.push({ text: piece.slice(m.index, end), hit: true })
    last = end
    again.lastIndex = end
  }
  if (last < piece.length) parts.push({ text: piece.slice(last), hit: false })
  if (from > 0) parts.unshift({ text: "… ", hit: false })
  if (from + size < text.length) parts.push({ text: " …", hit: false })
  return parts
}
