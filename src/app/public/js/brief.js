// src/app/public/js/brief.js - The optional pre-call brief: three answers become a short text the
// visitor can preview, copy, or download. Nothing is sent, stored, or put in the URL; the text
// only leaves the page if the visitor pastes it into an email or the booking form themselves.

const form = document.getElementById("brief");
if (form) {
  const out = document.getElementById("briefOut");
  const copy = document.getElementById("briefCopy");
  const save = document.getElementById("briefSave");
  const done = document.getElementById("briefDone");
  const field = (name) => form.elements[name].value.trim();

  // The brief exactly as it will be copied or saved
  function text() {
    const parts = [
      ["What happens today", field("today")],
      ["What should be better", field("better")],
      ["Timing", field("timing")],
    ].filter(([, v]) => v);
    return parts.length ? ["Brief for neon1", ...parts.map(([k, v]) => `${k}: ${v}`)].join("\n\n") : "";
  }

  // The preview follows every keystroke, and the actions wait for something to share
  function update() {
    const t = text();
    out.textContent = t || "Your brief appears here as you type.";
    copy.disabled = save.disabled = !t;
    done.textContent = "";
  }
  form.addEventListener("input", update);
  form.addEventListener("submit", (e) => e.preventDefault());

  // Copy to the clipboard, falling back to selecting the preview so it can be copied by hand
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text());
      done.textContent = "Copied. Paste it into an email or the booking form.";
    } catch {
      getSelection().selectAllChildren(out);
      done.textContent = "Selected. Copy it with your keyboard or menu.";
    }
  });

  // A plain text file, made in the browser
  save.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([text() + "\n"], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "neon1-brief.txt" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    done.textContent = "Saved as neon1-brief.txt.";
  });

  // The actions only make sense with this script, so they appear once it runs
  form.querySelector(".brief-actions").hidden = false;
  update();
}
