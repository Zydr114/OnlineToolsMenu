#!/usr/bin/env python3
"""Download OFL fonts and make a small, self-hosted Chinese subset.

Run explicitly after adding page copy: python scripts/update-fonts.py.
Font sources are cached only in ignored artifacts/. No network request is made
by the production build or deployed page.
"""
from pathlib import Path
import re
import urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "artifacts/font-sources"
OUT = ROOT / "public/fonts"
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)


def fetch(url: str, path: Path):
    if not path.exists():
        urllib.request.urlretrieve(url, path)


def make_subset(source: Path, output: str, text: str):
    font = TTFont(source)
    options = subset.Options()
    options.flavor = "woff2"
    options.desubroutinize = True
    worker = subset.Subsetter(options=options)
    worker.populate(text=text)
    worker.subset(font)
    font.flavor = "woff2"
    font.save(OUT / output)


base = "https://raw.githubusercontent.com/google/fonts/main/ofl"
fetch(f"{base}/manrope/Manrope%5Bwght%5D.ttf", CACHE / "manrope.ttf")
fetch(f"{base}/manrope/OFL.txt", OUT / "Manrope-OFL.txt")
fetch(f"{base}/notosanssc/NotoSansSC%5Bwght%5D.ttf", CACHE / "noto-sc.ttf")
fetch(f"{base}/notosanssc/OFL.txt", OUT / "NotoSansSC-OFL.txt")
copy = (ROOT / "index.html").read_text() + (ROOT / "src/main.ts").read_text()
cjk = "".join(sorted(set(re.findall(r"[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u2000-\u206f]", copy))))
latin = "".join(chr(code) for code in range(32, 257)) + "⌘↵↓✦✳—–‘’“”·…©"
make_subset(CACHE / "manrope.ttf", "manrope-latin.woff2", latin)
make_subset(CACHE / "noto-sc.ttf", "workshop-sc.woff2", cjk)
print(f"Created local font subsets ({len(cjk)} Chinese/punctuation glyphs).")
