#!/usr/bin/env python3

# scripts/release.py - Fails if the places that name the release disagree.
# Usage: python3 scripts/release.py src/app/public CHANGELOG.md
#
# The release is named in several hand-edited places: the version meta on every page (make verify
# and the white rabbit's media loader read it), the footer's link text, and the CHANGELOG's top entry.
# A literal ?v=X.Y.Z written into a page, stylesheet, or script must name it too; the scene's loader
# reads the meta at run time instead, so it has no copy to drift.

import pathlib
import re
import sys

META = re.compile(r'<meta name="version" content="([^"]*)"')
FOOTER = re.compile(r"<!-- frame:footer -->.*?>v(\d+\.\d+\.\d+)</a>.*?<!-- /frame:footer -->", re.S)
TOP_ENTRY = re.compile(r"^## v(\S+)\s*$", re.M)
LITERAL_V = re.compile(r"[?&]v=(\d+\.\d+\.\d+)")
SOURCES = ("*.html", "css/*.css", "js/*.js", "shared/*.js", "shared/*.css")


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: release.py SITE_DIR CHANGELOG")
    root, changelog = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])

    # Every place that names a release, as (where, version)
    found = []
    for page in sorted(root.glob("*.html")):
        metas = META.findall(page.read_text())
        if len(metas) != 1:
            sys.exit(f"release: {page.name} has {len(metas)} version metas, expected 1")
        found.append((f"{page.name} meta", metas[0]))
    footer = FOOTER.search((root / "index.html").read_text())
    if not footer:
        sys.exit("release: index.html's footer block has no vX.Y.Z link")
    found.append(("index.html footer", footer.group(1)))
    top = TOP_ENTRY.search(changelog.read_text())
    if not top:
        sys.exit(f"release: {changelog.name} has no '## vX.Y.Z' entry")
    found.append((f"{changelog.name} top entry", top.group(1)))
    for pattern in SOURCES:
        for f in sorted(root.glob(pattern)):
            for v in LITERAL_V.findall(f.read_text()):
                found.append((f"{f.relative_to(root)} ?v=", v))

    # One version everywhere, or a list of who says what
    versions = {v for _, v in found}
    if len(versions) != 1:
        sys.exit("release: the release identifiers disagree\n" + "\n".join(f"  {v:<10} {where}" for where, v in found))
    print(f"release: {len(found)} places all name v{versions.pop()}")


if __name__ == "__main__":
    main()
