#!/usr/bin/env python3

# scripts/dev_pdfs.py - Fill a dev build's knowledge center PDFs from neon1.tech instead of printing them.
# Usage: python3 scripts/dev_pdfs.py SITE_DIR   (make dev-pdfs)
#
# Printing takes a browser and most of a minute; dev.neon1.tech only needs the links to work. Each PDF a
# built page links to is copied from the live site. One that isn't live yet (a new document) is left out
# and listed; make dev-push PDF=1 prints them all instead.

import concurrent.futures
import os
import re
import sys
import urllib.error
import urllib.request

LIVE = "https://neon1.tech"
LINK = re.compile(r'href="(/knowledge/[^"#?]+\.pdf)"')


def linked_pdfs(root):
    """Every /knowledge/...pdf path a built knowledge page links to."""
    found = set()
    for folder, _, names in os.walk(os.path.join(root, "knowledge")):
        for name in names:
            if name.endswith(".html"):
                with open(os.path.join(folder, name), encoding="utf-8") as f:
                    found.update(LINK.findall(f.read()))
    return sorted(found)


def fetch(root, path):
    """Copy one PDF from the live site; return the path when it isn't there."""
    out = os.path.join(root, path.lstrip("/"))
    if os.path.exists(out):
        return None
    try:
        with urllib.request.urlopen(LIVE + path, timeout=20) as r:
            body = r.read()
    except urllib.error.URLError:
        return path
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "wb") as f:
        f.write(body)
    return None


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: dev_pdfs.py SITE_DIR")
    root = sys.argv[1]
    paths = linked_pdfs(root)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        missing = [p for p in pool.map(lambda p: fetch(root, p), paths) if p]
    print(f"dev-pdfs: {len(paths) - len(missing)} of {len(paths)} PDF(s) copied from {LIVE}")
    for p in missing:
        print(f"dev-pdfs: not live yet, left out: {p}")


if __name__ == "__main__":
    main()
