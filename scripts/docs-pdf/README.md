# docs-pdf

Builds every file in `docs/` into designed PDFs: one PDF per document
(numbered so they sort in reading order), plus one combined PDF with a
cover page and table of contents. Dev tooling only - not part of the
deployed app, not a runtime dependency of the backend or frontend.

## Usage

```bash
cd scripts/docs-pdf
npm install
npm run build
```

Output, all in `docs/_build/` (gitignored - generated from the Markdown
files, which stay the single source of truth):

```
00-HomeReady-AI-Documentation-Complete.pdf   # everything, one file
01-architecture.pdf
02-database.pdf
03-authentication.pdf
04-authorization.pdf
05-api-design.pdf
06-assessments.pdf
07-scoring-methodology.pdf
08-scoring-v1.pdf
09-results.pdf
10-recommendations.pdf
11-ai-architecture.pdf
12-security.pdf
13-threat-model.pdf
14-deployment.pdf
```

Every PDF has: a title cover page (section label, doc title, "Prepared by
Subash Neupane", generation date), a running header (`HomeReady AI · <doc
title>`), and a footer with the same attribution plus page numbers.

## Requirements

- Node.js (already required for the frontend)
- A locally installed Google Chrome, Chromium, or Microsoft Edge

This uses `playwright-core` (not the full `playwright` package) purely as
a driver for your own installed browser - it has no bundled Chromium and
downloads nothing at `npm install`. If it can't find your browser
automatically, set `CHROME_PATH` to the binary:

```bash
CHROME_PATH="/path/to/chrome" npm run build
```

## How it works

`generate.js` keeps the same ordered list of documents as `docs/README.md`
(kept in sync by hand - update both together when a doc is added,
removed, or reordered). For each one it renders a styled HTML page (cover
+ Markdown content, via `marked`) and calls Chromium's `page.pdf()` with
`headerTemplate`/`footerTemplate` for the running header, footer, and
page numbers - that template support is why this uses a real browser
driver instead of the plain `chrome --print-to-pdf` CLI flag, which can't
render custom headers/footers.

A cross-reference to another doc (`docs/database.md` in the Markdown) is
rewritten differently depending on which build it ends up in: inside the
combined PDF it becomes an in-page jump (`#database`); inside a
standalone per-doc PDF it becomes a link to that doc's own numbered PDF
filename (`02-database.pdf`), since there's no shared page to jump to.

To change the design (colors, fonts, cover layout), edit the CSS in
`baseStyles()`/`coverStyles()`/`headerTemplate()`/`footerTemplate()` in
`generate.js` - everything is inline, no separate stylesheet to keep in
sync.
