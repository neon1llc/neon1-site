// src/app/public/js/blog-share.js - The share row on a blog post. LinkedIn and Email work without JavaScript;
// this adds one more button where the browser supports it: Share for the device's own share sheet (phones,
// some desktops), or else Copy link, which says "Copied" for a moment. A reader who came from a social
// network also gets that network's link, since they are the ones likeliest to share back to it.
// Nothing is sent anywhere until the reader picks one.

const box = document.querySelector(".kc-share");
if (box) {
  const { url, title, text } = box.dataset;
  const status = box.querySelector(".kc-share-status");
  const copy = box.querySelector(".kc-share-copy");
  const native = box.querySelector(".kc-share-native");

  // A short note for screen readers (and as a fallback on screen), cleared after a few seconds
  let timer = 0;
  const say = (msg, show = false) => {
    status.textContent = msg;
    status.toggleAttribute("data-show", show);
    clearTimeout(timer);
    timer = setTimeout(() => { status.textContent = ""; status.removeAttribute("data-show"); }, show ? 15000 : 3000);
  };

  // ---- One device button: the share sheet where there is one, otherwise Copy link ----
  const sheet = native && navigator.share && (!navigator.canShare || navigator.canShare({ url }));
  if (sheet) {
    native.parentElement.hidden = false;
    native.addEventListener("click", () => {
      // A reader closing the sheet rejects the promise; that's not an error worth showing
      navigator.share({ title, text, url }).catch(() => {});
    });
  } else if (copy && navigator.clipboard?.writeText) {
    copy.parentElement.hidden = false;
    const label = copy.querySelector("span");
    let back = 0;
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url);
        // The button itself confirms, then reads Copy link again
        label.textContent = "Copied";
        clearTimeout(back);
        back = setTimeout(() => { label.textContent = "Copy link"; }, 2000);
        say("Link copied.");
      } catch {
        // The clipboard refused (a permission, an old browser): show the link to copy by hand
        say(`Copy this link: ${url}`, true);
      }
    });
  }

  // ---- The network the reader came from, if any ----
  let host = "";
  try { host = new URL(document.referrer).hostname.replace(/^www\./, ""); } catch { /* no referrer, or none sent */ }
  if (host) {
    for (const li of box.querySelectorAll("li[data-from]")) {
      // A host matches its own name or any subdomain of it (l.facebook.com, old.reddit.com)
      if (li.dataset.from.split(" ").some((h) => host === h || host.endsWith(`.${h}`))) { li.hidden = false; break; }
    }
  }
}
