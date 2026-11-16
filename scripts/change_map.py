#!/usr/bin/env python3

# scripts/change_map.py - Decide which checks a push needs, from the files it changed (deploy.yml, changes job).
# Usage: python3 scripts/change_map.py BEFORE_SHA [AFTER_SHA]   (prints key=value lines for $GITHUB_OUTPUT)
#
# Only the browser checks, the chat checks, and the Knowledge Center PDF printing are decided here; the static
# checks (make check) always run. The map is deliberately small and sure: a file that isn't named below, no
# diff to read (schedule, manual run, a new branch, a commit git can't find), or any error means everything
# runs. A change that touches the shared parts (css, scripts, templates, version, corpus) runs everything too.
#
# Outputs: full (everything runs), behavior (any browser checks), only (a regex of check names when only some run),
# shards (the matrix for the browser job), chat, pdf (print the PDFs; otherwise the live ones are reused), reason.

import json
import re
import subprocess
import sys

# Files that change nothing a visitor sees or a check reads
DOCS = re.compile(r"^(README\.md|CHANGELOG\.md|LICENSE.*|\.gitignore|docs/.*|.*\.md)$")
# The Knowledge Center and blog: generated pages, their styles and scripts. No home-page browser check reads them;
# their PDFs are printed from them
KC = re.compile(r"^(src/app/public/(knowledge|blog)/.*|src/app/public/css/knowledge\.css|src/app/public/js/(knowledge[\w-]*|blog-share)\.js"
                r"|scripts/(knowledge[\w-]*\.(mjs|test\.mjs)|blog\.mjs|page-shell\.mjs|releases[\w-]*\.(mjs|sh)|dev_pdfs\.py)|knowledge/.*)$")
# The white rabbit: its scene, models, and lifetime checks
RABBIT = re.compile(r"^(src/app/public/js/white-rabbit[\w-]*\.js|scripts/three/.*|scripts/rabbit_lifecycle\.cjs|scripts/perf[\w.-]*|src/app/public/media/.*\.glb)$")
# The contact form and its scripts
CONTACT = re.compile(r"^(src/app/public/js/contact\.js|src/app/public/shared/mail/.*)$")
# Case studies
CASES = re.compile(r"^src/app/public/js/cases\.js$")
# The chat window, which has its own checks
CHAT = re.compile(r"^(src/app/public/shared/chat\.(js|css)|scripts/chat_check\.cjs)$")

# What each group runs: a regex over behavior.cjs check names (scripts/behavior.cjs), or None for none
ONLY = {
    "rabbit": "rabbit",
    "contact": "contact|AS-03|AS-09",
    "cases": "case",
}


def changed(before, after):
    """The files changed between two commits, or None when that can't be known."""
    if not before or set(before) == {"0"}:
        return None
    try:
        out = subprocess.run(["git", "diff", "--name-only", f"{before}..{after}"], check=True, capture_output=True, text=True).stdout
    except (subprocess.CalledProcessError, OSError):
        return None
    files = [f for f in out.splitlines() if f]
    return files or None


def decide(files):
    """The checks these files need. Anything unnamed, or no list at all, needs everything."""
    full = {"full": True, "behavior": True, "only": "", "shards": [0, 1, 2], "chat": True, "pdf": True}
    if not files:
        return {**full, "reason": "no list of changed files; everything runs"}
    groups, chat, pdf = set(), False, False
    for f in files:
        if DOCS.match(f):
            continue
        if KC.match(f):
            pdf = True
        elif RABBIT.match(f):
            groups.add("rabbit")
        elif CONTACT.match(f):
            groups.add("contact")
        elif CASES.match(f):
            groups.add("cases")
        elif CHAT.match(f):
            chat = True
        else:
            return {**full, "reason": f"{f} is shared or unmapped; everything runs"}
    only = "|".join(ONLY[g] for g in sorted(groups))
    return {
        "full": False, "behavior": bool(only), "only": only, "shards": [0], "chat": chat, "pdf": pdf,
        "reason": f"docs, {', '.join(sorted(groups)) or 'no browser group'}{', chat' if chat else ''}{', Knowledge Center' if pdf else ''}",
    }


def main():
    before = sys.argv[1] if len(sys.argv) > 1 else ""
    after = sys.argv[2] if len(sys.argv) > 2 else "HEAD"
    try:
        result = decide(changed(before, after))
    except Exception as e:  # never leave a check off because the map failed
        result = decide(None)
        result["reason"] = f"change map failed ({e}); everything runs"
    for key, value in result.items():
        print(f"{key}={json.dumps(value) if isinstance(value, list) else str(value).lower() if isinstance(value, bool) else value}")


if __name__ == "__main__":
    main()
