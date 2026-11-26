// src/app/public/shared/chat.js - Neo, neon1's assistant window, shared by the site and 1NEON.
//
// Answers come from neon1-chat at /chat/api/chat on this origin, so the strict CSP needs no
// exceptions. Replies are built as DOM nodes, never HTML: paragraphs, "- " lists, and
// Markdown links to http(s), mailto, and tel only. The conversation lives in memory and is
// gone on reload.

const ENDPOINT = "/chat/api/chat";

// The conversation contract shared with the API (neon1-chat app/src/contract.mjs); change both
// together, the API first. Turns alternate visitor and Neo, start and end with the visitor, and
// number at most `turns`; each is at most `chars` characters after trimming, whoever wrote it;
// together they hold at most `total`. Characters are string length, as maxlength counts them
const LIMITS = { turns: 11, chars: 1200, total: 6000 };

// How long one question may wait. The API gives up at 15 seconds with a clear message, so this
// only fires when that message can't arrive (a dropped connection, say)
const DEADLINE_MS = 25000;

// Longest open and close animations, plus a margin: each completes on time even when the browser
// never reports its end (cancelled, hidden by an overlay, motion turned off, or no stylesheet)
const GROW_MS = 600;
const FOLD_MS = 450;

// Starting points for a first-time visitor, and the ways to reach a person
const SUGGESTIONS = ["What does neon1 do?", "How does a project work?", "What is 1NEON?", "When are you available?"];
const BOOKING = "https://calendly.com/book-neon1/initial";
const CHAT = "/1NEON/?signup=1";
const EMAIL = "mailto:hello@neon1.tech";
const PHONE = "tel:+14243263661";

const SVG = "http://www.w3.org/2000/svg";
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const reduce = () => motion.matches;

// Small element helper: tag, class, text, and attributes
function el(tag, cls, text, attrs = {}) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// The bug's line drawing, the one the footer's and 1NEON's "report a bug" use (16px grid, outline, current text color)
function bugMark() {
  const svg = document.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 16 16", "aria-hidden": "true", class: "n1chat-bugmark" })) svg.setAttribute(k, v);
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", "M5.5 5.2V4a2.5 2.5 0 0 1 5 0v1.2M4.4 6.2h7.2v3.6a3.6 3.6 0 0 1-7.2 0zM8 6.4v7M1.8 7.6l2.6.9M14.2 7.6l-2.6.9M2.2 12.2l2.5-1.2M13.8 12.2 11.3 11");
  svg.append(path);
  return svg;
}

// The speech bubble the footer's "feedback" uses, in the same 16px outline style
function feedbackMark() {
  const svg = document.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 16 16", "aria-hidden": "true", class: "n1chat-bugmark" })) svg.setAttribute(k, v);
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", "M2.5 3h11v7.2H8.4L5.2 13v-2.8H2.5zM5.4 5.8h5.2M5.4 7.6h3.2");
  svg.append(path);
  return svg;
}

// The neon1 mark (the site logo's eight arcs), drawn in the current text color
function person() {
  const svg = document.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "aria-hidden": "true", class: "n1chat-mark" })) svg.setAttribute(k, v);
  const c = document.createElementNS(SVG, "circle"); c.setAttribute("cx", "12"); c.setAttribute("cy", "8"); c.setAttribute("r", "4");
  const b = document.createElementNS(SVG, "path"); b.setAttribute("d", "M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7");
  svg.append(c, b);
  return svg;
}

function mark() {
  const svg = document.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({ viewBox: "3 4 58 58", fill: "none", stroke: "currentColor", "stroke-width": "3.4", "stroke-linecap": "round", "aria-hidden": "true", class: "n1chat-mark" })) svg.setAttribute(k, v);
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", "M6 6a24 24 0 0 1 24 24v30M6 12a18 18 0 0 1 18 18v30M6 18a12 12 0 0 1 12 12v30M6 24a6 6 0 0 1 6 6v30M34 6a24 24 0 0 1 24 24v30M34 12a18 18 0 0 1 18 18v30M34 18a12 12 0 0 1 12 12v30M34 24a6 6 0 0 1 6 6v30");
  svg.append(path);
  return svg;
}

// ---- The history: what goes up with each question ----

// Markdown links and bare URLs: a cut inside one would leave a broken or wrong link
const LINKISH = /\[[^\]]*\]\([^)\s]*\)|(?:https?:\/\/|mailto:|tel:)\S+/g;

// The API's rule for a reply too long for the history (contract.mjs clip): cut at the last
// sentence end, else the last space, never inside a link, with "…" marking a mid-sentence cut.
// The API already keeps replies this short; this keeps the history valid if one isn't
function clip(text, max) {
  if (text.length <= max) return text;
  const room = max - 1;
  const spans = [...text.matchAll(LINKISH)].map((m) => [m.index, m.index + m[0].length]);
  const free = (i) => !spans.some(([a, b]) => i > a && i < b);
  let sentence = -1, space = -1;
  for (let i = room; i > 0; i--) {
    if (!free(i)) continue;
    if (sentence < 0 && /[.!?]/.test(text[i - 1]) && (i === text.length || /\s/.test(text[i]))) sentence = i;
    if (space < 0 && /\s/.test(text[i])) space = i;
    if (sentence >= 0) break;
  }
  if (sentence >= room / 2) return text.slice(0, sentence).trimEnd();
  let cut = space > 0 ? space : room;
  if (/[\uD800-\uDBFF]/.test(text[cut - 1] ?? "")) cut--;
  return `${text.slice(0, cut).trimEnd()}…`;
}

// The turns to send: the kept history plus the new question, dropping the oldest question and
// answer together until the turn count and total fit. The history holds whole pairs and the
// question fits on its own, so the newest question always goes up and the order stays valid
function fit(history, question) {
  const turns = [...history, { role: "user", content: question }];
  const size = () => turns.reduce((n, t) => n + t.content.length, 0);
  while (turns.length > LIMITS.turns || size() > LIMITS.total) turns.splice(0, 2);
  return turns;
}

// ---- Reply rendering: inline links, then paragraphs and lists ----

const LINK = /\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^\s)]+)\)|(https?:\/\/[^\s<>"')]+[^\s<>"').,;:!?])/g;

// Long bare URLs show as their host and the start of the path
function short(url) {
  const text = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return text.length > 30 ? `${text.slice(0, 28)}…` : text;
}

function inline(target, text) {
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    target.append(text.slice(last, m.index));
    const href = m[2] ?? m[3];
    // The last word carries the arrow and never parts from it at a line break (as css/frame.css a.ext .ext-end)
    const label = m[1] ?? short(m[3]);
    const cut = label.lastIndexOf(" ") + 1;
    const a = el("a", "n1chat-link", label.slice(0, cut), { href });
    a.append(el("span", "n1chat-end", label.slice(cut)));
    if (href.startsWith("http")) Object.assign(a, { target: "_blank", rel: "noopener" });
    target.append(a);
    last = m.index + m[0].length;
  }
  target.append(text.slice(last));
}

// Blank lines split paragraphs; a run of "- " lines becomes one list
function render(target, text) {
  for (const block of text.trim().split(/\n\s*\n/)) {
    const lines = block.split("\n").filter((line) => line.trim());
    let list = null, para = null;
    for (const line of lines) {
      const item = line.match(/^\s*[-*•]\s+(.*)$/);
      if (item) {
        list ??= target.appendChild(el("ul"));
        para = null;
        inline(list.appendChild(el("li")), item[1]);
      } else {
        list = null;
        if (para) para.append(" ");
        else para = target.appendChild(el("p"));
        inline(para, line.trim());
      }
    }
  }
}

/**
 * Mount Neo. `light` says whether the page around it is in its light ("awake") look; it's
 * checked on scroll and whenever an element in `watch` changes, so Neo follows the page.
 * `className` lets a host page place the window; "n1chat-right" anchors it bottom-right.
 */
export function chat({ root = document.body, endpoint = ENDPOINT, className = "", light = () => false, watch = [] } = {}) {
  // Answered turns only, as whole question and answer pairs, each already within the contract
  const history = [];

  // ---- The launcher: a round mark that stretches to show "ask Neo" ----
  const launcher = el("button", "n1chat-launch", null, { type: "button", "aria-expanded": "false", "aria-controls": "n1chat", "aria-label": "Ask Neo, neon1's assistant" });
  launcher.append(mark(), el("span", "n1chat-label", "ask Neo", { "aria-hidden": "true" }));

  // ---- The window ----
  const panel = el("div", "n1chat", null, { id: "n1chat", role: "dialog", "aria-label": "Neo, neon1's assistant", hidden: "" });

  const head = el("div", "n1chat-head");
  const title = el("strong", "n1chat-title");
  title.append(mark(), "Neo");
  const fresh = el("button", "n1chat-tool", "new", { type: "button", "aria-label": "Start a new conversation" });
  const close = el("button", "n1chat-tool", "close", { type: "button", "aria-label": "Close" });
  const tools = el("span", "n1chat-tools");
  tools.append(fresh, close);
  head.append(title, tools);
  // One line under the tabs says what this conversation is: Neo is instant and automated, the other is a person who replies later
  const sub = el("p", "n1chat-sub", "Instant answers, automated");

  // The greeting says plainly that Neo is automated
  const log = el("div", "n1chat-log", null, { role: "log", "aria-live": "polite" });
  const hello = el("div", "n1chat-msg n1chat-bot");
  // "automated assistant" links to how neon1 works with AI, in a new tab so the conversation stays open
  const greeting = el("p");
  greeting.append("I'm Neo, neon1's ", el("a", "n1chat-plain", "automated assistant", { href: "/knowledge/policies/ai-use/", target: "_blank", rel: "noopener" }), ". Ask about services, process, case studies, or 1NEON.");
  hello.append(greeting);

  // Suggested questions, shown until the first question is asked
  const chips = el("div", "n1chat-chips");
  for (const q of SUGGESTIONS) {
    const chip = el("button", "n1chat-chip", q, { type: "button" });
    chip.addEventListener("click", () => ask(q));
    chips.append(chip);
  }
  log.append(hello, chips);

  const form = el("form", "n1chat-form");
  const input = el("textarea", "n1chat-input", null, { rows: "1", maxlength: String(LIMITS.chars), "aria-label": "Your question", "aria-describedby": "n1chat-note", placeholder: "Ask Neo" });
  // Keep the box one line until wrapping needs more room, then scroll inside it past the limit
  const fitInput = () => {
    input.style.height = "auto";
    const max = 160;
    input.style.height = `${Math.min(input.scrollHeight, max)}px`;
    input.style.overflowY = input.scrollHeight > max ? "auto" : "hidden";
  };
  input.addEventListener("input", fitInput);
  addEventListener("resize", fitInput);
  window.visualViewport?.addEventListener("resize", fitInput);
  const send = el("button", "n1chat-send", "send", { type: "submit" });
  form.append(input, send);

  // A reminder by the box: Neo needs nothing private. The policy opens in a new tab, since the
  // conversation lives only in this page
  const note = el("p", "n1chat-note", "Don't share passwords, health details, or anything private. ", { id: "n1chat-note" });
  note.append(el("a", "n1chat-plain", "Privacy", { href: "/1NEON/privacy", target: "_blank", rel: "noopener" }));

  // A person is always one click away, whatever Neo says
  const human = el("p", "n1chat-human");
  human.append(
    "Reach a person: ",
    // Chat is in 1NEON, with an account: this opens sign-up, where a free account is enough
    el("a", "n1chat-plain n1chat-ext", "chat", { href: CHAT, target: "_blank", rel: "noopener", title: "Chat with me in 1NEON, with a free account" }),
    ", ",
    el("a", "n1chat-plain n1chat-ext", "book", { href: BOOKING, target: "_blank", rel: "noopener" }),
    ", ",
    el("a", "n1chat-plain n1chat-ext", "email", { href: EMAIL, target: "_blank", rel: "noopener" }),
    ", or ",
    el("a", "n1chat-plain n1chat-ext", "call", { href: PHONE }),
    ".",
  );

  // Bottom right: "report bug \\ feedback", each a form page in a new tab, so a bug seen or a thought had while talking to Neo is one
  // click away (?from=neo picks "Neo chat" on the page). Both always show, on the form pages too, so the pair never changes shape
  const bug = el("p", "n1chat-bug");
  const bugLink = el("a", "n1chat-plain n1chat-ext n1chat-buglink", "", { href: "/report-bug/?from=neo", target: "_blank", rel: "noopener", "aria-label": "report a bug" });
  bugLink.append(bugMark(), "bug");
  const feedbackLink = el("a", "n1chat-plain n1chat-ext n1chat-buglink", "", { href: "/feedback/?from=neo", target: "_blank", rel: "noopener", "aria-label": "report feedback" });
  feedbackLink.append(feedbackMark(), "feedback");
  bug.append(el("span", "n1chat-lead", "report"), bugLink, el("span", "n1chat-sep", "\\", { "aria-hidden": "true" }), feedbackLink);

  sub.hidden = true;
  panel.append(head, sub, log, form, note, human, bug);
  for (const cls of className.split(/\s+/).filter(Boolean)) for (const node of [launcher, panel]) node.classList.add(cls);
  root.append(launcher, panel);

  // ---- Other conversations beside Neo: a host page adds a tab (1NEON adds neon1), and Neo's own parts hide while it shows ----
  const neoParts = [log, form, note, human];
  const tabs = [];
  let neoTab = null;
  let current = "neo";
  const launchLabel = launcher.querySelector(".n1chat-label");
  const launchAria = launcher.getAttribute("aria-label");
  const launchText = launchLabel.textContent;
  const badge = (n) => { const b = el("b", "n1chat-badge", n > 0 ? String(n > 9 ? "9+" : n) : "", { "aria-hidden": "true" }); b.hidden = !(n > 0); return b; };
  // Each tab hears whether it is the one in view (shown and the window open), so a conversation reads only while someone can see it
  const tell = () => { for (const t of tabs) t.onselect?.(t.id === current && !panel.hidden); };
  function select(id) {
    current = id;
    const neo = id === "neo";
    for (const n of neoParts) n.hidden = !neo;
    fresh.hidden = !neo;
    neoTab?.setAttribute("aria-selected", String(neo));
    sub.textContent = neo ? "Instant answers, automated" : tabs.find((t) => t.id === id)?.hint ?? "";
    sub.hidden = !tabs.length;
    panel.classList.toggle("n1chat-person", !neo);
    for (const t of tabs) { t.el.hidden = t.id !== id; t.button.setAttribute("aria-selected", String(t.id === id)); }
    tell();
  }
  const total = () => tabs.reduce((n, t) => n + t.count, 0);
  function paintLauncher() {
    const n = total();
    launcher.querySelector(".n1chat-badge")?.remove();
    if (n > 0) launcher.append(Object.assign(badge(n), { className: "n1chat-badge n1chat-badge-launch" }));
    const named = tabs[0];
    launchLabel.textContent = named ? named.launcher?.label ?? launchText : launchText;
    launcher.setAttribute("aria-label", `${named ? named.launcher?.aria ?? launchAria : launchAria}${n > 0 ? `, ${n} new` : ""}`);
    launcher.classList.toggle("n1chat-wide", Boolean(named?.launcher?.label));
  }
  function addTab({ id, label, hint, launcher: spec, onselect }) {
    if (!neoTab) {
      neoTab = el("button", "n1chat-title n1chat-tab", null, { type: "button", role: "tab", "aria-selected": "true" });
      neoTab.append(mark(), "Neo");
      neoTab.addEventListener("click", () => select("neo"));
      const bar = el("span", "n1chat-tabs", null, { role: "tablist" });
      bar.append(neoTab);
      title.replaceWith(bar);
      neoTab.bar = bar;
    }
    const button = el("button", "n1chat-title n1chat-tab n1chat-tab-person", null, { type: "button", role: "tab", "aria-selected": "false" });
    button.append(person(), label);
    const count = badge(0);
    button.append(count);
    button.addEventListener("click", () => select(id));
    neoTab.bar.append(button);
    const box = el("div", "n1chat-extra", null, { hidden: "" });
    form.before(box);
    const t = { id, button, el: box, count: 0, launcher: spec, onselect, hint };
    tabs.push(t);
    paintLauncher();
    tell();
    return {
      el: box,
      // How many are new in this conversation: on the tab and on the launcher
      badge(n) { t.count = n; count.textContent = n > 9 ? "9+" : String(n); count.hidden = !(n > 0); paintLauncher(); },
      show() { open(true); select(id); },
      remove() {
        tabs.splice(tabs.indexOf(t), 1);
        box.remove();
        button.remove();
        if (!tabs.length && neoTab) { neoTab.bar.replaceWith(title); neoTab = null; }
        select("neo");
        paintLauncher();
      },
    };
  }

  // ---- Follow the page between its dark and light looks ----
  let frame = 0;
  const theme = () => {
    frame = 0;
    const on = !!light();
    launcher.classList.toggle("n1chat-light", on);
    panel.classList.toggle("n1chat-light", on);
  };
  const queue = () => (frame ||= requestAnimationFrame(theme));
  addEventListener("scroll", queue, { passive: true });
  const seen = new MutationObserver(queue);
  // Changes are batched into one check per frame, so busy pages cost almost nothing
  for (const node of watch) if (node) seen.observe(node, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
  theme();

  // ---- The launcher peeks open once, so the round mark reads as "ask Neo" ----
  if (!reduce()) {
    setTimeout(() => launcher.classList.add("n1chat-peek"), 1500);
    setTimeout(() => launcher.classList.remove("n1chat-peek"), 5000);
  }

  // ---- Open and close: the window grows up out of the launcher, and folds back into it ----

  // The running grow or fold, as a function that completes it now. It runs once, whichever comes
  // first: the panel's own animation ending or being cancelled, the time limit, or a new open/close
  let finish = null;
  function animate(cls, ms, after) {
    const end = (e) => {
      if (!e || e.target === panel) complete(); // a message sliding in inside the panel doesn't count
    };
    const timer = setTimeout(end, ms);
    const complete = () => {
      if (finish !== complete) return;
      finish = null;
      clearTimeout(timer);
      panel.removeEventListener("animationend", end);
      panel.removeEventListener("animationcancel", end);
      panel.classList.remove(cls);
      after();
    };
    finish = complete;
    panel.addEventListener("animationend", end);
    panel.addEventListener("animationcancel", end);
    panel.classList.add(cls);
    // No animation to wait for (motion off, the stylesheet missing, or the panel hidden by an overlay)
    if (panel.getAnimations && !panel.getAnimations().length) complete();
  }

  // While the window is open on a narrow screen, the page behind it holds its position
  let pinnedAt = null;
  const holdPage = () => { if (pinnedAt !== null && scrollY !== pinnedAt) scrollTo({ top: pinnedAt, left: 0, behavior: "instant" }); };
  function pin(on) {
    if (on === (pinnedAt !== null)) return;
    document.body.classList.toggle("n1chat-open", on);
    dispatchEvent(new Event("n1chat-pin"));
    if (on) { pinnedAt = scrollY; addEventListener("scroll", holdPage, { passive: true }); if (window.visualViewport) visualViewport.addEventListener("scroll", holdPage); }
    else { removeEventListener("scroll", holdPage); if (window.visualViewport) visualViewport.removeEventListener("scroll", holdPage); pinnedAt = null; }
  }

  let folding = false;
  function open(show) {
    // Already there, or already on the way out; otherwise any animation still running ends now
    if (folding ? !show : show === !panel.hidden) return;
    finish?.();
    launcher.setAttribute("aria-expanded", String(show));

    // On a narrow screen the open window covers the page, so the page stays exactly where it was: iOS
    // scrolls the page when the box takes focus and the keyboard rises, and the page's own scroll steering
    // would then follow it, one step at a time. The window's own log still scrolls
    pin(show && narrow.matches);

    if (show) {
      launcher.classList.add("n1chat-hidden");
      panel.hidden = false;
      requestAnimationFrame(fitInput);
      if (!reduce()) animate("n1chat-grow", GROW_MS, () => {});
      // Focus lands on the window, not the box, so phones don't raise the keyboard until someone taps in
      if (!panel.hasAttribute("tabindex")) panel.tabIndex = -1;
      panel.focus({ preventScroll: true });
      return;
    }

    // Runs once per close (animate sees to that). Focus returns to the launcher only if it was in
    // the window (or nowhere), so a menu or case study that opened meanwhile keeps its focus
    const done = () => {
      folding = false;
      const focused = document.activeElement;
      const ours = !focused || focused === document.body || panel.contains(focused);
      panel.hidden = true;
      launcher.classList.remove("n1chat-hidden");
      if (ours) launcher.focus({ preventScroll: true });
    };
    if (reduce()) return done();
    folding = true;
    animate("n1chat-fold", FOLD_MS, done);
  }
  launcher.addEventListener("click", () => open(true));
  close.addEventListener("click", () => open(false));
  // Tabs hear when the window opens or closes (it is hidden at the start of each fold's end and shown at each open)
  new MutationObserver(tell).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return open(false);
    // On a narrow screen the window covers the page, so it behaves as a modal there: Tab and Shift+Tab
    // wrap inside it rather than moving focus to links hidden behind it. Wider screens stay nonmodal
    if (e.key !== "Tab" || !narrow.matches) return;
    const stops = [...panel.querySelectorAll("button, a[href], textarea, input")].filter((n) => !n.disabled && n.offsetParent !== null);
    if (!stops.length) return;
    const first = stops[0], last = stops[stops.length - 1], at = document.activeElement;
    if (e.shiftKey && (at === first || at === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
  });
  // aria-modal follows the same width rule, so assistive technology hears what the keyboard gets
  const narrow = matchMedia("(max-width: 600px)");
  // When Neo is open, a click on any page control closes it first, while the original
  // pointer/click still reaches that control. This also covers controls rendered in portals.
  const dismissFromControl = (event) => {
    if (panel.hidden || !(event.target instanceof Element)) return;
    if (panel.contains(event.target) || launcher.contains(event.target)) return;
    if (!event.target.closest("button, a[href], input, select, textarea, [role=button]")) return;
    open(false);
  };
  document.addEventListener("pointerdown", dismissFromControl, true);
  document.addEventListener("click", dismissFromControl, true);
  const modality = () => panel.setAttribute("aria-modal", String(narrow.matches));
  modality();
  narrow.addEventListener?.("change", modality);
  // Turning motion off midway ends the animation at once rather than waiting out the timer
  motion.addEventListener?.("change", () => finish?.());

  // ---- One request at a time, owned by one conversation ----

  // "new" bumps the generation, so an answer or error for an earlier conversation is dropped
  // instead of landing in this one. `active` is the request in flight, if any: its abort
  // controller, its deadline timer, and its typing dots
  let generation = 0;
  let active = null;

  // While Neo is cooling down for this visitor (the API said how long), the send button rests too,
  // so a question isn't sent just to be refused. The API enforces the wait either way
  let restUntil = 0;
  let restTimer = 0;
  const resting = () => Date.now() < restUntil;
  function rest(seconds) {
    if (!(seconds > 0)) return;
    restUntil = Date.now() + seconds * 1000;
    send.disabled = true;
    clearTimeout(restTimer);
    restTimer = setTimeout(() => {
      if (!active) send.disabled = false;
    }, seconds * 1000);
  }
  // Roughly how long is left, in words
  function left() {
    const s = Math.max(1, Math.ceil((restUntil - Date.now()) / 1000));
    if (s >= 20 * 3600) return "until tomorrow";
    if (s >= 3000) return `for about ${Math.round(s / 3600)} hour${s >= 5400 ? "s" : ""}`;
    return s >= 90 ? `for about ${Math.round(s / 60)} minutes` : "for a moment";
  }

  // Hand the controls back, once, and only for the request that still owns them
  function release(req) {
    if (active !== req) return;
    active = null;
    clearTimeout(req.timer);
    req.dots.remove();
    send.disabled = resting();
  }

  // A new conversation: the request in flight is cancelled, and the history, replies, and
  // controls reset together; the greeting and suggestions come back
  fresh.addEventListener("click", () => {
    generation++;
    if (active) {
      const req = active;
      release(req);
      req.controller.abort();
    }
    history.length = 0;
    log.replaceChildren(hello, chips);
    chips.hidden = false;
  });

  // Enter sends, Shift+Enter adds a line. The Enter that confirms an input method's candidate (Japanese,
  // Chinese, Korean, and others) belongs to the composition, not to Send
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    ask(input.value.trim());
  });

  // Each message slides up into place; the log keeps the newest in view
  function say(text, who) {
    const msg = el("div", `n1chat-msg n1chat-${who} n1chat-in`);
    if (who === "you") msg.textContent = text;
    else render(msg, text);
    log.append(msg);
    log.scrollTop = log.scrollHeight;
    return msg;
  }

  // Three dots while Neo writes
  function typing() {
    const dots = el("div", "n1chat-msg n1chat-bot n1chat-typing n1chat-in", null, { "aria-label": "Neo is typing" });
    dots.append(el("span"), el("span"), el("span"));
    log.append(dots);
    log.scrollTop = log.scrollHeight;
    return dots;
  }

  // What to say when a question gets no answer. A long question and a long conversation are
  // told apart: the first is the visitor's to shorten, the second the window fixes itself
  function trouble(res, data, late) {
    if (late) return "Neo is taking too long to answer. Try again in a moment.";
    if (!res) return "No connection. Try again in a moment.";
    if (data.code === "question_too_long") return `Keep your question under ${LIMITS.chars.toLocaleString("en-US")} characters.`;
    if (data.code === "conversation_too_long") return "This conversation is too long for Neo to follow, so Neo will start fresh with your next question.";
    return data.error ?? "Neo couldn't answer. Try again in a moment.";
  }

  // ---- Ask: the recent turns go up, one reply comes back ----
  async function ask(q) {
    q = q.trim();
    if (!q || active) return;
    // Still resting: the question stays in the box for later, and nothing is sent
    if (resting()) return void say(`Neo is still resting ${left()}. Your question stays in the box.`, "bot");
    // The box can't hold more than the limit, but a pasted or scripted question still gets words
    if (q.length > LIMITS.chars) return void say(trouble({}, { code: "question_too_long" }), "bot");

    input.value = "";
    chips.hidden = true;
    say(q, "you");
    const messages = fit(history, q);

    // This request owns the controls until it settles, "new" cancels it, or its deadline passes
    const req = { controller: new AbortController(), generation, dots: typing() };
    req.timer = setTimeout(() => req.controller.abort(), DEADLINE_MS);
    active = req;
    send.disabled = true;

    let res = null, data = {};
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: req.controller.signal,
      });
      data = (await res.json().catch(() => null)) ?? {};
    } catch {
      res = null; // offline, refused, or aborted
    }

    // A newer conversation owns the window now; this answer or error belongs to none
    if (req.generation !== generation || active !== req) return;
    const late = req.controller.signal.aborted;
    release(req);

    if (res?.ok && typeof data.reply === "string" && data.reply.trim()) {
      say(data.reply, "bot");
      // Only an answered question joins the history, with its answer kept within the contract
      history.splice(0, history.length, ...messages, { role: "assistant", content: clip(data.reply.trim(), LIMITS.chars) });
    } else {
      // The history itself was refused, so it goes; the question waits in the box to send again,
      // unless the visitor has already started typing another
      if (data.code === "conversation_too_long") history.length = 0;
      // A cooldown or the daily rest: hold the send button for as long as the API asked
      if (res?.status === 429) rest(Number(res.headers.get("retry-after")));
      const back = !input.value;
      if (back) input.value = q;
      say(`${trouble(res, data, late)}${back ? " Your question is back in the box." : ""}`, "bot");
    }
    // Back to the box only if the visitor is still in the window (or nowhere): a reply that arrives
    // after they moved on to the page, a menu, or a case study leaves their focus where it is
    const now = document.activeElement;
    if (!panel.hidden && (!now || now === document.body || panel.contains(now))) input.focus({ preventScroll: true });
  }

  return { open: () => open(true), close: () => open(false), addTab, show: (id) => { open(true); select(id); } };
}
