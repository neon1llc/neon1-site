#!/usr/bin/env python3

# scripts/dev_build.py - Helpers for the dev.neon1.tech targets in the Makefile.
# Usage: python3 scripts/dev_build.py name BRANCH                       (a branch's preview name)
#        python3 scripts/dev_build.py prepare SITE_DIR DEV_DIR CORPUS_TAG (fresh copy to build into)
#        python3 scripts/dev_build.py link [site|admin]                 (copy a private sign-in link)
#        python3 scripts/dev_build.py relink                            (replace dev's link, if it leaked)
#        python3 scripts/dev_build.py signout STORE                     (sign every device out)
#        python3 scripts/dev_build.py allow EMAIL                       (let someone sign in)
#        python3 scripts/dev_build.py deny EMAIL                        (stop someone signing in)

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
# The two sign-in keys (neon1-aws-infrastructure site-dev/sign-in.tf reads them at the edge)
LINK_PARAM = "/neon1-site/dev/link_key"
# Each private host's link key and sign-in address; admin-dev's key is checked by neon1-admin's gate
LINKS = {
    "site": (LINK_PARAM, "https://dev.neon1.tech/__signin?k="),
    "admin": ("/neon1-admin/dev/signin_key", "https://admin-dev.neon1.tech/__signin?k="),
}
SESSION_PARAM = "/neon1-site/dev/session_key"
# The 1NEON dev pool, its dev-access group, and the gate's own client there
DEV_POOL = "1neon-dev"
DEV_GROUP = "dev-access"
DEV_CLIENT = "neon1-dev-gate"
AUTH_HOST = "https://auth-dev.neon1.tech"


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
    # and its drafts are shown too (a draft branch is how a post is read in place before it's adopted).
    # A CORPUS_DIR already holding the branch's tree (the dev workflow's pinned branch with a release merged
    # in) is used as it is, drafts shown, and not fetched over
    if corpus_tag and not re.fullmatch(r"v\d+\.\d+\.\d+", corpus_tag):
        if os.environ.get("CORPUS_DIR"):
            show_drafts(os.path.join(os.environ["CORPUS_DIR"], "tools", "export.mjs"))
            return
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


def put_secret(name, value):
    """Overwrite one SecureString; the value goes in through a temp file, never the command line."""
    import tempfile
    with tempfile.NamedTemporaryFile("w", delete=True) as f:
        os.chmod(f.name, 0o600)
        f.write(value)
        f.flush()
        aws("ssm", "put-parameter", "--name", name, "--type", "SecureString", "--overwrite",
            "--value", f"file://{f.name}")


def link(site):
    """Copy a host's private sign-in link to the clipboard. It reads the key and changes nothing."""
    if site not in LINKS:
        sys.exit("dev-link: SITE is site or admin")
    name, address = LINKS[site]
    key = aws("ssm", "get-parameter", "--name", name, "--with-decryption")["Parameter"]["Value"]
    subprocess.run(["pbcopy"], input=address + key, text=True, check=True)
    print("The private sign-in link is on the clipboard. Save it as a bookmark or in your password manager.")


def relink():
    """Replace dev's link key, only for a leaked link: every saved copy stops working within a minute."""
    put_secret(LINK_PARAM, secrets.token_urlsafe(32))
    link("site")
    print("The old link no longer works. Signed-in devices stay in.")


def signout(store):
    """A new cookie key, in SSM for the sign-in function and in the store for the gate: every device
    is signed out at once (the store within seconds, the sign-in function within a minute)."""
    key = secrets.token_hex(32)
    put_secret(SESSION_PARAM, key)
    arn = aws("cloudfront", "describe-key-value-store", "--name", store)["KeyValueStore"]["ARN"]
    etag = aws("cloudfront-keyvaluestore", "describe-key-value-store", "--kvs-arn", arn)["ETag"]
    aws("cloudfront-keyvaluestore", "put-key", "--kvs-arn", arn, "--if-match", etag, "--key", "session", "--value", key)
    print("Every device is signed out of dev.neon1.tech; sign in again with the private link (make dev-link)")


def pool():
    """The dev pool's id and the gate client's id."""
    pools = aws("cognito-idp", "list-user-pools", "--max-results", "60")["UserPools"]
    pid = next(p["Id"] for p in pools if p["Name"] == DEV_POOL)
    clients = aws("cognito-idp", "list-user-pool-clients", "--user-pool-id", pid, "--max-results", "60")["UserPoolClients"]
    return pid, next(c["ClientId"] for c in clients if c["ClientName"] == DEV_CLIENT)


def check_email(email):
    """A plain address only: it goes into a Cognito filter expression."""
    if not re.fullmatch(r"[^@\s\"'\\]+@[^@\s\"'\\]+\.[^@\s\"'\\]+", email):
        sys.exit(f"dev: {email!r} is not an email address")


def allow(email):
    """Let someone sign in to dev: a dev account if they have none (no invite email), then the group."""
    check_email(email)
    pid, client = pool()
    found = aws("cognito-idp", "list-users", "--user-pool-id", pid, "--filter", f'email = "{email}"')["Users"]
    if found:
        user = found[0]["Username"]
    else:
        user = aws("cognito-idp", "admin-create-user", "--user-pool-id", pid, "--username", email,
                   "--message-action", "SUPPRESS", "--user-attributes", f"Name=email,Value={email}",
                   "Name=email_verified,Value=true")["User"]["Username"]
        print(f"created a dev account for {email}")
    aws("cognito-idp", "admin-add-user-to-group", "--user-pool-id", pid, "--username", user, "--group-name", DEV_GROUP)
    print(f"{email} may sign in to dev.neon1.tech (an email code works; a passkey is quicker).")
    print("Sign in with the private link (make dev-link), then add a passkey here:")
    print(f"{AUTH_HOST}/passkeys/add?client_id={client}&redirect_uri=https://dev.neon1.tech/__auth")


def deny(email):
    """Take someone out of dev-access; their account stays, and make dev-signout ends live sessions."""
    check_email(email)
    pid, _ = pool()
    found = aws("cognito-idp", "list-users", "--user-pool-id", pid, "--filter", f'email = "{email}"')["Users"]
    if not found:
        sys.exit(f"dev-deny: no dev account for {email}")
    aws("cognito-idp", "admin-remove-user-from-group", "--user-pool-id", pid, "--username", found[0]["Username"],
        "--group-name", DEV_GROUP)
    print(f"{email} can no longer sign in to dev.neon1.tech; run make dev-signout to end their sessions now.")


def main():
    a = sys.argv[1:]
    if a[:1] == ["name"] and len(a) == 2:
        print(name(a[1]))
    elif a[:1] == ["prepare"] and len(a) in (3, 4):
        prepare(a[1], a[2], a[3] if len(a) == 4 else "")
    elif a[:1] == ["link"] and len(a) in (1, 2):
        link(a[1] if len(a) == 2 else "site")
    elif a == ["relink"]:
        relink()
    elif a[:1] == ["signout"] and len(a) == 2:
        signout(a[1])
    elif a[:1] == ["allow"] and len(a) == 2:
        allow(a[1])
    elif a[:1] == ["deny"] and len(a) == 2:
        deny(a[1])
    else:
        sys.exit("usage: dev_build.py name BRANCH | prepare SITE_DIR DEV_DIR [CORPUS_TAG] | link [site|admin] | relink | signout STORE | allow EMAIL | deny EMAIL")


if __name__ == "__main__":
    main()
