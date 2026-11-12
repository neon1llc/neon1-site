#!/usr/bin/env python3
# scripts/indexnow.py - Tells IndexNow search engines (Bing, Yandex, Seznam, Naver) which pages just changed.
# Usage: python3 scripts/indexnow.py SITE_DIR [--dry-run]   (make indexnow, run by the deploy job after verify)
#
# Bing's index also feeds Copilot and ChatGPT search, so a ping gets a changed page re-read within hours
# instead of whenever the crawler next passes. The key file <key>.txt at the site root proves the site is
# ours; it is public by design. Only the home page and pages whose sitemap lastmod is recent are sent, since
# IndexNow asks for changed URLs, not the whole site on every deploy. A failed ping never fails a deploy.

import datetime
import glob
import json
import os
import re
import sys
import urllib.request

HOST = "neon1.tech"
ENDPOINT = "https://api.indexnow.org/indexnow"
RECENT_DAYS = 2


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: indexnow.py SITE_DIR [--dry-run]")
    site, dry = sys.argv[1], "--dry-run" in sys.argv

    # The key is the one 32-hex-digit .txt file at the root whose content is its own name
    keys = [os.path.basename(f)[:-4] for f in glob.glob(os.path.join(site, "*.txt"))
            if re.fullmatch(r"[0-9a-f]{32}\.txt", os.path.basename(f))
            and open(f).read().strip() == os.path.basename(f)[:-4]]
    if len(keys) != 1:
        sys.exit(f"indexnow: expected one key file in {site}, found {len(keys)}")
    key = keys[0]

    # The home page always, plus any sitemap entry updated in the last few days
    sitemap = open(os.path.join(site, "sitemap.xml")).read()
    since = (datetime.date.today() - datetime.timedelta(days=RECENT_DAYS)).isoformat()
    urls = [f"https://{HOST}/", f"https://{HOST}/llms.txt"]
    for loc, mod in re.findall(r"<loc>([^<]+)</loc>(?:<lastmod>([^<]+)</lastmod>)?", sitemap):
        if mod and mod >= since and loc not in urls:
            urls.append(loc)

    body = {"host": HOST, "key": key, "keyLocation": f"https://{HOST}/{key}.txt", "urlList": urls}
    print(f"indexnow: {len(urls)} URLs")
    if dry:
        print(json.dumps(body, indent=2))
        return
    req = urllib.request.Request(ENDPOINT, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f"indexnow: {r.status}")
    except Exception as e:  # 202 is success; anything else is reported, not fatal
        print(f"indexnow: not accepted ({e})")


if __name__ == "__main__":
    main()
