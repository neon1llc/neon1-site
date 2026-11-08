#!/usr/bin/env python3

# scripts/changes.py - List site files that differ from what the bucket holds.
# Usage: aws s3api list-objects-v2 --bucket B --query 'Contents[].[Key,ETag]' --output json | python3 scripts/changes.py src/app/public
#
# Compares content hashes, not timestamps, because a CI checkout gives every
# file a new mtime. A single-part upload's ETag is the object's MD5, so a
# multipart or KMS-encrypted object always counts as changed, which is safe.

import hashlib
import json
import os
import sys


def local_files(root):
    """Map object keys to MD5 hex digests, skipping dotfiles like the sync does, except .well-known."""
    files = {}
    for folder, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if not d.startswith(".") or (folder == root and d == ".well-known")]
        for name in names:
            if name.startswith("."):
                continue
            path = os.path.join(folder, name)
            key = os.path.relpath(path, root).replace(os.sep, "/")
            with open(path, "rb") as f:
                files[key] = hashlib.md5(f.read(), usedforsecurity=False).hexdigest()
    return files


def synced(key):
    """True for keys the sync manages: no dot segments, except a top-level .well-known/ like local_files."""
    parts = key.split("/")
    if parts[0] == ".well-known":
        parts = parts[1:]
    return not any(part.startswith(".") for part in parts)


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: changes.py SITE_DIR < objects.json")

    # An empty bucket makes the CLI print null instead of a list
    try:
        objects = json.load(sys.stdin) or []
    except ValueError:
        sys.exit("changes.py: could not read the bucket listing")
    remote = {key: etag.strip('"') for key, etag in objects if synced(key)}
    local = local_files(sys.argv[1])

    for key in sorted(local):
        if remote.get(key) != local[key]:
            print(f"{'update' if key in remote else 'add'} {key}")
    for key in sorted(set(remote) - set(local)):
        print(f"delete {key}")


if __name__ == "__main__":
    main()
