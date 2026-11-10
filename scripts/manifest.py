#!/usr/bin/env python3

# scripts/manifest.py - Keeps src/app/asset-manifest.json true to the files it lists.
# Usage: python3 scripts/manifest.py check|update src/app/public src/app/asset-manifest.json
#
# Fonts and media are served with a year-long immutable cache, so a path must always mean the same
# bytes: a browser that cached it never asks again, and a page left open from an older release
# may still ask for it after a deploy.
# check fails if
#   - a file under fonts/ or media/, or a vendored bundle, is missing from the manifest, or its sha256 differs;
#   - a file names no asset, or an asset lacks what it is, how it was made, or a consumer that exists;
#   - a third-party asset names no source, or a source lacks its author, license, or source_url;
#   - an unresolved item names no asset or source, or says nothing about what is missing, or an asset of
#     unrecorded origin has no unresolved item tracking it;
#   - a font or media path that exists in the base commit now holds different bytes. The base is
#     $IMMUTABLE_BASE if set, else origin/main (HEAD^ when that is HEAD itself, as on a push to main).
#     Without git history the comparison is skipped and says so.
# update rewrites the sha256 of every listed or new file; it never makes a changed path pass.

import hashlib
import json
import os
import pathlib
import subprocess
import sys

# Folders deployed with the immutable cache (Makefile LONG_CACHE), and vendored code that must be listed too
IMMUTABLE = ("fonts/", "media/")
VENDORED = ("js/vendor/*", "js/*.min.js")
ORIGINS = ("first-party", "third-party", "unrecorded")
SOURCE_FIELDS = ("title", "author", "source_url", "exactness", "license")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def immutable_files(root):
    """Site-relative paths of every deployed file under the immutable folders, skipping dotfiles like the sync."""
    out = []
    for top in IMMUTABLE:
        for p in sorted((root / top).rglob("*")):
            rel = p.relative_to(root).as_posix()
            if p.is_file() and not any(part.startswith(".") for part in rel.split("/")):
                out.append(rel)
    return out


def vendored_files(root):
    return sorted({p.relative_to(root).as_posix() for g in VENDORED for p in root.glob(g) if p.is_file()})


def provenance(root, manifest):
    """Problems with the asset and source records: every file has an asset, every third-party asset a full source."""
    files, assets, sources = manifest.get("files", {}), manifest.get("assets", {}), manifest.get("sources", {})
    problems = []
    for rel, entry in files.items():
        if entry.get("asset") not in assets:
            problems.append(f"{rel}: names no asset in the manifest's assets (got {entry.get('asset')!r})")
    for name, a in assets.items():
        where = f"asset {name}"
        if not a.get("title") or not a.get("made"):
            problems.append(f"{where}: needs a title and how it was made (made)")
        if a.get("origin") not in ORIGINS:
            problems.append(f"{where}: origin must be one of {', '.join(ORIGINS)}")
        if a.get("origin") == "third-party" and not a.get("sources"):
            problems.append(f"{where}: third-party, but names no sources")
        for src in a.get("sources", []):
            if src not in sources:
                problems.append(f"{where}: unknown source {src!r}")
        for c in a.get("consumers", []):
            if not (root / c).is_file():
                problems.append(f"{where}: consumer {c} is not a file in the site")
        if not any(e.get("asset") == name for e in files.values()):
            problems.append(f"{where}: no file belongs to it")
    for name, src in sources.items():
        missing = [f for f in SOURCE_FIELDS if not src.get(f)]
        if missing:
            problems.append(f"source {name}: missing {', '.join(missing)}")
        if not src.get("license_url") and not (src.get("license_file") and (root / src["license_file"]).is_file()):
            problems.append(f"source {name}: needs a license_url or a license_file that ships with the site")
        if not any(name in a.get("sources", []) for a in assets.values()):
            problems.append(f"source {name}: no asset uses it")
    # Provenance still owed: each item names the assets or sources it concerns and what is missing, and
    # every asset of unrecorded origin must be tracked here, so a gap can't sit unnoticed
    tracked = set()
    for i, item in enumerate(manifest.get("unresolved", [])):
        refs = item.get("refs", [])
        if not item.get("missing") or not refs:
            problems.append(f"unresolved item {i}: needs refs and what is missing (missing)")
        for r in refs:
            if r not in assets and r not in sources:
                problems.append(f"unresolved item {i}: unknown asset or source {r!r}")
            tracked.add(r)
    for name, a in assets.items():
        if a.get("origin") == "unrecorded" and name not in tracked:
            problems.append(f"asset {name}: origin unrecorded, but no unresolved item tracks it")
    return problems


def git(*args, cwd):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def base_commit(cwd):
    """The commit whose immutable files this tree must not rewrite, or None when there is no history to compare."""
    want = os.environ.get("IMMUTABLE_BASE", "").strip()
    if not want or set(want) == {"0"}:   # a push that creates a branch reports an all-zero "before"
        want = "origin/main"
    base = git("rev-parse", "--verify", "-q", f"{want}^{{commit}}", cwd=cwd)
    head = git("rev-parse", "--verify", "-q", "HEAD", cwd=cwd)
    if base and base == head:
        base = git("rev-parse", "--verify", "-q", "HEAD^", cwd=cwd)
    return base


def rewritten(root):
    """Immutable paths present in the base commit whose bytes differ now. Compares git blob ids, so no checkout is needed."""
    root = root.resolve()
    top = git("rev-parse", "--show-toplevel", cwd=root)
    base = top and base_commit(root)
    if not base:
        print("manifest: no base commit to compare with (no git history or origin/main); same-path check skipped")
        return []
    prefix = root.relative_to(top).as_posix() + "/"
    listing = git("ls-tree", "-r", base, "--", *(prefix + d for d in IMMUTABLE), cwd=top) or ""
    problems = []
    for line in listing.splitlines():
        meta, path = line.split("\t", 1)
        blob = meta.split()[2]
        rel = path[len(prefix):]
        here = root / rel
        if here.is_file() and git("hash-object", str(here), cwd=top) != blob:
            problems.append(f"{rel}: its bytes changed since {base[:12]}, but the path did not")
    if problems:
        problems.append("manifest: fonts and media are cached as immutable; give a changed file a new name, keep the old one, and point its users at the new name")
    else:
        print(f"manifest: no font or media path changed bytes since {base[:12]}")
    return problems


def main():
    if len(sys.argv) != 4 or sys.argv[1] not in ("check", "update"):
        sys.exit("usage: manifest.py check|update SITE_DIR MANIFEST")
    mode, root, mpath = sys.argv[1], pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
    manifest = json.loads(mpath.read_text())
    files = manifest.setdefault("files", {})

    # update: fresh hashes for every listed file and every immutable one, in path order
    if mode == "update":
        for rel in set(files) | set(immutable_files(root)) | set(vendored_files(root)):
            if (root / rel).is_file():
                files.setdefault(rel, {})["sha256"] = sha256(root / rel)
            else:
                del files[rel]
        manifest["files"] = dict(sorted(files.items()))
        mpath.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"manifest: {len(files)} files hashed into {mpath}")
        return

    # check: every listed file exists with its hash, and every immutable file is listed
    problems = []
    for rel, entry in files.items():
        if not (root / rel).is_file():
            problems.append(f"{rel}: listed in the manifest but not in the site")
        elif sha256(root / rel) != entry.get("sha256"):
            problems.append(f"{rel}: sha256 differs from the manifest (run make rehash, then see the same-path rule)")
    problems += [f"{rel}: served as immutable but not in the manifest (run make rehash)" for rel in immutable_files(root) if rel not in files]
    problems += [f"{rel}: vendored but not in the manifest (run make rehash)" for rel in vendored_files(root) if rel not in files]
    problems += provenance(root, manifest)
    problems += rewritten(root)
    if problems:
        sys.exit("\n".join(problems))
    assets = manifest.get("assets", {})
    unrecorded = sorted(n for n, a in assets.items() if a.get("origin") == "unrecorded")
    print(f"manifest: {len(files)} files match their hashes; {len(assets)} assets and {len(manifest.get('sources', {}))} sources are recorded"
          + (f"; origin unrecorded: {', '.join(unrecorded)}" if unrecorded else "")
          + (f"; {len(manifest.get('unresolved', []))} provenance items tracked as unresolved" if manifest.get("unresolved") else ""))


if __name__ == "__main__":
    main()
