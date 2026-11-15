"""Download the design's two fonts into static/fonts/ so the app also looks right offline.

Atkinson Hyperlegible Next (words) and DM Mono (numbers), both SIL Open Font License, from Google Fonts.
Run once with internet:   python tools/get_fonts.py
index.html loads static/fonts/fonts.css first; without it the page falls back to Google Fonts, then system fonts.
"""
import re
from pathlib import Path

import requests

CSS_URL = ("https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600"
           "&family=DM+Mono:wght@400;500&display=swap")
OUT = Path(__file__).resolve().parent.parent / "static" / "fonts"
# A modern browser user agent makes Google Fonts return woff2 files.
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    css = requests.get(CSS_URL, headers=UA, timeout=30).text
    urls = sorted(set(re.findall(r"url\((https://[^)]+\.woff2)\)", css)))
    for i, u in enumerate(urls):
        name = f"font-{i}.woff2"
        (OUT / name).write_bytes(requests.get(u, headers=UA, timeout=60).content)
        css = css.replace(u, f"/static/fonts/{name}")
    (OUT / "fonts.css").write_text(css, encoding="utf-8")
    print(f"Saved {len(urls)} font files and fonts.css in {OUT}")


if __name__ == "__main__":
    main()
