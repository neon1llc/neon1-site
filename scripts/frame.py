#!/usr/bin/env python3

# scripts/frame.py - Keeps the shared bar and footer markup the same on every page.
# Usage: python3 scripts/frame.py sync|check src/app/public
#
# The home page (index.html) is the one source. Each block it marks with
# <!-- frame:NAME --> ... <!-- /frame:NAME --> is copied, as is, into every other page that
# loads /css/frame.css. sync writes the copies; check fails if any page has drifted or lacks
# a block, so an edit made on another page is caught instead of silently overwritten.

import pathlib
import re
import sys


# A marked block, with its name and everything between the markers
BLOCK = re.compile(r"<!-- frame:([\w-]+) -->(.*?)<!-- /frame:\1 -->", re.S)
SOURCE = "index.html"
USES_FRAME = 'href="/css/frame.css"'


def blocks(text):
    """The marked blocks in a page, by name."""
    return {m.group(1): m.group(2) for m in BLOCK.finditer(text)}


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("sync", "check"):
        sys.exit("usage: frame.py sync|check SITE_DIR")
    mode, root = sys.argv[1], pathlib.Path(sys.argv[2])
    source = blocks((root / SOURCE).read_text())
    if not source:
        sys.exit(f"frame: {SOURCE} marks no blocks")

    # Every other page on the shared frame gets every block
    problems = []
    for page in sorted(root.glob("*.html")):
        if page.name == SOURCE or USES_FRAME not in (text := page.read_text()):
            continue
        have = blocks(text)
        for name, body in source.items():
            if name not in have:
                problems.append(f"{page.name}: missing block {name}")
            elif have[name] != body:
                problems.append(f"{page.name}: block {name} differs from {SOURCE}")
        if mode == "sync":
            new = BLOCK.sub(lambda m: f"<!-- frame:{m.group(1)} -->{source.get(m.group(1), m.group(2))}<!-- /frame:{m.group(1)} -->", text)
            if new != text:
                page.write_text(new)
                print(f"frame: updated {page.name}")

    # Sync can fill in changed blocks but not place a missing one
    missing = [p for p in problems if "missing" in p]
    if mode == "check" and problems or missing:
        sys.exit("\n".join(problems if mode == "check" else missing) + "\nframe: run make frame, or add the missing markers")
    if mode == "check":
        print("frame: every page matches index.html")


if __name__ == "__main__":
    main()
