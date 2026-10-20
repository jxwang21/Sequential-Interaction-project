#!/usr/bin/env python3
"""Turn docs/index.html into the page body the Claude Artifact tool expects (no doctype/html/head/body wrapper)
and print the list of supporting files (relative paths stay valid because they are published alongside the page).
Usage: python3 -I tools/make-artifact-page.py OUT_DIR
Writes OUT_DIR/index.html and prints the published-path -> source map as JSON."""
import json, os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
docs = os.path.join(root, 'docs')
out = sys.argv[1]
src = open(os.path.join(docs, 'index.html'), encoding='utf-8').read()

head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
keep = []
for line in head.splitlines():
    t = line.strip()
    if t.startswith('<title>') or t.startswith('<meta name="description"') or 'rel="stylesheet"' in t:
        keep.append(t)
page = '\n'.join(keep) + '\n' + body.strip() + '\n'
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(page)

files = {}
for base, _, names in os.walk(docs):
    for n in names:
        rel = os.path.relpath(os.path.join(base, n), docs).replace(os.sep, '/')
        if rel in ('index.html', '.nojekyll') or n.startswith('.'):
            continue
        files[rel] = os.path.join(docs, rel)
print(json.dumps(files, indent=1, sort_keys=True))
