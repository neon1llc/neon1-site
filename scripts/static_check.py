#!/usr/bin/env python3

# scripts/static_check.py - Fails if corpus words would reach a reader any way but as static HTML.
# Usage: python3 scripts/static_check.py src/app/public   (make static, part of make check)
#
# Corpus releases publish on their own (README, Publishing a corpus release), and the promise that makes that
# safe is that every word is written into the HTML at build time: search engines, link previews, and readers
# without JavaScript get whole pages, and the CSP never needs an outside origin. This guards both halves:
# no page script may name a place corpus content lives, and every built Knowledge Center and blog page must
# carry its own heading and text in the HTML.

import json
import pathlib
import re
import sys

# Places corpus content lives outside this site's own build. A script naming one would be fetching at run time
FORBIDDEN = re.compile(r"neon1-corpus|raw\.githubusercontent\.com|api\.github\.com|/knowledge/corpus\.json|\.bundle\.json")
SCRIPTS = ("js/*.js", "shared/*.js")

# A built page holds one H1 and a body of real text, not an empty shell for a script to fill
H1 = re.compile(r"<h1[\s>]")
MAIN = re.compile(r"<main[\s>].*?</main>", re.S)
TAGS = re.compile(r"<script[\s>].*?</script>|<[^>]+>", re.S)
MIN_TEXT = 200

# An outbound link (a.ext) that leaves for another site or for the 1NEON app opens in a new tab; mailto: and tel: links open the
# reader's own app in place, so they are left out
EXT_LINK = re.compile(r'<a\b[^>]*\bclass="[^"]*\bext\b[^"]*"[^>]*>')
LEAVES = re.compile(r'href="(?:https?:|/1NEON)')
JSON_LD = re.compile(r'<script\s+type=["\']application/ld\+json["\'][^>]*>(.*?)</script\s*>', re.I | re.S)
MOVED = '<title>Moved · neon1</title>'


def check_json_ld(page, html, problems):
    """Check built structured data before a deploy can publish it."""
    scripts = JSON_LD.findall(html)
    moved = 'http-equiv="refresh"' in html and MOVED in html
    generated = page.parts[0] in ("knowledge", "blog") and not moved
    if generated and not scripts:
        problems.append(f"{page}: generated content page has no JSON-LD")
        return 0

    for n, script in enumerate(scripts, 1):
        try:
            data = json.loads(script)
        except json.JSONDecodeError as error:
            problems.append(f"{page}: JSON-LD block {n} is invalid JSON ({error.msg})")
            continue
        if not isinstance(data, dict) or data.get("@context") != "https://schema.org":
            problems.append(f"{page}: JSON-LD block {n} must use the schema.org context")
            continue
        graph = data.get("@graph")
        if not isinstance(graph, list) or not graph:
            problems.append(f"{page}: JSON-LD block {n} must contain a non-empty @graph")
            continue
        if any(not isinstance(item, dict) or not item.get("@type") for item in graph):
            problems.append(f"{page}: JSON-LD block {n} has a graph item without @type")
    return len(scripts)


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: static_check.py SITE_DIR")
    root = pathlib.Path(sys.argv[1])
    problems = []

    # Page scripts: no reference to corpus sources (vendored libraries are third-party and left out)
    for pattern in SCRIPTS:
        for f in sorted(root.glob(pattern)):
            for n, line in enumerate(f.read_text().splitlines(), 1):
                if FORBIDDEN.search(line):
                    problems.append(f"{f.relative_to(root)}:{n} names a corpus source; corpus words must be built into the HTML")

    # Built pages: each must exist and carry its heading and text
    pages = sorted((root / "knowledge").rglob("index.html")) + sorted((root / "blog").rglob("index.html"))
    if not pages:
        problems.append("no Knowledge Center or blog pages; run make content first")
    for page in pages:
        html = page.read_text()
        # A retired page's small "moved" stub (scripts/knowledge.mjs RETIRED) only forwards, so it carries no text
        if 'http-equiv="refresh"' in html and "<title>Moved · neon1</title>" in html:
            continue
        main_ = MAIN.search(html)
        text = re.sub(r"\s+", " ", TAGS.sub(" ", main_.group(0))).strip() if main_ else ""
        if not H1.search(html):
            problems.append(f"{page.relative_to(root)} has no <h1>")
        if len(text) < MIN_TEXT:
            problems.append(f"{page.relative_to(root)} has {len(text)} characters of text in <main>, under {MIN_TEXT}")

    # Metadata and outbound links on every page, including generated corpus output
    metadata_pages = sorted(root.rglob("*.html"))
    json_ld_pages = 0
    for page in metadata_pages:
        html = page.read_text()
        json_ld_pages += check_json_ld(page.relative_to(root), html, problems)
        for m in EXT_LINK.finditer(html):
            if LEAVES.search(m.group(0)) and 'target="_blank"' not in m.group(0):
                problems.append(f"{page.relative_to(root)}: an outbound link lacks target=\"_blank\": {m.group(0)[:100]}")

    if problems:
        sys.exit("static: " + "\nstatic: ".join(problems))
    print(f"static: {len(pages)} built pages carry their own text; {json_ld_pages} JSON-LD blocks are valid; no page script reads corpus sources")


if __name__ == "__main__":
    main()
