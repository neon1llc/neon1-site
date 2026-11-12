#!/usr/bin/env python3

# scripts/static_check.py - Fails if corpus words would reach a reader any way but as static HTML.
# Usage: python3 scripts/static_check.py src/app/public   (make static, part of make check)
#
# Corpus releases publish on their own (README, Publishing a corpus release), and the promise that makes that
# safe is that every word is written into the HTML at build time: search engines, link previews, and readers
# without JavaScript get whole pages, and the CSP never needs an outside origin. This guards both halves:
# no page script may name a place corpus content lives, and every built Knowledge Center and blog page must
# carry its own heading and text in the HTML.

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
        main_ = MAIN.search(html)
        text = re.sub(r"\s+", " ", TAGS.sub(" ", main_.group(0))).strip() if main_ else ""
        if not H1.search(html):
            problems.append(f"{page.relative_to(root)} has no <h1>")
        if len(text) < MIN_TEXT:
            problems.append(f"{page.relative_to(root)} has {len(text)} characters of text in <main>, under {MIN_TEXT}")

    if problems:
        sys.exit("static: " + "\nstatic: ".join(problems))
    print(f"static: {len(pages)} built pages carry their own text, and no page script reads corpus sources")


if __name__ == "__main__":
    main()
