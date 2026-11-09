#!/usr/bin/env python3

# scripts/test_check_page.py - Proves the links check fails when it should, on a tiny site built in a temp folder.
# Usage: python3 scripts/test_check_page.py   (part of make logic)
#
# Each case starts from one good site, breaks one thing, and expects check_page links to name it.
# The good site has to pass first, or every failure below would prove nothing.

import json
import os
import subprocess
import sys
import tempfile

CHECK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "check_page.py")

# ---- The good site: a page, a stylesheet with an image and an import, a module with a static import
# and one registered run-time path ----
GOOD = {
    "index.html": '<!doctype html><html><head><link rel="stylesheet" href="/css/site.css"></head>'
                  '<body><a href="#top" id="top">top</a><script type="module" src="/js/main.js"></script></body></html>',
    "css/site.css": '@import "parts.css";\nbody { background: url("/media/bg.webp"); }\n',
    "css/parts.css": ".x { background: url(../media/tile.webp); }\n",
    "media/bg.webp": "",
    "media/tile.webp": "",
    "media/tex/grass.webp": "",
    "js/main.js": 'import "./helper.js";\nconst tex = (name) => `/media/tex/${name}.webp`;\ntile("grass");\n',
    "js/helper.js": "// /media/only-in-a-comment.webp is prose, not a reference\nexport const x = 1;\n",
}
REGISTRY = {"dynamic": [{"template": "/media/tex/${name}.webp", "from_calls": ["tile"]}]}

# ---- One break per case, and the text the check must print for it ----
CASES = [
    ("good site passes", {}, None),
    ("missing image in a stylesheet", {"media/bg.webp": None}, "missing file /media/bg.webp"),
    ("missing image in an imported sheet", {"media/tile.webp": None}, "missing file /media/tile.webp"),
    ("missing static import", {"js/helper.js": None}, "missing file /js/helper.js"),
    ("missing registered texture", {"media/tex/grass.webp": None}, "missing file /media/tex/grass.webp"),
    ("unregistered run-time path", {"js/main.js": 'const p = (n) => `/media/sky/${n}.webp`;\n'}, "register what it expands to"),
]


def build(folder, changes):
    """Write the good site with this case's changes: None deletes a file, text replaces it."""
    files = {**GOOD, **changes}
    for name, text in files.items():
        if text is None:
            continue
        path = os.path.join(folder, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
    registry = os.path.join(folder, "assets.json")
    with open(registry, "w", encoding="utf-8") as f:
        json.dump(REGISTRY, f)
    return registry


def main():
    failed = 0
    for name, changes, expect in CASES:
        with tempfile.TemporaryDirectory() as folder:
            registry = build(folder, changes)
            run = subprocess.run([sys.executable, CHECK, "links", os.path.join(folder, "index.html")],
                                 capture_output=True, text=True, env={**os.environ, "CHECK_PAGE_ASSETS": registry})
            ok = run.returncode == 0 if expect is None else (run.returncode != 0 and expect in run.stderr)
            failed += not ok
            print(f"{'ok  ' if ok else 'FAIL'} [links] {name}" + ("" if ok else f" {run.stderr.strip()!r}"))
    print(f"test_check_page: {failed} failed" if failed else "test_check_page: all checks passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
