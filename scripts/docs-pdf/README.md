# docs-pdf

Builds every file in `docs/` into a single ordered PDF. Dev tooling only -
not part of the deployed app, not a runtime dependency of the backend or
frontend.

## Usage

```bash
cd scripts/docs-pdf
npm install
npm run build
```

Output: `docs/_build/HomeReady-AI-Documentation.pdf` (and the intermediate
`full-documentation.html`, useful if you want to print/inspect it
directly). Both are gitignored - they're generated from the Markdown
files, which stay the single source of truth.

## Requirements

- Node.js (already required for the frontend)
- A locally installed Google Chrome, Chromium, or Microsoft Edge

No Puppeteer/Playwright dependency is installed for this - the script
shells out to your existing browser's own `--headless --print-to-pdf`
flag, which does the whole HTML-to-PDF conversion without downloading a
second copy of Chromium. If it can't find your browser automatically, set
`CHROME_PATH` to the binary:

```bash
CHROME_PATH="/path/to/chrome" npm run build
```

## How it works

`generate.js` reads the same ordered list of documents as
`docs/README.md` (kept in sync by hand - update both together when a doc
is added, removed, or reordered), concatenates them into one HTML file
with a cover page and table of contents, rewrites cross-doc Markdown
links (`docs/database.md` → `#database`) into in-page anchors so they
still work once everything is one file, and then runs:

```bash
chrome --headless --disable-gpu --print-to-pdf=<output> <the html file>
```

If you'd rather generate the PDF a different way (pandoc, a CI-hosted
renderer, etc.), `full-documentation.html` in `docs/_build/` after
`npm run build` is a plain, already-assembled HTML file you can feed to
anything else that prints HTML to PDF.
