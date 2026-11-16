// src/app/public/js/neo.js - Neo, the "ask neon1" window, on the Knowledge Center and blog pages.
//
// The landing page loads it from js/page.js, beside the rain; these pages have no rain, so this loads
// the same shared window by itself. It is optional: a failure leaves the page working, with the
// contact links in the footer.

// The page's own look decides the window's: light on awake, dark in the matrix (dark) theme
const light = () => document.documentElement.dataset.siteTheme !== "matrix";

import("/shared/chat.js").then(({ chat }) => {
  chat({ light, watch: [document.querySelector("header")] });
  // The window re-checks its look on scroll; a theme switch (js/theme.js) asks for the same check
  document.addEventListener("n1:theme", () => dispatchEvent(new Event("scroll")));
}).catch(() => { /* Neo unavailable: the contact links remain */ });
