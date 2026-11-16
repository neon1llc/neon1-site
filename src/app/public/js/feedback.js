// src/app/public/js/feedback.js - The feedback page (/feedback/): what kind, what it is about, what they wrote, and an
// optional email. It sends to 1NEON's feedback route (which mails neon1 and answers with a reference). The page it
// came from, the theme, the browser, and the window size go along without asking, and the page says so. Nothing is
// stored in the browser. A send waits at most WAIT ms; past that the outcome is unknown, so the words stay and the
// visitor is told to check before sending again (no auto-retry). Without this script the form stays hidden and an
// email link shows instead. It is the report page's sibling (js/report-bug.js), without screenshots.

import { swap, watchDirection } from "/shared/motion.js";

const form = document.getElementById("rb-form");
if (form) {
  const status = document.getElementById("rb-status");
  const done = document.getElementById("rb-done");
  const submit = form.querySelector('[type="submit"]');

  const WAIT = 15000;
  const UNSURE = "I couldn't confirm that was sent. It may still have arrived, so before sending it again, please email hello@neon1.tech.";
  const NO_NET = "That didn't send. You can also email hello@neon1.tech.";
  let pending = false;

  // ---- What the page captures ----
  // A link from another neon1 page names where it is (?from=), else the page it came from says; a person can change it
  const FROM = new Set(["site", "1neon", "demo", "walkthrough", "neo", "kc", "blog", "other"]);
  function guessWhere(ref) {
    const from = new URLSearchParams(location.search).get("from")?.toLowerCase();
    if (from && FROM.has(from)) return from;
    let p = "";
    try { const u = new URL(ref); if (u.origin === location.origin) p = u.pathname; } catch { /* no referrer */ }
    if (/^\/1NEON\/live/i.test(p)) return "walkthrough";
    if (/^\/1NEON\/(example|demo)/i.test(p)) return "demo";
    if (/^\/1NEON/i.test(p)) return "1neon";
    if (p.startsWith("/knowledge")) return "kc";
    if (p.startsWith("/blog")) return "blog";
    return p ? "site" : "";
  }
  // The page they came from, as far as the browser says: the full address from a neon1 page, only the site from elsewhere
  const referrer = document.referrer || "";
  const currentTheme = () => (document.documentElement.dataset.siteTheme === "matrix" ? "matrix" : "awake");
  let theme = currentTheme();
  const browser = navigator.userAgent.slice(0, 300);
  // A short name for the line shown under the form: "Safari 17", not the whole agent string
  function browserName() {
    const m = /(Edg|OPR|Firefox|Chrome|CriOS|FxiOS|Version)\/(\d+)/.exec(navigator.userAgent);
    const name = { Edg: "Edge", OPR: "Opera", CriOS: "Chrome", FxiOS: "Firefox", Version: "Safari" }[m?.[1]] || m?.[1];
    return m ? `${name} ${m[2]}` : "your browser";
  }
  const viewport = () => `${innerWidth}x${innerHeight}${devicePixelRatio && devicePixelRatio !== 1 ? ` @${devicePixelRatio}x` : ""}`;
  function pageLabel() {
    try { const u = new URL(referrer); return u.origin === location.origin ? u.pathname : u.origin; } catch { return "no page"; }
  }
  const sentLine = document.getElementById("rb-sent");
  const showSent = () => { sentLine.textContent = `Sent with it: the page you came from (${pageLabel()}), your ${theme} theme, ${browserName()}, and a ${innerWidth} by ${innerHeight} window.`; };
  showSent();
  // The theme is read again at send time, and the line under the form follows a switch
  document.addEventListener("n1:theme", () => { theme = currentTheme(); showSent(); });

  const where = guessWhere(referrer);
  if (where) form.elements.where.value = where;
  watchDirection(form.elements.kind);
  watchDirection(form.elements.where);
  // Safari does not focus a dropdown when it is pressed, so the focus ring would wait until a choice; press focuses it, as in 1NEON
  for (const sel of [form.elements.kind, form.elements.where]) sel.addEventListener("pointerdown", (e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.focus({ preventScroll: true }); });

  // ---- Fields and their messages ----
  // Each message sits under its field, linked by aria-describedby, and typing in the field clears it
  function fieldError(el, text) {
    const id = `rb-err-${el.name}`;
    document.getElementById(id)?.remove();
    if (!text) { el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby"); return; }
    const note = document.createElement("span");
    note.id = id; note.className = "rb-err"; note.textContent = text;
    (el.closest("label") || el.closest(".rb-shots") || el).append(note);
    el.setAttribute("aria-invalid", "true");
    el.setAttribute("aria-describedby", id);
  }
  form.addEventListener("input", (e) => { if (e.target.getAttribute?.("aria-invalid") === "true") fieldError(e.target, ""); });
  form.addEventListener("change", (e) => { if (e.target.getAttribute?.("aria-invalid") === "true") fieldError(e.target, ""); });

  // The same minimums the API holds: a sentence or so; an email only when one is given
  function problems() {
    const f = form.elements, out = [];
    const what = f.what.value.trim().replace(/\s+/g, " ");
    if (!f.kind.value) out.push(["kind", "Pick what kind of feedback it is."]);
    if (!f.where.value) out.push(["where", "Pick what it is about."]);
    if (!what) out.push(["what", "Say what's on your mind."]);
    else if (what.length < 10) out.push(["what", "Add a little more, at least 10 characters."]);
    const email = f.email.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) out.push(["email", "Enter a full email address, or leave it empty."]);
    return out;
  }

  // ---- Sending ----
  async function post(url, init, ms) {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), ms);
    try { return await fetch(url, { method: "POST", credentials: "same-origin", ...init, signal: stop.signal }); }
    finally { clearTimeout(timer); }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (pending) return;
    form.querySelectorAll("[aria-invalid]").forEach((el) => fieldError(el, ""));
    const bad = problems();
    if (bad.length) {
      for (const [n, m] of bad) fieldError(form.elements[n], m);
      status.textContent = "";
      form.elements[bad[0][0]].focus();
      return;
    }
    pending = true;
    submit.disabled = true;
    status.className = "rb-status";
    status.textContent = "Sending…";
    const f = form.elements;
    let answer;
    try {
      const r = await post("/1NEON/api/feedback", {
        headers: { "content-type": "application/json", "x-1neon": "1" },
        body: JSON.stringify({
          kind: f.kind.value,
          where: f.where.value,
          what: f.what.value,
          ...(f.email.value.trim() ? { email: f.email.value.trim() } : {}),
          page: referrer, theme, browser, viewport: viewport(),
          website: f.website.value,
        }),
      }, WAIT);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        // The server's checks answer field by field; each message goes under its field
        const fields = j.error === "check_fields" && j.current?.fields;
        if (fields) {
          let first;
          for (const [n, m] of Object.entries(fields)) if (f[n]) { fieldError(f[n], String(m)); first ??= f[n]; }
          first?.focus();
          status.textContent = "A field above needs another look.";
        } else {
          status.textContent = `${r.status === 429 || r.status === 503 ? j.message || NO_NET : NO_NET}`;
        }
        status.className = "rb-status err";
        return;
      }
      answer = await r.json();
    } catch (err) {
      // The draft is kept. An aborted wait is an unknown outcome, so it says to check before sending again
      status.textContent = err.name === "AbortError" ? UNSURE : NO_NET;
      status.className = "rb-status err";
      return;
    } finally {
      pending = false;
      submit.disabled = false;
    }

    // It is in: the reference to quote
    document.getElementById("rb-ref").textContent = answer.ref;
    form.reset();
    if (where) form.elements.where.value = where;
    status.textContent = "";
    await swap(form, done);
    done.focus();
  });

  document.getElementById("rb-again").addEventListener("click", () => {
    swap(done, form).then(() => form.elements.what.focus());
  });

  document.getElementById("rb-nojs").hidden = true;
  form.hidden = false;
}
