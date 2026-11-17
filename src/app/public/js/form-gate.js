// src/app/public/js/form-gate.js - The bot gate on the report and feedback forms. The site's strict policy lets a
// page load nothing from outside neon1.tech, so there is no hosted check; instead the page asks 1NEON for a one-time
// challenge when it opens and solves a small proof of work in the background (a fraction of a second), and the form
// sends the answer along. The answer is held back until a person-speed delay has passed, since the server refuses
// one that comes sooner. Each answer is used once; a fresh challenge starts as the last is taken.

/** Starts getting an answer for one form ("bug" or "feedback"); `take()` resolves to {id, nonce}, or undefined when
 * the challenge couldn't be had (the server then refuses the send, and the form says so as for any failed send) */
export function startGate(form) {
  let pending;
  const start = async () => {
    try {
      const r = await fetch(`/1NEON/api/form-gate/${form}`, { credentials: "same-origin" });
      if (!r.ok) return undefined;
      const { id, bits, minMs } = await r.json();
      const born = Date.now();
      const enc = new TextEncoder();
      for (let n = 0; ; n++) {
        const nonce = n.toString(36);
        const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`${id}:${form}:${nonce}`)));
        let zeros = 0;
        for (const b of h) { if (b === 0) { zeros += 8; continue; } zeros += Math.clz32(b) - 24; break; }
        if (zeros >= bits) {
          const wait = born + minMs + 250 - Date.now();
          if (wait > 0) await new Promise((res) => setTimeout(res, wait));
          return { id, nonce };
        }
      }
    } catch {
      return undefined;
    }
  };
  pending = start();
  return {
    async take() {
      const answer = await pending;
      // The next one starts now, so a second try (after a refusal) has its answer ready
      pending = start();
      return answer;
    },
  };
}
