// src/app/public/js/signup.js - Shows the invitations to start a free 1NEON account (elements marked
// data-signup) only while 1NEON's sign-up is open. It asks 1NEON's public sign-up route once; while
// sign-up is closed, the ask fails, or this script doesn't run, they stay hidden.

const marked = document.querySelectorAll("[data-signup]");
if (marked.length) {
  // Same-origin credentials, so the private dev site's gate cookie goes along (without it the gate answers 404 and the invitations never showed on dev).
  // A slow or missing answer just leaves them hidden
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), 5000);
  fetch("/1NEON/api/auth/signup", { signal: ctl.signal, credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((info) => {
      if (info?.open === true) for (const el of marked) el.hidden = false;
    })
    .catch(() => {});
}
