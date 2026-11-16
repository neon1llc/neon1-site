// src/app/public/js/report-bug.js - The report-a-bug page (/report-bug/): where it broke, what happened, optional
// screenshots and email. It sends the report to 1NEON's bug route (which mails hello@ and answers with a reference),
// then each screenshot to the route the answer names. The page it came from, the theme, the browser, and the window
// size go along without asking, and the page says so. Nothing is stored in the browser. A send waits at most WAIT ms;
// past that the outcome is unknown, so the words stay and the visitor is told to check before sending again (no
// auto-retry). Without this script the form stays hidden and an email link shows instead.

import { swap, watchDirection } from "/shared/motion.js";

const form = document.getElementById("rb-form");
if (form) {
  const status = document.getElementById("rb-status");
  const done = document.getElementById("rb-done");
  const list = document.getElementById("rb-list");
  const shots = form.querySelector(".rb-shots");
  const fileInput = document.getElementById("rb-file");
  const submit = form.querySelector('[type="submit"]');

  // The caps the API holds (1NEON's routes/bug.ts): at most this many screenshots, this many bytes each
  const MAX_IMAGES = 3;
  const MAX_BYTES = 3 * 1024 * 1024;
  const WAIT = 15000;
  const WAIT_IMAGE = 40000;
  const UNSURE = "I couldn't confirm that was sent. It may still have arrived, so before sending it again, please email hello@neon1.tech.";
  const NO_NET = "That didn't send. You can also email hello@neon1.tech.";
  let pending = false;
  // The screenshots chosen so far, in order
  let picked = [];

  // ---- What the page captures ----
  // A link from another neon1 page names where it is (?from=), else the page it came from says; a person can change it
  const FROM = new Set(["site", "1neon", "demo", "neo", "kc", "blog", "other"]);
  function guessWhere(ref) {
    const from = new URLSearchParams(location.search).get("from")?.toLowerCase();
    if (from && FROM.has(from)) return from;
    let p = "";
    try { const u = new URL(ref); if (u.origin === location.origin) p = u.pathname; } catch { /* no referrer */ }
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
  watchDirection(form.elements.where);

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

  // The same minimums the API holds: a description of a sentence or so; an email only when one is given
  function problems() {
    const f = form.elements, out = [];
    const what = f.what.value.trim().replace(/\s+/g, " ");
    if (!f.where.value) out.push(["where", "Pick where it happened."]);
    if (!what) out.push(["what", "Say what happened."]);
    else if (what.length < 10) out.push(["what", "Add a little more, at least 10 characters."]);
    const email = f.email.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) out.push(["email", "Enter a full email address, or leave it empty."]);
    return out;
  }

  // ---- Screenshots ----
  // The first bytes say what a file is, so a renamed file or a wrong type is caught here, and again by the API
  async function kindOf(file) {
    const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
    return "";
  }
  const size = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  function drawList() {
    list.replaceChildren(...picked.map((p, i) => {
      const li = document.createElement("li");
      const img = document.createElement("img");
      img.alt = "";
      img.src = p.preview;
      const name = document.createElement("span");
      name.className = "rb-name"; name.textContent = p.file.name;
      const sz = document.createElement("span");
      sz.className = "rb-size"; sz.textContent = size(p.file.size);
      const rm = document.createElement("button");
      rm.type = "button"; rm.textContent = "Remove"; rm.setAttribute("aria-label", `Remove ${p.file.name}`);
      rm.addEventListener("click", () => { picked.splice(i, 1); drawList(); fileInput.focus(); });
      li.append(img, name, sz, rm);
      return li;
    }));
    shots.toggleAttribute("data-full", picked.length >= MAX_IMAGES);
  }
  // A preview as a data: URL, the one image source the page's policy allows besides the site itself
  const preview = (file) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => res(""); r.readAsDataURL(file); });

  fileInput.addEventListener("change", async () => {
    const files = [...fileInput.files];
    fileInput.value = "";
    const notes = [];
    for (const file of files) {
      if (picked.length >= MAX_IMAGES) { notes.push(`Up to ${MAX_IMAGES} screenshots.`); break; }
      if (file.size > MAX_BYTES) { notes.push(`${file.name} is over 3 MB.`); continue; }
      const type = await kindOf(file);
      if (!type) { notes.push(`${file.name} isn't a PNG or JPEG.`); continue; }
      picked.push({ file, type, preview: await preview(file) });
    }
    drawList();
    fieldError(fileInput, notes.join(" "));
  });

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
      const r = await post("/1NEON/api/bug", {
        headers: { "content-type": "application/json", "x-1neon": "1" },
        body: JSON.stringify({
          where: f.where.value,
          what: f.what.value,
          ...(f.email.value.trim() ? { email: f.email.value.trim() } : {}),
          images: picked.length,
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

    // The report is in. Screenshots follow one at a time; one that fails is named at the end, not retried silently
    pending = true;
    submit.disabled = true;
    const failed = [];
    for (let i = 0; i < picked.length; i++) {
      status.textContent = `Sending screenshot ${i + 1} of ${picked.length}…`;
      try {
        const r = await post(`/1NEON/api/bug/${answer.ref}/image`, {
          headers: { "content-type": picked[i].type, "x-1neon": "1", "x-bug-token": answer.token },
          body: picked[i].file,
        }, WAIT_IMAGE);
        if (!r.ok) failed.push(picked[i].file.name);
      } catch { failed.push(picked[i].file.name); }
    }
    pending = false;
    submit.disabled = false;

    document.getElementById("rb-ref").textContent = answer.ref;
    const note = document.getElementById("rb-done-note");
    note.replaceChildren();
    if (failed.length) {
      note.append(`${failed.length === 1 ? "A screenshot" : "Some screenshots"} didn't upload (${failed.join(", ")}). Email ${failed.length === 1 ? "it" : "them"} to `);
      const a = document.createElement("a");
      a.href = `mailto:hello@neon1.tech?subject=${encodeURIComponent(answer.ref)}`; a.textContent = "hello@neon1.tech";
      note.append(a, " with the reference.");
    } else {
      note.append("Quote it if you write to ");
      const a = document.createElement("a");
      a.href = "mailto:hello@neon1.tech"; a.textContent = "hello@neon1.tech";
      note.append(a, ".");
    }
    form.reset();
    picked = [];
    drawList();
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
