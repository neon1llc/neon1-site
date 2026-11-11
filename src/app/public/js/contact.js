// src/app/public/js/contact.js - The contact form, folded under "send me your use case": pick any of the
// four services (or none), add your own words in "something else", say what's going on, and send.
// Messages go to 1NEON's contact route, which mails neon1's inbox and no one else. Nothing is stored in
// the browser or put in the URL. Without this script the fold stays hidden and the email and phone links
// above it do the job. A send waits at most WAIT ms; past that the outcome is unknown, so the draft stays
// and the visitor is told to check before sending again (no auto-retry).

const fold = document.getElementById("cfold");
const form = document.getElementById("cform");
if (fold && form) {
  const status = document.getElementById("cstatus");
  const done = document.getElementById("cdone");
  const submit = form.querySelector('[type="submit"]');

  // How long a send may stay pending before the page stops waiting. The server may still have accepted it,
  // so this is an uncertain outcome, not a failure: nothing is resent automatically
  const WAIT = 15000;
  const UNSURE = "I couldn't confirm your message was sent. It may still have arrived, so before sending it again, please email hello@neon1.tech.";
  let pending = false;

  // Opening the fold puts the cursor in the first field it asks for
  fold.addEventListener("toggle", () => { if (fold.open && !form.hidden) form.elements.today.focus({ preventScroll: true }); });

  // Plain checks before sending; the first field that needs attention gets focus. What it's about is optional
  function problems() {
    const f = form.elements, out = [];
    if (!f.today.value.trim()) out.push(["today", "Say what's going on."]);
    if (!f.name.value.trim()) out.push(["name", "Add your name."]);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) out.push(["email", "Add an email address I can reply to."]);
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
      website: f.website.value,
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
        throw new Error(r.status === 400 ? "Something in the form needs another look. Check the email address and try again." : j.message || "");
      }
      document.getElementById("cdoneTo").textContent = data.email;
      form.reset();
      status.textContent = "";
      form.hidden = true;
      done.hidden = false;
      done.focus();
    } catch (err) {
      // The typed draft is never cleared on a failure or a timeout, so nothing has to be written twice
      status.textContent = stop.signal.aborted ? UNSURE : `${err.message || "That didn't send."} You can also email hello@neon1.tech.`;
      status.className = "cstatus err";
    } finally {
      clearTimeout(timer);
      pending = false;
      submit.disabled = false;
    }
  });

  document.getElementById("cagain").addEventListener("click", () => {
    done.hidden = true;
    form.hidden = false;
    form.elements.today.focus();
  });

  fold.hidden = false;
}
