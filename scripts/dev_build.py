#!/usr/bin/env python3

# scripts/dev_build.py - Helpers for the dev.neon1.tech targets in the Makefile.
# Usage: python3 scripts/dev_build.py name BRANCH                       (a branch's preview name)
#        python3 scripts/dev_build.py prepare SITE_DIR DEV_DIR CORPUS_TAG (fresh copy to build into)
#        python3 scripts/dev_build.py gate STORE                        (new sign-in key and link)

import json
import os
import re
import secrets
import shutil
import subprocess
import sys

# Every dev build lives under here; prepare refuses to clear anything else
DEV_ROOT = ".dev-build"
CORPUS_REPO = "https://github.com/neon1llc/neon1-corpus"


def name(branch):
    """A branch's preview name: lowercase letters, digits, and single dashes, at most 40 characters."""
    n = re.sub(r"-+", "-", re.sub(r"[^a-z0-9]", "-", branch.lower())).strip("-")
    return n[:40].rstrip("-")


def prepare(site_dir, dev_dir, corpus_tag):
    """Copy the site into dev_dir so content builds there; a corpus branch's checkout is fetched fresh."""
    target = os.path.realpath(dev_dir)
    if not target.startswith(os.path.realpath(DEV_ROOT) + os.sep):
        sys.exit(f"dev-build: {dev_dir} is outside {DEV_ROOT}/")
    shutil.rmtree(target, ignore_errors=True)
    shutil.copytree(site_dir, target)
    # A release tag never changes, so its checkout is reused; a branch moves, so it's fetched again,
    # and its drafts are shown too (a draft branch is how a post is read in place before it's adopted)
    if corpus_tag and not re.fullmatch(r"v\d+\.\d+\.\d+", corpus_tag):
        checkout = os.path.realpath(os.path.join(".corpus", corpus_tag))
        if not checkout.startswith(os.path.realpath(".corpus") + os.sep):
            sys.exit(f"dev-build: bad corpus ref {corpus_tag}")
        shutil.rmtree(checkout, ignore_errors=True)
        os.makedirs(checkout)
        git = ["git", "-C", checkout]
        subprocess.run(["git", "init", "-q", checkout], check=True)
        subprocess.run([*git, "fetch", "-q", "--depth", "1", CORPUS_REPO, corpus_tag], check=True)
        subprocess.run([*git, "checkout", "-q", "FETCH_HEAD"], check=True)
        show_drafts(os.path.join(checkout, "tools", "export.mjs"))


def show_drafts(export):
    """Let this dev-only checkout's export include status: draft documents beside adopted ones."""
    with open(export, encoding="utf-8") as f:
        code = f.read()
    adopted = 'd.data.status === "adopted"'
    if adopted not in code:
        print("dev-build: the corpus export's status filter changed; drafts won't show")
        return
    with open(export, "w", encoding="utf-8") as f:
        f.write(code.replace(adopted, '["adopted", "draft"].includes(d.data.status)', 1))
    print("dev-build: corpus drafts included")


def aws(*args):
    out = subprocess.run(["aws", *args, "--output", "json"], check=True, text=True, stdout=subprocess.PIPE)
    return json.loads(out.stdout) if out.stdout.strip() else None


def gate(store):
    """Put a new random key in the dev store's "gate" and print the sign-in link once."""
    key = secrets.token_urlsafe(32)
    arn = aws("cloudfront", "describe-key-value-store", "--name", store)["KeyValueStore"]["ARN"]
    etag = aws("cloudfront-keyvaluestore", "describe-key-value-store", "--kvs-arn", arn)["ETag"]
    aws("cloudfront-keyvaluestore", "put-key", "--kvs-arn", arn, "--if-match", etag, "--key", "gate", "--value", key)
    print("Sign-in link. Save it in your password manager and open it once on each device;")
    print("every device signed in before now is signed out.")
    print(f"https://dev.neon1.tech/__signin?k={key}")


def main():
    a = sys.argv[1:]
    if a[:1] == ["name"] and len(a) == 2:
        print(name(a[1]))
    elif a[:1] == ["prepare"] and len(a) in (3, 4):
        prepare(a[1], a[2], a[3] if len(a) == 4 else "")
    elif a[:1] == ["gate"] and len(a) == 2:
        gate(a[1])
    else:
        sys.exit("usage: dev_build.py name BRANCH | prepare SITE_DIR DEV_DIR [CORPUS_TAG] | gate STORE")


if __name__ == "__main__":
    main()
