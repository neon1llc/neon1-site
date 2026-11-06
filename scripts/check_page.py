#!/usr/bin/env python3

# scripts/check_page.py - Static checks for a page that html-validate can't do.
# Usage: python3 scripts/check_page.py links src/app/public/index.html
#
# links: every in-page anchor has a target and every root-relative asset exists.
# scripts: inline scripts parse with node --check and JSON-LD parses as JSON.

import json
import os
import re
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit


# Paths served by other apps on the same domain, so not files in this site
OTHER_APPS = ("/1NEON/",)

# Script types node can check, attributes that hold URLs, and root-relative url() in CSS
JS_TYPES = {"", "text/javascript", "application/javascript", "module"}
REF_ATTRS = {"href", "src", "poster", "data"}
CSS_URL = re.compile(r"url\(\s*['\"]?(/[^'\")]+)")


class Page(HTMLParser):
    """Collects ids, references and inline scripts in one pass."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.anchors = []
        self.refs = []
        self.scripts = []
        self._script = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        line = self.getpos()[0]

        # Anchors can target an id or a named link
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "a" and attrs.get("name"):
            self.ids.add(attrs["name"])

        # In-page anchors and root-relative paths are checked later
        for name in REF_ATTRS:
            value = attrs.get(name) or ""
            if value.startswith("#") and len(value) > 1:
                self.anchors.append((line, unquote(value[1:])))
            elif value.startswith("/") and not value.startswith("//"):
                self.refs.append((line, value))

        # srcset holds comma-separated "url size" pairs
        for part in (attrs.get("srcset") or "").split(","):
            url = part.strip().split(" ")[0]
            if url.startswith("/") and not url.startswith("//"):
                self.refs.append((line, url))

        # Inline scripts collect their text until the closing tag
        if tag == "script" and not attrs.get("src"):
            kind = (attrs.get("type") or "").lower()
            self._script = [line, kind, []]

    def handle_data(self, data):
        if self._script is not None:
            self._script[2].append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self._script is not None:
            line, kind, parts = self._script
            self.scripts.append((line, kind, "".join(parts)))
            self._script = None


def parse(path):
    """Parse the page and add url() references from inline CSS."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    page = Page()
    page.feed(text)
    for match in CSS_URL.finditer(text):
        line = text.count("\n", 0, match.start()) + 1
        page.refs.append((line, match.group(1)))
    return page


def check_links(path, page):
    """Return problems with anchors and root-relative assets."""
    root = os.path.dirname(os.path.abspath(path))
    problems = []
    for line, target in page.anchors:
        if target not in page.ids:
            problems.append(f"{path}:{line}: no element with id '{target}'")
    for line, ref in page.refs:
        if ref.startswith(OTHER_APPS):
            continue
        local = unquote(urlsplit(ref).path).lstrip("/")
        if local and not os.path.isfile(os.path.join(root, local)):
            problems.append(f"{path}:{line}: missing file {ref}")
    return problems


def check_scripts(path, page):
    """Return syntax errors in inline JavaScript and JSON-LD."""
    problems = []
    with tempfile.TemporaryDirectory() as tmp:
        for line, kind, body in page.scripts:
            if kind == "application/ld+json":
                try:
                    json.loads(body)
                except ValueError as e:
                    problems.append(f"{path}:{line}: invalid JSON-LD: {e}")
                continue
            if kind not in JS_TYPES or not body.strip():
                continue

            # Node picks the module parser from the .mjs extension
            ext = ".mjs" if kind == "module" else ".js"
            file = os.path.join(tmp, f"line{line}{ext}")
            with open(file, "w", encoding="utf-8") as f:
                f.write(body)
            result = subprocess.run(
                ["node", "--check", file],
                capture_output=True,
                text=True,
            )
            if result.returncode:
                errors = [s for s in result.stderr.splitlines() if "Error" in s]
                detail = errors[0] if errors else "syntax error"
                problems.append(f"{path}:{line}: inline script: {detail}")
    return problems


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("links", "scripts"):
        sys.exit("Usage: check_page.py links|scripts FILE")
    check, path = sys.argv[1], sys.argv[2]
    page = parse(path)
    problems = check_links(path, page) if check == "links" else check_scripts(path, page)
    for problem in problems:
        print(problem, file=sys.stderr)
    if problems:
        sys.exit(1)
    print(f"{path}: {check} ok")


if __name__ == "__main__":
    main()
