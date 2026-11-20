// src/app/public/js/contact.js - The contact form, folded under "send a message": pick any of the
// four services (or none), add your own words in "something else", say what's going on, and send.
// Messages go to 1NEON's contact route, which mails neon1's inbox and no one else. Nothing is stored in
// the browser, and the draft never goes in the URL, only whether the form is open (/#contact?message=1). Without this script the fold stays hidden and the email and phone links
// above it do the job. A send waits at most WAIT ms; past that the outcome is unknown, so the draft stays
// and the visitor is told to check before sending again (no auto-retry).

import { reveal, swap, watchDirection } from "/shared/motion.js";

const fold = document.getElementById("cfold");
const form = document.getElementById("cform");
if (fold && form) {
  const status = document.getElementById("cstatus");
  const done = document.getElementById("cdone");
  const submit = form.querySelector('[type="submit"]');

  // How long a send may stay pending before the page stops waiting. The server may still have accepted it,
  // so this is an uncertain outcome, not a failure: nothing is resent automatically
  const WAIT = 15000;
  const UNSURE = "I couldn't confirm it sent. It may have arrived, so email hello@neon1.tech before sending again.";
  let pending = false;

  // Opening the fold puts the cursor in the first field it asks for
  fold.addEventListener("toggle", () => { if (fold.open && !form.hidden) form.elements.today.focus({ preventScroll: true }); });

  // Plain checks before sending, the same minimums the API holds (1NEON's forms.ts): a message of a
  // sentence or so, names of at least 2 characters, other answers of at least 3. The first field that needs attention gets
  // focus. What it's about is optional
  function problems() {
    const f = form.elements, out = [];
    const clean = (el) => el.value.trim().replace(/\s+/g, " ");
    const today = clean(f.today), name = clean(f.name), org = clean(f.company), other = clean(f.other), where = clean(f.foundOther);
    if (!today) out.push(["today", "Say what's going on."]);
    else if (today.length < 10) out.push(["today", "Add a little more, at least 10 characters."]);
    if (!name) out.push(["name", "Add your name."]);
    else if ((name.match(/\p{L}/gu) || []).length < 2) out.push(["name", "Enter at least 2 letters of your name."]);
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.email.value.trim())) out.push(["email", "Enter a full email address, like you@company.com."]);
    if (org.length === 1) out.push(["company", "Enter at least 2 characters for the organization's name."]);
    if (other && other.length < 3) out.push(["other", "Enter at least 3 characters for the topic."]);
    if (f.found.value === "other" && !where) out.push(["foundOther", "Say where you found neon1."]);
    else if (f.found.value === "other" && where.length < 3) out.push(["foundOther", "Enter at least 3 characters for where you found neon1."]);
    return out;
  }

  // The message as the API takes it: every checked topic, plus the visitor's own words
  function message() {
    const f = form.elements;
    return {
      topics: [...form.querySelectorAll('[name="topics"]:checked')].map((c) => c.value),
      other: f.other.value.trim(),
      today: f.today.value,
      name: f.name.value,
      email: f.email.value,
      company: f.company.value,
      // How they found neon1, sent only when picked
      ...(f.found.value ? { found: f.found.value } : {}),
      ...(f.found.value === "other" ? { foundOther: f.foundOther.value.trim() } : {}),
      website: f.website.value,
      // The visitor's time zone, so the message can show their local time
      timeZone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })(),
    };
  }

  // Each invalid field carries its own message, linked by aria-describedby, so a screen reader hears it on
  // every visit, not only in the one summary announcement. Typing in the field clears its mark (AS-09)
  function fieldError(el, text) {
    const id = `cerr-${el.name}`;
    let note = document.getElementById(id);
    if (!text) { note?.remove(); el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby"); return; }
    if (!note) { note = document.createElement("span"); note.id = id; note.className = "cerr"; el.after(note); }
    note.textContent = text;
    el.setAttribute("aria-invalid", "true");
    el.setAttribute("aria-describedby", id);
  }
  // The dropdown's arrow turns toward the way its list opens (shared/motion.js)
  watchDirection(form.elements.found);
  // Safari does not focus a dropdown when it is pressed, so the focus ring would wait until a choice; press focuses it, as in 1NEON
  form.elements.found.addEventListener("pointerdown", (e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.focus({ preventScroll: true }); });
  // "Somewhere else" asks for their words; any other answer hides the box again
  const foundOther = form.querySelector(".cfound-other");
  form.elements.found.addEventListener("change", () => reveal(foundOther, form.elements.found.value === "other"));
  form.addEventListener("reset", () => { foundOther.hidden = true; });

  form.addEventListener("input", (e) => { if (e.target.getAttribute?.("aria-invalid") === "true") fieldError(e.target, ""); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    form.querySelectorAll("[aria-invalid]").forEach((el) => (el.name ? fieldError(el, "") : el.removeAttribute("aria-invalid")));
    const bad = problems();
    if (bad.length) {
      status.textContent = bad.map(([, m]) => m).join(" ");
      status.className = "cstatus err";
      for (const [name, m] of bad) {
        const fields = form.querySelectorAll(`[name="${name}"]`);
        if (fields.length === 1) fieldError(fields[0], m);
        else fields.forEach((el) => el.setAttribute("aria-invalid", "true"));
      }
      form.querySelector(`[name="${bad[0][0]}"]`).focus();
      return;
    }
    // One send at a time: the button is disabled and a second submit (Enter in a field) is ignored
    if (pending) return;
    const data = message();
    pending = true;
    submit.disabled = true;
    status.textContent = "Sending…";
    status.className = "cstatus";
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), WAIT);
    try {
      const r = await fetch("/1NEON/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", "x-1neon": "1" },
        body: JSON.stringify(data),
        signal: stop.signal,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        // The server's checks (a real mail domain, no throwaway mailbox, a real name) answer field by
        // field: each message goes under its field, and the first such field gets focus
        const fields = j.error === "check_fields" && j.current?.fields;
        if (fields) {
          let first;
          for (const [name, m] of Object.entries(fields)) {
            const el = form.elements[name];
            if (el && !(el instanceof RadioNodeList)) { fieldError(el, m); first ??= el; }
          }
          first?.focus();
          const e2 = new Error(Object.values(fields)[0]);
          e2.fields = true;
          throw e2;
        }
        throw new Error(r.status === 400 ? "Something in the form needs another look. Check the email address and try again." : j.message || "");
      }
      document.getElementById("cdoneTo").textContent = data.email;
      form.reset();
      status.textContent = "";
      await swap(form, done);
      done.focus();
    } catch (err) {
      // The typed draft is never cleared on a failure or a timeout, so nothing has to be written twice
      status.textContent = stop.signal.aborted ? UNSURE : err.fields ? "A field above needs another look." : `${err.message || "That didn't send."} You can also email hello@neon1.tech.`;
      status.className = "cstatus err";
    } finally {
      clearTimeout(timer);
      pending = false;
      submit.disabled = false;
    }
  });

  document.getElementById("cagain").addEventListener("click", () => {
    swap(done, form).then(() => form.elements.today.focus());
  });

  // ---- The form has an address: /#contact?message=1 ----
  // Opening the form adds that address as a history entry, so Back closes it and Forward opens it again; opening the page at the
  // address, or following a link to it from 1NEON, opens it too. Closing with a press steps back when this page opened it, and
  // otherwise just takes the question mark off the address, so a reload or a shared link never leaves the site
  const ADDRESS = "#contact?message=1";
  let opened = false; // true once this page itself pushed the address
  const show = (open) => (window.n1Fold ? window.n1Fold(fold, open) : (fold.open = open));
  const match = () => show(location.hash === ADDRESS);
  fold.querySelector(":scope > summary").addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = location.hash === ADDRESS;
    if (!open) {
      window.n1KeepSpot?.();
      history.pushState(null, "", ADDRESS);
      opened = true;
    } else if (opened) history.back();
    else { history.replaceState(history.state, "", "#contact"); match(); }
  });
  addEventListener("popstate", () => { if (location.hash !== ADDRESS) opened = false; match(); });
  addEventListener("n1:entry", match);
  addEventListener("hashchange", match);
  fold.hidden = false;
  if (location.hash === ADDRESS) fold.open = true;
}
