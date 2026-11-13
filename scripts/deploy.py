#!/usr/bin/env python3

# scripts/deploy.py - Ship the site as one release and switch every visitor to it at once.
# Usage: python3 scripts/deploy.py id SITE_DIR
#        python3 scripts/deploy.py deploy SITE_DIR BUCKET STORE
#        python3 scripts/deploy.py rollback BUCKET STORE [RELEASE]
#        python3 scripts/deploy.py dev SITE_DIR BUCKET STORE KEY      (dev.neon1.tech; KEY is "release" or "branch:<name>")
#
# Pages, scripts, and styles are uploaded whole to releases/<id>/, where <id> is a hash of their
# content, and only then does the store's "release" key name that folder. neon1.tech's router
# (neon1-aws-infrastructure, site/functions/site-router.js) reads the key on each request, so
# nobody ever gets a new page with an old script. New folders mean new cache keys, so nothing
# needs invalidating. Fonts and media never change at a path (make manifest) and .well-known is
# read by mail servers and scanners, so those stay shared at the bucket's top.

import hashlib
import json
import os
import re
import subprocess
import sys

# Shared at the bucket's top rather than per release
SHARED = ("fonts/", "media/", ".well-known/")
# Releases kept for rollback; older folders are deleted after a switch
KEEP = 5
# dev.neon1.tech keeps fewer: its own last 3, plus one folder per branch preview
DEV_KEEP = 3
LONG_CACHE = "public, max-age=31536000, immutable"
SHORT_CACHE = "no-cache"
# The sync skips dotfiles everywhere except the top-level .well-known folder
DOTFILES = ["--exclude", ".*", "--exclude", "*/.*"]


# --- The release's content ---


def site_files(root):
    """Map keys to MD5 digests, skipping dotfiles the way the sync does, except .well-known."""
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


def release_id(root):
    """Twelve hex digits naming the per-release files' content: the same files, the same release."""
    h = hashlib.sha256()
    for key, digest in sorted(site_files(root).items()):
        if not key.startswith(SHARED):
            h.update(f"{key}\0{digest}\n".encode())
    return h.hexdigest()[:12]


# --- AWS calls, through the CLI the workflow already has credentials for ---


def aws(*args, capture=True):
    """Run an aws CLI command; return its parsed JSON output when there is any."""
    out = subprocess.run(["aws", *args], check=True, text=True, stdout=subprocess.PIPE if capture else None)
    return json.loads(out.stdout) if capture and out.stdout.strip() else None


def store_state(store):
    """The store's ARN, its ETag (each write must name it), the live release, and recent releases."""
    arn = aws("cloudfront", "describe-key-value-store", "--name", store, "--output", "json")["KeyValueStore"]["ARN"]
    etag = aws("cloudfront-keyvaluestore", "describe-key-value-store", "--kvs-arn", arn, "--output", "json")["ETag"]
    items = aws("cloudfront-keyvaluestore", "list-keys", "--kvs-arn", arn, "--output", "json").get("Items", [])
    keys = {i["Key"]: i["Value"] for i in items}
    history = [h for h in keys.get("history", "").split(",") if h]
    return arn, etag, keys.get("release", ""), history


def switch(arn, etag, release, history):
    """Point the site at a release, in one write with the history that rollback reads."""
    puts = json.dumps([{"Key": "release", "Value": release}, {"Key": "history", "Value": ",".join(history)}])
    aws("cloudfront-keyvaluestore", "update-keys", "--kvs-arn", arn, "--if-match", etag, "--puts", puts, "--output", "json")


def folders(bucket):
    """Release folders in the bucket, by id."""
    out = aws("s3api", "list-objects-v2", "--bucket", bucket, "--prefix", "releases/", "--delimiter", "/",
              "--query", "CommonPrefixes[].Prefix", "--output", "json") or []
    return [p[len("releases/"):-1] for p in out]


# --- Commands ---


def deploy(root, bucket, store):
    rid = release_id(root)
    arn, etag, live, history = store_state(store)
    print(f"release {rid} (live: {live or 'none'})")

    # Shared files first, so a release never points at a font or model that isn't there yet; never
    # deleted, since a page left open from an older release may still ask for them
    aws("s3", "sync", root, f"s3://{bucket}", "--no-progress", "--exclude", "*", "--include", "fonts/*",
        "--include", "media/*", *DOTFILES, "--cache-control", LONG_CACHE, capture=False)
    aws("s3", "sync", root, f"s3://{bucket}", "--no-progress", "--exclude", "*", "--include", ".well-known/*",
        "--cache-control", SHORT_CACHE, capture=False)
    if live == rid:
        print(f"release {rid} is already live")
        return

    # The whole release, into its own folder; nobody is served from it yet
    aws("s3", "sync", root, f"s3://{bucket}/releases/{rid}", "--delete", "--no-progress",
        "--exclude", "fonts/*", "--exclude", "media/*", *DOTFILES, "--cache-control", SHORT_CACHE, capture=False)

    # One write moves every visitor to it
    history = [rid] + [h for h in history if h != rid]
    history = history[:KEEP]
    switch(arn, etag, rid, history)
    print(f"release {rid} is live")

    # Folders that fell out of the history go; the live one and the history are never touched
    for old in folders(bucket):
        if old not in history and old != rid:
            print(f"removing release {old}")
            aws("s3", "rm", f"s3://{bucket}/releases/{old}/", "--recursive", "--only-show-errors", capture=False)


def dev(root, bucket, store, key):
    """dev.neon1.tech: the same upload, then one key switches. "release" is the dev branch (with a short
    history for make dev-rollback); "branch:<name>" is a branch preview. No tags, no IndexNow, no verify
    against neon1.tech: dev releases are never releases of the site."""
    if key != "release" and not re.fullmatch(r"branch:[a-z0-9][a-z0-9-]{0,39}", key):
        sys.exit(f"dev: bad key {key!r}")
    rid = release_id(root)
    arn = aws("cloudfront", "describe-key-value-store", "--name", store, "--output", "json")["KeyValueStore"]["ARN"]
    etag = aws("cloudfront-keyvaluestore", "describe-key-value-store", "--kvs-arn", arn, "--output", "json")["ETag"]
    items = aws("cloudfront-keyvaluestore", "list-keys", "--kvs-arn", arn, "--output", "json").get("Items", [])
    keys = {i["Key"]: i["Value"] for i in items}
    if len(keys.get("gate", "")) < 32:
        print("dev: no gate key yet, so dev.neon1.tech stays closed to everyone (make dev-gate sets one)")
    print(f"{key} -> release {rid} (was {keys.get(key) or 'none'})")

    # Shared files, then the release folder, exactly as the live deploy does them
    aws("s3", "sync", root, f"s3://{bucket}", "--no-progress", "--exclude", "*", "--include", "fonts/*",
        "--include", "media/*", *DOTFILES, "--cache-control", LONG_CACHE, capture=False)
    aws("s3", "sync", root, f"s3://{bucket}", "--no-progress", "--exclude", "*", "--include", ".well-known/*",
        "--cache-control", SHORT_CACHE, capture=False)
    if keys.get(key) != rid:
        aws("s3", "sync", root, f"s3://{bucket}/releases/{rid}", "--delete", "--no-progress",
            "--exclude", "fonts/*", "--exclude", "media/*", *DOTFILES, "--cache-control", SHORT_CACHE, capture=False)
        puts = [{"Key": key, "Value": rid}]
        if key == "release":
            history = [rid] + [h for h in keys.get("history", "").split(",") if h and h != rid]
            keys["history"] = ",".join(history[:DEV_KEEP])
            puts.append({"Key": "history", "Value": keys["history"]})
        keys[key] = rid
        aws("cloudfront-keyvaluestore", "update-keys", "--kvs-arn", arn, "--if-match", etag,
            "--puts", json.dumps(puts), "--output", "json")
    print(f"{key} is release {rid}")

    # Keep every folder a key or the history still names; drop the rest
    wanted = {v for k, v in keys.items() if k == "release" or k.startswith("branch:")}
    wanted |= {h for h in keys.get("history", "").split(",") if h}
    for old in folders(bucket):
        if old not in wanted:
            print(f"removing release {old}")
            aws("s3", "rm", f"s3://{bucket}/releases/{old}/", "--recursive", "--only-show-errors", capture=False)


def dev_drop(bucket, store, key):
    """Forget a branch preview (its folder goes on the next dev deploy)."""
    if not key.startswith("branch:"):
        sys.exit("dev-drop: only branch previews can be dropped")
    arn = aws("cloudfront", "describe-key-value-store", "--name", store, "--output", "json")["KeyValueStore"]["ARN"]
    etag = aws("cloudfront-keyvaluestore", "describe-key-value-store", "--kvs-arn", arn, "--output", "json")["ETag"]
    aws("cloudfront-keyvaluestore", "delete-key", "--kvs-arn", arn, "--if-match", etag, "--key", key, "--output", "json")
    print(f"dropped {key}")


def rollback(bucket, store, target=None):
    arn, etag, live, history = store_state(store)
    if target is None:
        # The release before the live one in the history
        older = history[history.index(live) + 1:] if live in history else history[1:]
        if not older:
            sys.exit("rollback: no earlier release in the history")
        target = older[0]
    if target not in folders(bucket):
        sys.exit(f"rollback: releases/{target}/ is not in the bucket")
    switch(arn, etag, target, history)
    print(f"release {target} is live (was {live or 'none'})")


def main():
    args = sys.argv[1:]
    if args[:1] == ["id"] and len(args) == 2:
        print(release_id(args[1]))
    elif args[:1] == ["deploy"] and len(args) == 4:
        deploy(*args[1:])
    elif args[:1] == ["rollback"] and len(args) in (3, 4):
        rollback(*args[1:])
    elif args[:1] == ["dev"] and len(args) == 5:
        dev(*args[1:])
    elif args[:1] == ["dev-drop"] and len(args) == 4:
        dev_drop(*args[1:])
    else:
        sys.exit("usage: deploy.py id SITE_DIR | deploy SITE_DIR BUCKET STORE | rollback BUCKET STORE [RELEASE]"
                 " | dev SITE_DIR BUCKET STORE KEY | dev-drop BUCKET STORE KEY")


if __name__ == "__main__":
    main()
