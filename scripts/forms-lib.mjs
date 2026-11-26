// scripts/forms-lib.mjs - Fill-in fields for the knowledge center's forms and templates, on the page and in
// the PDF. The corpus writes a field as "**Label:** ____", several on one line for a row, a label with more
// "____" lines under it for a longer answer, and a signature block as a table whose first column names the
// lines (Name, Title, Signature, Date). Here those become labelled write-in lines: the label above its line,
// fields in a row sharing the width, a date shorter, a signature taller, and each party's block side by side.
// Anything else (a blank in the middle of a sentence, a table cell) stays as it was.


const BLANK = /<span class="blank"[^>]*><\/span>/
const TOKEN = /<strong>([^<]*)<\/strong>|<span class="blank"[^>]*><\/span>|<br\s*\/?>|\s+|[^<\s]+|<[^>]+>/g
const SIGN_ROWS = new Set(["name", "printed name", "title", "signature", "date", "initials", "organization", "company", "address", "notice address", "email"])

const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()
const labelText = (s) => s.trim().replace(/[:.]\s*$/, "")
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])


/** The kind of line a label wants: a date is short, a signature or initials tall, the rest ordinary */
export function fieldKind(label) {
  if (/signature|initials/i.test(label)) return "f-sig"
  if (/\bdate\b|^date|number$|^no\.?$/i.test(label)) return "f-short"
  return ""
}


/** One field: its label above, then one or more lines to write on (or the value already printed there) */
export function field(label, lines = 1, value = "") {
  const name = labelText(label)
  const kind = fieldKind(name)
  const wide = lines > 1 ? " f-wide" : ""
  const first = value
    ? `<span class="f-line f-filled">${value}</span>`
    : `<span class="f-line" role="img" aria-label="${esc(name)}, to fill in"></span>`
  const more = '<span class="f-line" aria-hidden="true"></span>'.repeat(Math.max(0, lines - 1))
  return `<div class="f${kind ? ` ${kind}` : ""}${wide}"><span class="f-label">${name}</span>${first}${more}</div>`
}


/** A paragraph as fields, or undefined when it isn't only labels and blanks (or prose followed by lines) */
export function paragraphFields(inner) {
  const toks = inner.match(TOKEN) ?? []
  const kinds = toks.map((t) => (t.startsWith("<strong>") ? "L" : BLANK.test(t) ? "B" : /^(\s+|<br\s*\/?>)$/.test(t) ? "" : "T"))
  const seq = kinds.filter(Boolean).join("")
  // Labels, each followed by one or more blanks: a row of fields (a label with several lines spans the row)
  if (/^(LB+)+$/.test(seq)) {
    const out = []
    toks.forEach((t, i) => {
      if (kinds[i] === "L") out.push({ label: t.replace(/<\/?strong>/g, ""), lines: 0 })
      else if (kinds[i] === "B") out.at(-1).lines++
    })
    return `<div class="fields">${out.map((f) => field(f.label, f.lines)).join("")}</div>`
  }
  // A row where some labels already carry a short value ("**Prepared by:** Pradeep Tathineni"): printed on its line
  if (/^(L(B+|T+))+$/.test(seq) && seq.includes("B")) {
    const out = []
    toks.forEach((t, i) => {
      if (kinds[i] === "L") out.push({ label: t.replace(/<\/?strong>/g, ""), lines: 0, value: "" })
      else if (kinds[i] === "B") out.at(-1).lines++
      else if (out.length) out.at(-1).value += t
    })
    if (out.every((f) => f.value.trim().length <= 60)) return `<div class="fields">${out.map((f) => field(f.label, Math.max(f.lines, 1), f.value.trim())).join("")}</div>`
  }
  // Prose (which may start with a bold lead-in) and then only lines: the prose, then a write-in area under it
  const cut = kinds.indexOf("B")
  // ...only when the lines start on a line of their own, so a blank ending a sentence stays inline
  if (/^[LT]+B+$/.test(seq) && seq.includes("T") && /\n/.test(toks[cut - 1] ?? "")) {
    const lines = (seq.match(/B+$/) ?? [""])[0].length
    const prose = toks.slice(0, cut).join("").trim()
    const area = '<span class="f-line" aria-hidden="true"></span>'.repeat(lines)
    return `<p>${prose}</p><div class="fields"><div class="f f-wide f-area" role="img" aria-label="lines to fill in">${area}</div></div>`
  }
  return undefined
}


/** A signature table (first column Name, Title, Signature, Date) as one block per party, side by side */
export function signTable(table) {
  const heads = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[1])
  const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]))
    .filter((r) => r.length)
  if (!rows.length || heads.length < 2 || !rows.every((r) => SIGN_ROWS.has(plain(r[0]).toLowerCase()))) return undefined
  const parties = heads.slice(1).map((h, col) => {
    const fields = rows.map((r) => {
      const cell = r[col + 1] ?? ""
      return field(plain(r[0]), 1, BLANK.test(cell) || !plain(cell) ? "" : cell.trim())
    }).join("")
    return `<div class="sign"><p class="sign-party">${h}</p>${fields}</div>`
  })
  return `<div class="sign-blocks">${parties.join("")}</div>`
}


/** Every field paragraph and signature table in a document's HTML, rebuilt as write-in fields */
export function formFields(html) {
  return html
    .replace(/<table>[\s\S]*?<\/table>/g, (t) => signTable(t) ?? t)
    .replace(/<p>([\s\S]*?)<\/p>/g, (p, inner) => (BLANK.test(inner) ? paragraphFields(inner) ?? p : p))
}
