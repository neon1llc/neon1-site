// src/app/public/js/blog-share.js - "Share this post" on a blog post. The service links work without JavaScript;
// this reveals Copy link where the clipboard is available, and Share for the device's own share sheet (phones,
// some desktops), and says briefly when the link is copied. Nothing is sent anywhere until the reader picks one.

const box = document.querySelector(".kc-share");
if (box) {
  const { url, title, text } = box.dataset;
  const status = box.querySelector(".kc-share-status");
  const copy = box.querySelector(".kc-share-copy");
  const native = box.querySelector(".kc-share-native");

  // A short note under the links, cleared after a few seconds
  let timer = 0;
  const say = (msg) => {
    status.textContent = msg;
    clearTimeout(timer);
    timer = setTimeout(() => { status.textContent = ""; }, 3000);
  };

  // ---- Copy link ----
  if (copy && navigator.clipboard?.writeText) {
    copy.parentElement.hidden = false;
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url);
        say("Link copied.");
      } catch {
        say(`Copy this link: ${url}`);
      }
    });
  }

  // ---- The device's share sheet ----
  if (native && navigator.share && (!navigator.canShare || navigator.canShare({ url }))) {
    native.parentElement.hidden = false;
    native.addEventListener("click", () => {
      // A reader closing the sheet rejects the promise; that's not an error worth showing
      navigator.share({ title, text, url }).catch(() => {});
    });
  }
}
