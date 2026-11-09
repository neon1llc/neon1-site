#!/usr/bin/env python3

# scripts/manifest.py - Keeps src/app/asset-manifest.json true to the files it lists.
# Usage: python3 scripts/manifest.py check|update src/app/public src/app/asset-manifest.json
#
# Fonts and media are served with a year-long immutable cache, so a path must always mean the same
# bytes: a browser that cached it never asks again, and a page left open from an older release
# may still ask for it after a deploy.
# check fails if
#   - a file under fonts/ or media/ is missing from the manifest, or its sha256 differs from it;
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

# Folders deployed with the immutable cache (Makefile LONG_CACHE)
IMMUTABLE = ("fonts/", "media/")


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
        for rel in set(files) | set(immutable_files(root)):
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
    problems += rewritten(root)
    if problems:
        sys.exit("\n".join(problems))
    print(f"manifest: {len(files)} files match their hashes")


if __name__ == "__main__":
    main()
