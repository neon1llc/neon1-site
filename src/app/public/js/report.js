// src/app/public/js/report.js - "report a bug" in the footer: a short form in a dialog that works from every page.
// It sends what happened, an optional email for a reply, and (without asking) the page and theme, to 1NEON's bug route, which mails
// hello@. Without this script the footer link is a plain mailto. Nothing is stored in the browser. A send waits at most WAIT ms;
// past that the outcome is unknown, so the words stay and the visitor is told to check before sending again (no auto-retry).

const link = document.querySelector("a.report-bug");
if (link) {
  const WAIT = 15000;
  const UNSURE = "I couldn't confirm that was sent. It may still have arrived, so before sending it again, please email hello@neon1.tech.";
  let dlg;

  // Built on first use, so a page that never opens it pays nothing
  const build = () => {
    dlg = document.createElement("dialog");
    dlg.className = "report-dlg";
    dlg.setAttribute("aria-labelledby", "report-h");
    dlg.innerHTML = `
      <form class="report-form" novalidate>
        <h2 id="report-h">report a bug</h2>
        <label>What happened <textarea name="what" rows="5" maxlength="3000" required></textarea></label>
        <label>Email <span class="opt">optional, only if you want a reply</span> <input name="email" type="email" autocomplete="email" /></label>
        <label class="report-hp" aria-hidden="true">Leave this empty <input name="website" tabindex="-1" autocomplete="off" /></label>
        <p class="report-auto">I'll also see which page you were on and which theme.</p>
        <p class="report-status" role="status" aria-live="polite"></p>
        <div class="report-actions"><button type="submit" class="btn btn-primary">Send</button><button type="button" class="btn btn-ghost" data-close>Cancel</button></div>
      </form>
      <div class="report-done" tabindex="-1" hidden><h2>Thank you</h2><p>I'll take a look.</p><div class="report-actions"><button type="button" class="btn btn-ghost" data-close>Close</button></div></div>`;
    document.body.append(dlg);
    const form = dlg.querySelector("form"), done = dlg.querySelector(".report-done"), status = dlg.querySelector(".report-status"), submit = form.querySelector("[type=submit]");
    let pending = false;
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
    // The words (not a stray tap) are what a close keeps: reopening shows them again; a sent report clears them
    const field = (name, text) => {
      const el = form.elements[name], id = `report-err-${name}`;
      document.getElementById(id)?.remove();
      el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby");
      if (!text) return;
      const note = document.createElement("span");
      note.id = id; note.className = "report-err"; note.textContent = text;
      el.after(note);
      el.setAttribute("aria-invalid", "true"); el.setAttribute("aria-describedby", id);
    };
    form.addEventListener("input", (e) => { if (e.target.getAttribute?.("aria-invalid") === "true") field(e.target.name, ""); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (pending) return;
      const what = form.elements.what.value.trim(), email = form.elements.email.value.trim();
      field("what", ""); field("email", "");
      const bad = [];
      if (what.length < 10) bad.push(["what", what ? "Tell me a little more, at least 10 characters." : "Say what happened."]);
      if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) bad.push(["email", "Enter a full email address, or leave it empty."]);
      if (bad.length) { bad.forEach(([n, m]) => field(n, m)); status.textContent = ""; form.elements[bad[0][0]].focus(); return; }
      pending = true; submit.disabled = true; status.className = "report-status"; status.textContent = "Sending…";
      const stop = new AbortController(), timer = setTimeout(() => stop.abort(), WAIT);
      try {
        const r = await fetch("/1NEON/api/bug", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json", "x-1neon": "1" },
          body: JSON.stringify({
            what, ...(email ? { email } : {}),
            page: (location.pathname + location.search).slice(0, 300),
            theme: document.documentElement.dataset.siteTheme === "matrix" ? "matrix" : "awake",
            where: "site",
            website: form.elements.website.value,
          }),
          signal: stop.signal,
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          const fields = j.current?.fields || j.fields;
          if (fields && typeof fields === "object") {
            let first;
            for (const [n, m] of Object.entries(fields)) if (form.elements[n]) { field(n, String(m)); first ??= form.elements[n]; }
            first?.focus();
            status.textContent = ""; return;
          }
          throw new Error(r.status === 429 ? "That's a lot of reports from one place. Please try again later." : "");
        }
        form.reset();
        form.hidden = true; done.hidden = false; done.focus();
      } catch (err) {
        status.className = "report-status err";
        status.textContent = stop.signal.aborted ? UNSURE : `${err.message || "That didn't send."} You can also email hello@neon1.tech.`.trim();
      } finally { clearTimeout(timer); pending = false; submit.disabled = false; }
    });
    dlg.addEventListener("close", () => { link.focus({ preventScroll: true }); });
  };

  link.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button || typeof HTMLDialogElement !== "function") return;
    e.preventDefault();
    if (!dlg) build();
    const form = dlg.querySelector("form"), done = dlg.querySelector(".report-done");
    // Opened again after a sent report: a fresh form
    if (!done.hidden) { done.hidden = true; form.hidden = false; }
    dlg.showModal();
    form.elements.what.focus();
  });
}
