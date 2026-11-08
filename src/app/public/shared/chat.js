// src/app/public/shared/chat.js - The "ask neon1" window, shared by the site and 1NEON.
//
// Answers come from neon1-chat at /chat/api/chat on this origin, so the strict CSP needs no
// exceptions. Replies are written as text nodes, never HTML; only http(s) and mailto links
// are made clickable. The conversation lives in memory and is gone on reload.

const ENDPOINT = "/chat/api/chat";

// Bounds that match the API, so a too-long message is caught before it's sent
const MAX_CHARS = 1200;
const MAX_TURNS = 11;

// Small element helper: tag, class, text, and attributes
function el(tag, cls, text, attrs = {}) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// Plain text with bare URLs, emails, and stray Markdown links turned into safe anchors
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)|(https?:\/\/[^\s<>"')]+[^\s<>"').,;:!?])|([\w.+-]+@[\w-]+\.[\w.-]*\w)/g;

// Long URLs show as their host and the start of the path; the full address is the title
function short(url) {
  if (!url) return null;
  const text = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return text.length > 30 ? `${text.slice(0, 28)}…` : text;
}

function render(target, text) {
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    target.append(text.slice(last, m.index));
    const href = m[2] ?? m[3] ?? `mailto:${m[4]}`;
    const a = el("a", "n1chat-link", m[1] ?? short(m[3]) ?? m[4], { href, title: href });
    if (href.startsWith("http")) Object.assign(a, { target: "_blank", rel: "noopener" });
    target.append(a);
    last = m.index + m[0].length;
  }
  target.append(text.slice(last));
}

export function chat({ root = document.body, endpoint = ENDPOINT } = {}) {
  const history = [];

  // ---- The launcher and the window ----
  const launcher = el("button", "n1chat-launch", "ask neon1", { type: "button", "aria-expanded": "false", "aria-controls": "n1chat" });
  const panel = el("div", "n1chat", null, { id: "n1chat", role: "dialog", "aria-label": "Ask neon1", hidden: "" });

  const head = el("div", "n1chat-head");
  const close = el("button", "n1chat-close", "close", { type: "button", "aria-label": "Close" });
  head.append(el("strong", null, "ask neon1"), close);

  const log = el("div", "n1chat-log", null, { role: "log", "aria-live": "polite" });
  const hello = el("p", "n1chat-msg n1chat-bot");
  render(hello, "Hi. Ask about services, process, case studies, projects, or 1NEON. For anything else, email hello@neon1.tech.");
  log.append(hello);

  const form = el("form", "n1chat-form");
  const input = el("textarea", "n1chat-input", null, { rows: "2", maxlength: String(MAX_CHARS), "aria-label": "Your question", placeholder: "Your question" });
  const send = el("button", "n1chat-send", "send", { type: "submit" });
  form.append(input, send);

  const note = el("p", "n1chat-note", "Automated answers from neon1.tech, which can be wrong. Please don't share personal details.");

  panel.append(head, log, form, note);
  root.append(launcher, panel);

  // ---- Open, close, and keep focus sensible ----
  function open(show) {
    panel.hidden = !show;
    launcher.setAttribute("aria-expanded", String(show));
    launcher.classList.toggle("n1chat-hidden", show);
    (show ? input : launcher).focus();
  }
  launcher.addEventListener("click", () => open(true));
  close.addEventListener("click", () => open(false));
  panel.addEventListener("keydown", (e) => e.key === "Escape" && open(false));

  // Enter sends, Shift+Enter adds a line
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  function say(text, who) {
    const p = el("p", `n1chat-msg n1chat-${who}`);
    render(p, text);
    log.append(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  // ---- Ask: the recent turns go up, one reply comes back ----
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q || send.disabled) return;

    input.value = "";
    say(q, "you");
    history.push({ role: "user", content: q.slice(0, MAX_CHARS) });
    while (history.length > MAX_TURNS) history.splice(0, 2);

    send.disabled = true;
    const wait = say("thinking...", "bot");
    wait.classList.add("n1chat-wait");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json().catch(() => ({}));
      const text = data.reply ?? data.error ?? "The assistant couldn't answer just now. Please email hello@neon1.tech.";

      wait.remove();
      say(text, "bot");

      // Only real answers join the history; a failed turn is dropped so the next one is valid
      if (res.ok && data.reply) history.push({ role: "assistant", content: data.reply });
      else history.pop();
    } catch {
      wait.remove();
      say("No connection right now. Please try again, or email hello@neon1.tech.", "bot");
      history.pop();
    } finally {
      send.disabled = false;
      input.focus();
    }
  });

  return { open: () => open(true), close: () => open(false) };
}
