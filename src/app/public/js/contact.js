// src/app/public/js/contact.js - The contact form: pick a topic, start from a common situation if one
// fits, and send. Messages go to 1NEON's contact route, which mails neon1's inbox and no one else.
// Nothing is stored in the browser or put in the URL. Without this script the form stays hidden and
// the email and phone links beside it do the job. A send waits at most WAIT ms; past that the outcome
// is unknown, so the draft stays and the visitor is told to check before sending again (no auto-retry).

const form = document.getElementById("cform");
if (form) {
  const status = document.getElementById("cstatus");
  const starts = document.getElementById("cstarts");
  const list = starts.querySelector(".cstart-list");
  const done = document.getElementById("cdone");
  const today = form.elements.today;
  const submit = form.querySelector('[type="submit"]');

  // How long a send may stay pending before the page stops waiting. The server may still have accepted it,
  // so this is an uncertain outcome, not a failure: nothing is resent automatically
  const WAIT = 15000;
  const UNSURE = "I couldn't confirm your message was sent. It may still have arrived, so before sending it again, please email hello@neon1.tech.";
  let pending = false;

  // Common situations for each topic, each with the case study closest to it
  const STARTS = {
    business: [
      ["We type the same orders, forms, or invoices into more than one place.", "dermatology", "Intake, out of the shared inbox"],
      ["Our email, spreadsheets, and booking or accounting tools don't talk to each other.", "dermatology", "Intake, out of the shared inbox"],
    ],
    cloud: [
      ["People can't find answers in our own documents.", "accounting", "Answers in seconds, with sources"],
      ["Our servers, deploys, or backups worry us.", "migration", "Two offices off local servers"],
    ],
    spaces: [
      ["The Wi-Fi drops, or some rooms barely get it.", "home", "From cameras to Grandma's email"],
      ["Cameras, smart devices, or new gear need setting up properly.", "home", "From cameras to Grandma's email"],
    ],
    security: [
      ["Our people need to spot phishing, fraud, and scams.", "security", "Security for non-security people"],
      ["A customer or audit is asking about our security (SOC 2).", "security", "Security for non-security people"],
    ],
    other: [],
  };

  // A tapped situation goes into "What happens today?", after anything already written
  function showStarts(topic) {
    list.replaceChildren(...(STARTS[topic] ?? []).map(([text, id, title]) => {
      const row = document.createElement("div");
      row.className = "cstart";
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.addEventListener("click", () => {
        const now = today.value.trim();
        if (!now.includes(text)) today.value = now ? `${now}\n${text} ` : `${text} `;
        today.focus();
        today.setSelectionRange(today.value.length, today.value.length);
      });
      const a = document.createElement("a");
      a.href = `#case-${id}`;
      a.textContent = `A similar project: ${title}`;
      row.append(b, a);
      return row;
    }));
    starts.hidden = !list.children.length;
  }
  form.addEventListener("change", (e) => { if (e.target.name === "topic") showStarts(e.target.value); });

  // Plain checks before sending; the first field that needs attention gets focus
  function problems() {
    const f = form.elements, out = [];
    if (!form.querySelector('[name="topic"]:checked')) out.push(["topic", "Pick what it's about."]);
    if (!f.today.value.trim()) out.push(["today", "Say what happens today."]);
    if (!f.name.value.trim()) out.push(["name", "Add your name."]);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) out.push(["email", "Add an email address I can reply to."]);
    return out;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    const bad = problems();
    if (bad.length) {
      status.textContent = bad.map(([, m]) => m).join(" ");
      status.className = "cstatus err";
      for (const [name] of bad) form.querySelectorAll(`[name="${name}"]`).forEach((el) => el.setAttribute("aria-invalid", "true"));
      form.querySelector(`[name="${bad[0][0]}"]`).focus();
      return;
    }
    // One send at a time: the button is disabled and a second submit (Enter in a field) is ignored
    if (pending) return;
    const data = Object.fromEntries(new FormData(form));
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
      showStarts("");
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
    form.querySelector('[name="topic"]').focus();
  });

  form.hidden = false;
}
