#!/usr/bin/env python3

# scripts/check_page.py - Static checks for a page that html-validate can't do.
# Usage: python3 scripts/check_page.py links src/app/public/index.html
#
# links: every in-page anchor has a target, and every asset the page reaches exists: the root-relative
#   paths in its HTML, then, file by file, the url()s and @imports in its stylesheets and the site paths
#   and imports in its first-party scripts. A path built at run time (a template literal) must be
#   registered in scripts/assets.json, which says what it expands to, and each expansion must exist.
# scripts: inline scripts parse with node --check and JSON-LD parses as JSON.

import json
import os
import re
import struct
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit


# Paths served by other apps on the same domain, so not files in this site
OTHER_APPS = ("/1NEON/",)

# Files the deploy job writes beside the pages, so a fresh checkout doesn't have them yet
BUILT_AT_DEPLOY = re.compile(r"^/knowledge/.+\.pdf$")


def site_root(path):
    """The site folder: the page's own folder, or the nearest one above it that holds index.html and
    shared/, so a page in a subfolder such as /knowledge/ resolves root-relative paths from the site root."""
    d = os.path.dirname(os.path.abspath(path))
    while True:
        if os.path.isfile(os.path.join(d, "index.html")) and os.path.isdir(os.path.join(d, "shared")):
            return d
        up = os.path.dirname(d)
        if up == d:
            return os.path.dirname(os.path.abspath(path))
        d = up


def local_file(root, ref):
    """The file a site path names; a folder path names its index.html."""
    local = unquote(urlsplit(ref).path).lstrip("/")
    if local.endswith("/") or local == "":
        local += "index.html"
    return os.path.join(root, local)


# Script types node can check, attributes that hold URLs, and root-relative url() in CSS
JS_TYPES = {"", "text/javascript", "application/javascript", "module"}
REF_ATTRS = {"href", "src", "poster", "data"}
CSS_URL = re.compile(r"url\(\s*['\"]?(/[^'\")]+)")

# ---- The asset graph below the page ----
# In stylesheets: any url() (root-relative or relative to the sheet) and @import
SHEET_URL = re.compile(r"url\(\s*['\"]?([^'\")\s]+)")
SHEET_IMPORT = re.compile(r"@import\s+['\"]([^'\"]+)['\"]")
# In scripts: quoted paths under the site's own folders, and relative import specifiers
SITE_DIRS = ("/js/", "/css/", "/shared/", "/fonts/", "/media/")
SCRIPT_PATH = re.compile(r"([\"'`])(/(?:js|css|shared|fonts|media)/[^\"'`\s]*)\1")
SCRIPT_IMPORT = re.compile(r"(?:\bfrom|\bimport)\s*\(?\s*([\"'])(\.{1,2}/[^\"']+)\1")
# Generated bundles are checked for existence, not read: their strings aren't this site's paths
VENDORED = ("/js/vendor/",)
MINIFIED = ".min.js"
# Dynamic paths and what they expand to (see the file itself); the self-test points this at its own fixture
REGISTRY = os.environ.get("CHECK_PAGE_ASSETS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets.json")


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
    root = site_root(path)
    problems = []
    for line, target in page.anchors:
        if target not in page.ids:
            problems.append(f"{path}:{line}: no element with id '{target}'")
    for line, ref in page.refs:
        if ref.startswith(OTHER_APPS):
            continue
        if BUILT_AT_DEPLOY.match(unquote(urlsplit(ref).path)):
            continue
        if not os.path.isfile(local_file(root, ref)):
            problems.append(f"{path}:{line}: missing file {ref}")
    return problems


def strip_comments(text, kind):
    """Drop comments, so a path named only in prose isn't taken for a reference."""
    text = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    if kind == "js":
        text = re.sub(r"(^|\s)//[^\n]*", r"\1", text)
    return text


def glb_nodes(file):
    """The node names in a binary glTF file's JSON chunk."""
    with open(file, "rb") as f:
        data = f.read()
    length = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + length])
    return [n["name"] for n in doc.get("nodes", []) if n.get("name")]


def expand(entry, root, source_text):
    """The files a registered template stands for, from its listed names, the first string argument
    of the named calls in the file that uses it, or the node names in a model."""
    names = list(entry.get("names", []))
    for call in entry.get("from_calls", []):
        names += re.findall(rf"\b{re.escape(call)}\(\s*[\"']([^\"']+)[\"']", source_text)
    if entry.get("from_glb_nodes"):
        names += glb_nodes(os.path.join(root, entry["from_glb_nodes"].lstrip("/")))
    # The path ends at the first placeholder's closing brace plus the literal text after it, minus any query
    head, _, rest = entry["template"].partition("${")
    tail = rest.split("}", 1)[1].split("?")[0]
    return sorted({head + n + tail for n in names})


def check_graph(path, page):
    """Return assets missing anywhere below the page, following its stylesheets and scripts."""
    root = site_root(path)
    with open(REGISTRY, encoding="utf-8") as f:
        registry = {e["template"]: e for e in json.load(f)["dynamic"]}
    problems, seen, used = [], set(), set()
    todo = [unquote(urlsplit(ref).path) for _, ref in page.refs if not ref.startswith(OTHER_APPS)]

    def need(ref, origin, line):
        local = unquote(urlsplit(ref).path)
        if not local or local.endswith("/") or BUILT_AT_DEPLOY.match(local):
            return  # a folder prefix, such as the media URL rewrite in the scene, or a PDF the deploy prints
        if not os.path.isfile(os.path.join(root, local.lstrip("/"))):
            problems.append(f"{origin}:{line}: missing file {ref}")
        else:
            todo.append(local)

    while todo:
        web = todo.pop()
        if web in seen:
            continue
        seen.add(web)
        file = os.path.join(root, web.lstrip("/"))
        if not os.path.isfile(file) or web.startswith(VENDORED) or web.endswith(MINIFIED):
            continue
        rel = os.path.relpath(file)
        base = os.path.dirname(web)
        if web.endswith(".css"):
            with open(file, encoding="utf-8") as f:
                text = strip_comments(f.read(), "css")
            for m in list(SHEET_URL.finditer(text)) + list(SHEET_IMPORT.finditer(text)):
                ref = m.group(1)
                if ref.startswith(("data:", "http:", "https:", "#", "//")):
                    continue
                need(ref if ref.startswith("/") else os.path.normpath(os.path.join(base, ref)), rel, text.count("\n", 0, m.start()) + 1)
        elif web.endswith((".js", ".mjs")):
            with open(file, encoding="utf-8") as f:
                text = strip_comments(f.read(), "js")
            for m in SCRIPT_PATH.finditer(text):
                ref, line = m.group(2), text.count("\n", 0, m.start()) + 1
                if "${" in ref:
                    entry = registry.get(ref)
                    if not entry:
                        problems.append(f"{rel}:{line}: {ref} is built at run time; register what it expands to in scripts/assets.json")
                        continue
                    used.add(ref)
                    files = expand(entry, root, text)
                    if not files:
                        problems.append(f"{rel}:{line}: {ref} expands to nothing; check scripts/assets.json")
                    for item in files:
                        need(item, rel, line)
                else:
                    need(ref, rel, line)
            for m in SCRIPT_IMPORT.finditer(text):
                need(os.path.normpath(os.path.join(base, m.group(2))), rel, text.count("\n", 0, m.start()) + 1)
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
    problems = check_links(path, page) + check_graph(path, page) if check == "links" else check_scripts(path, page)
    for problem in problems:
        print(problem, file=sys.stderr)
    if problems:
        sys.exit(1)
    print(f"{path}: {check} ok")


if __name__ == "__main__":
    main()
