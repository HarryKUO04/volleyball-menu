#!/usr/bin/env python3
"""把 HackMD / Markdown 筆記產生為零外部 JS 相依的靜態文件網站。"""
from __future__ import annotations

import argparse
import html
import re
import shutil
import unicodedata
from pathlib import Path
from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parent


def cleanup_hackmd(text: str) -> str:
    # HackMD 的文件內目錄由本網站的導覽欄取代。
    text = re.sub(r'(?im)^\s*\[toc\]\s*$', '', text)
    # 僅去除包住 [toc] 的 spoiler block，避免畫面出現空的 spoiler。
    text = re.sub(r'(?ims)^\s*:::spoiler[^\n]*\n\s*\n*:::\s*(?:\n|$)', '', text)
    # 其餘 :::spoiler 區塊在原生 markdown 沒有意義，轉成標準 details。
    text = re.sub(r'(?m)^:::spoiler\s*(.*)$', r'**\1**', text)
    text = re.sub(r'(?m)^:::\s*$', '', text)
    return text


def slugify(label: str, used: dict[str, int]) -> str:
    label = unicodedata.normalize('NFKC', label).lower().strip()
    label = re.sub(r'[^\w\u4e00-\u9fff\-\s]', '', label)
    label = re.sub(r'[\s_]+', '-', label).strip('-') or 'heading'
    count = used.get(label, 0)
    used[label] = count + 1
    return label if not count else f'{label}-{count + 1}'


def render_markdown(text: str) -> tuple[str, int]:
    md = MarkdownIt('default', {'html': False, 'breaks': True})
    md.enable('table')
    tokens = md.parse(cleanup_hackmd(text))
    used: dict[str, int] = {}
    headings = 0
    for i, token in enumerate(tokens):
        if token.type != 'heading_open' or token.tag not in ('h1', 'h2', 'h3'):
            continue
        following = tokens[i + 1] if i + 1 < len(tokens) else None
        label = following.content if following and following.type == 'inline' else '無標題'
        token.attrSet('id', slugify(label, used))
        headings += 1
    return md.renderer.render(tokens, md.options, {}), headings


def build(input_path: Path, output_dir: Path, is_demo: bool) -> None:
    source = input_path.read_text(encoding='utf-8-sig')
    article, count = render_markdown(source)
    template = (ROOT / 'template.html').read_text(encoding='utf-8')
    title = '成大電機排球訓練菜單'
    page = template.replace('%%ARTICLE%%', article)
    page = page.replace('%%TITLE%%', html.escape(title))
    page = page.replace('%%DEMO%%', 'true' if is_demo else 'false')
    page = page.replace('%%HEADING_COUNT%%', str(count))
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / 'index.html').write_text(page, encoding='utf-8')
    for f in ('style.css', 'app.js'):
        shutil.copy2(ROOT / f, output_dir / f)
    (output_dir / '.nojekyll').touch()
    print(f'網站產生完成：{output_dir / "index.html"}（{count} 個目錄標題，demo={is_demo}）')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', default='sample-note.md')
    parser.add_argument('--output', default='site')
    parser.add_argument('--demo', action='store_true')
    args = parser.parse_args()
    build(ROOT / args.input, ROOT / args.output, args.demo)


if __name__ == '__main__':
    main()
