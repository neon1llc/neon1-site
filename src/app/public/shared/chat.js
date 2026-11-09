// src/app/public/shared/chat.js - Neo, neon1's assistant window, shared by the site and 1NEON.
//
// Answers come from neon1-chat at /chat/api/chat on this origin, so the strict CSP needs no
// exceptions. Replies are built as DOM nodes, never HTML: paragraphs, "- " lists, and
// Markdown links to http(s), mailto, and tel only. The conversation lives in memory and is
// gone on reload.

const ENDPOINT = "/chat/api/chat";

// Bounds that match the API, so a too-long message is caught before it's sent
const MAX_CHARS = 1200;
const MAX_TURNS = 11;

// Longest open and close animations, plus a margin: each completes on time even when the browser
// never reports its end (cancelled, hidden by an overlay, motion turned off, or no stylesheet)
const GROW_MS = 600;
const FOLD_MS = 450;

// Starting points for a first-time visitor, and the ways to reach a person
const SUGGESTIONS = ["What does neon1 do?", "How does a project work?", "What is 1NEON?", "When are you available?"];
const BOOKING = "https://calendly.com/1isgladtobeofservice/neon1-consultation";
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

// The neon1 mark (the same paths as the favicon), drawn in the current text color
function mark() {
  const svg = document.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 64 64", fill: "none", stroke: "currentColor", "stroke-width": "6", "stroke-linecap": "round", "aria-hidden": "true", class: "n1chat-mark" })) svg.setAttribute(k, v);
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", "M6 6a24 24 0 0 1 24 24v30M6 18a12 12 0 0 1 12 12v30M34 6a24 24 0 0 1 24 24v30M34 18a12 12 0 0 1 12 12v30");
  svg.append(path);
  return svg;
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
    const a = el("a", "n1chat-link", m[1] ?? short(m[3]), { href });
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

  // The greeting says plainly that Neo is automated
  const log = el("div", "n1chat-log", null, { role: "log", "aria-live": "polite" });
  const hello = el("div", "n1chat-msg n1chat-bot");
  render(hello, "Hi, I'm Neo, neon1's automated assistant. Ask about services, how a project works, the case studies, or 1NEON.");

  // Suggested questions, shown until the first question is asked
  const chips = el("div", "n1chat-chips");
  for (const q of SUGGESTIONS) {
    const chip = el("button", "n1chat-chip", q, { type: "button" });
    chip.addEventListener("click", () => ask(q));
    chips.append(chip);
  }
  log.append(hello, chips);

  const form = el("form", "n1chat-form");
  const input = el("textarea", "n1chat-input", null, { rows: "2", maxlength: String(MAX_CHARS), "aria-label": "Your question", placeholder: "Ask Neo" });
  const send = el("button", "n1chat-send", "send", { type: "submit" });
  form.append(input, send);

  // A person is always one click away, whatever Neo says
  const human = el("p", "n1chat-human");
  human.append(
    "Reach a person: ",
    el("a", "n1chat-plain", "book", { href: BOOKING, target: "_blank", rel: "noopener" }),
    ", ",
    el("a", "n1chat-plain", "email", { href: EMAIL }),
    ", or ",
    el("a", "n1chat-plain", "call", { href: PHONE }),
    ".",
  );

  panel.append(head, log, form, human);
  for (const cls of className.split(/\s+/).filter(Boolean)) for (const node of [launcher, panel]) node.classList.add(cls);
  root.append(launcher, panel);

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

  let folding = false;
  function open(show) {
    // Already there, or already on the way out; otherwise any animation still running ends now
    if (folding ? !show : show === !panel.hidden) return;
    finish?.();
    launcher.setAttribute("aria-expanded", String(show));

    if (show) {
      launcher.classList.add("n1chat-hidden");
      panel.hidden = false;
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
  panel.addEventListener("keydown", (e) => e.key === "Escape" && open(false));
  // Turning motion off midway ends the animation at once rather than waiting out the timer
  motion.addEventListener?.("change", () => finish?.());

  // A new conversation: the history and replies go, the greeting and suggestions come back
  fresh.addEventListener("click", () => {
    history.length = 0;
    log.replaceChildren(hello, chips);
    chips.hidden = false;
  });

  // Enter sends, Shift+Enter adds a line
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
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

  // ---- Ask: the recent turns go up, one reply comes back ----
  async function ask(q) {
    if (!q || send.disabled) return;

    input.value = "";
    chips.hidden = true;
    say(q, "you");
    history.push({ role: "user", content: q.slice(0, MAX_CHARS) });
    while (history.length > MAX_TURNS) history.splice(0, 2);

    send.disabled = true;
    const dots = typing();

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json().catch(() => ({}));
      const text = data.reply ?? data.error ?? "Neo couldn't answer just now. Please try again in a moment.";

      dots.remove();
      say(text, "bot");

      // Only real answers join the history; a failed turn is dropped so the next one is valid
      if (res.ok && data.reply) history.push({ role: "assistant", content: data.reply });
      else history.pop();
    } catch {
      dots.remove();
      say("No connection right now. Please try again in a moment.", "bot");
      history.pop();
    } finally {
      send.disabled = false;
      input.focus({ preventScroll: true });
    }
  }

  return { open: () => open(true), close: () => open(false) };
}
