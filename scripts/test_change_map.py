#!/usr/bin/env python3

# scripts/test_change_map.py - Proves the change map runs everything unless it is sure. Usage: python3 scripts/test_change_map.py (part of make logic)

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from change_map import decide  # noqa: E402

P = "src/app/public/"
CASES = [
    # (files, full, behavior, pdf, chat, only)
    (None, True, True, True, True, ""),
    ([], True, True, True, True, ""),
    (["CHANGELOG.md"], False, False, False, False, ""),
    ([P + "css/knowledge.css", "CHANGELOG.md"], False, False, True, False, ""),
    ([P + "js/white-rabbit-scene.js"], False, True, False, False, "rabbit"),
    ([P + "js/contact.js", P + "js/cases.js"], False, True, False, False, "case|contact|AS-03|AS-09"),
    ([P + "shared/chat.js"], False, False, False, True, ""),
    ([P + "css/site.css"], True, True, True, True, ""),
    ([P + "shared/neon1.css"], True, True, True, True, ""),
    ([P + "index.html"], True, True, True, True, ""),
    ([P + "version.json"], True, True, True, True, ""),
    ([P + "js/views.js", "CHANGELOG.md"], True, True, True, True, ""),
    (["scripts/behavior.cjs"], True, True, True, True, ""),
    ([".github/workflows/deploy.yml"], True, True, True, True, ""),
    (["Makefile"], True, True, True, True, ""),
    ([P + "js/white-rabbit.js", "something/new.txt"], True, True, True, True, ""),
]
bad = 0
for files, full, behavior, pdf, chat, only in CASES:
    r = decide(files)
    got = (r["full"], r["behavior"], r["pdf"], r["chat"], r["only"])
    if got != (full, behavior, pdf, chat, only):
        bad += 1
        print(f"FAIL {files}: got {got}")
print("change map: all cases hold" if not bad else f"change map: {bad} failed")
sys.exit(1 if bad else 0)
