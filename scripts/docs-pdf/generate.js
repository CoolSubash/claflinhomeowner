#!/usr/bin/env node
"use strict";

// Builds every file in docs/ into a nicely designed PDF - one PDF per
// document (numbered so they sort in reading order) plus one combined
// PDF with a cover page and table of contents. Uses playwright-core
// driving your already-installed Chrome (no bundled-browser download,
// no full `playwright` package) so page.pdf()'s headerTemplate/
// footerTemplate can render real running headers, footers, and page
// numbers - something the plain `chrome --print-to-pdf` CLI flag can't do.

const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const DOCS_DIR = path.resolve(__dirname, "..", "..", "docs");
const BUILD_DIR = path.join(DOCS_DIR, "_build");

const AUTHOR = "Subash Neupane";
const PROJECT_NAME = "HomeReady AI";

// Mirrors docs/README.md's reading order exactly - update both together.
const DOC_GROUPS = [
  {
    section: "System Overview",
    docs: [
      { slug: "architecture", title: "Architecture" },
      { slug: "database", title: "Database" },
    ],
  },
  {
    section: "Identity and Access",
    docs: [
      { slug: "authentication", title: "Authentication" },
      { slug: "authorization", title: "Authorization" },
      { slug: "api-design", title: "API Design" },
    ],
  },
  {
    section: "The Product",
    docs: [
      { slug: "assessments", title: "Assessments" },
      { slug: "scoring-methodology", title: "Scoring Methodology" },
      { slug: "scoring-v1", title: "Scoring v1" },
      { slug: "results", title: "Results" },
      { slug: "recommendations", title: "Recommendations" },
      { slug: "ai-architecture", title: "AI Architecture" },
      { slug: "realtor-onboarding", title: "Realtor Onboarding" },
    ],
  },
  {
    section: "Operating It",
    docs: [
      { slug: "security", title: "Security" },
      { slug: "threat-model", title: "Threat Model" },
      { slug: "deployment", title: "Deployment" },
    ],
  },
];

// Flattened, in order, each with its 1-based position across the whole
// set - this is what numbers the output filenames (01-architecture.pdf, ...).
const ALL_DOCS = DOC_GROUPS.flatMap((group) =>
  group.docs.map((doc) => ({ ...doc, section: group.section }))
).map((doc, index) => ({ ...doc, number: index + 1 }));

const ALL_SLUGS = ALL_DOCS.map((d) => d.slug);

function pad(n) {
  return String(n).padStart(2, "0");
}

// Rewrites cross-references like `docs/database.md`, `./database.md`, or
// `database.md#some-heading` into an in-document anchor (`#database`).
// In a per-doc PDF this only resolves within the combined build (where
// every doc lives in one page); in a standalone per-doc PDF a link like
// this simply won't have a target, which is expected - the reader is
// pointed at another PDF's filename, not a same-page jump.
function rewriteLinksForCombined(markdown) {
  const pattern = new RegExp(
    `\\]\\((?:\\.\\/|docs\\/)?(${ALL_SLUGS.join("|")})\\.md(#[^)]*)?\\)`,
    "g"
  );
  return markdown.replace(pattern, (_match, slug) => `](#${slug})`);
}

// For a standalone per-doc PDF, point a cross-reference at the sibling
// PDF's numbered filename instead, so the link is still meaningful if
// the reader has the whole docs/_build folder open.
function rewriteLinksForStandalone(markdown) {
  const pattern = new RegExp(
    `\\]\\((?:\\.\\/|docs\\/)?(${ALL_SLUGS.join("|")})\\.md(#[^)]*)?\\)`,
    "g"
  );
  return markdown.replace(pattern, (_match, slug) => {
    const target = ALL_DOCS.find((d) => d.slug === slug);
    return `](${pad(target.number)}-${target.slug}.pdf)`;
  });
}

function baseStyles() {
  return `
  @page { margin: 20mm 16mm 16mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #1e293b;
    line-height: 1.55;
    font-size: 10.5pt;
  }
  h1, h2, h3, h4 { color: #0f172a; line-height: 1.25; }
  h1 { font-size: 19pt; margin-top: 0; }
  h2 { font-size: 14pt; margin-top: 1.7em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25em; }
  h3 { font-size: 11.5pt; margin-top: 1.4em; }
  p, li { color: #334155; }
  code {
    font-family: "SF Mono", Menlo, Consolas, monospace;
    background: #f1f5f9;
    padding: 0.1em 0.35em;
    border-radius: 3px;
    font-size: 0.9em;
    color: #4338ca;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: 0.9em 1em;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 8.5pt;
  }
  pre code { background: none; color: inherit; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 9pt; }
  th, td { border: 1px solid #cbd5e1; padding: 0.4em 0.6em; text-align: left; vertical-align: top; }
  th { background: #eef2ff; color: #312e81; }
  tr:nth-child(even) td { background: #f8fafc; }
  a { color: #4338ca; text-decoration: none; }
  blockquote { border-left: 3px solid #c7d2fe; margin-left: 0; padding-left: 1em; color: #475569; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 2em 0; }
  `;
}

function coverHtml({ eyebrow, title, subtitle }) {
  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `
  <div class="cover">
    <div class="cover-mark">H</div>
    <p class="cover-eyebrow">${eyebrow}</p>
    <h1 class="cover-title">${title}</h1>
    ${subtitle ? `<p class="cover-subtitle">${subtitle}</p>` : ""}
    <div class="cover-meta">
      <p><span>Prepared by</span>${AUTHOR}</p>
      <p><span>Generated</span>${generatedAt}</p>
    </div>
  </div>`;
}

function coverStyles() {
  return `
  .cover {
    min-height: 240mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    page-break-after: always;
  }
  .cover-mark {
    width: 56px; height: 56px;
    border-radius: 14px;
    background: linear-gradient(135deg, #4f46e5, #4338ca);
    color: white;
    font-size: 26px;
    font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 28px;
  }
  .cover-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 9pt;
    font-weight: 600;
    color: #6366f1;
    margin: 0 0 10px;
  }
  .cover-title { font-size: 30pt; margin: 0 0 10px; }
  .cover-subtitle { color: #64748b; font-size: 11.5pt; max-width: 120mm; margin: 0 auto; }
  .cover-meta {
    margin-top: 40px;
    border-top: 1px solid #e2e8f0;
    padding-top: 18px;
    font-size: 9.5pt;
    color: #334155;
  }
  .cover-meta p { margin: 4px 0; }
  .cover-meta span { display: inline-block; width: 90px; color: #94a3b8; text-align: right; margin-right: 10px; }
  `;
}

function headerTemplate(docTitle) {
  return `
  <div style="font-size:8px; width:100%; padding:0 16mm; color:#94a3b8; display:flex; justify-content:space-between; font-family: -apple-system, Helvetica, Arial, sans-serif;">
    <span>${PROJECT_NAME}</span>
    <span>${docTitle}</span>
  </div>`;
}

function footerTemplate() {
  return `
  <div style="font-size:8px; width:100%; padding:0 16mm; color:#94a3b8; display:flex; justify-content:space-between; font-family: -apple-system, Helvetica, Arial, sans-serif;">
    <span>Prepared by ${AUTHOR}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;
}

function buildStandaloneHtml(doc) {
  const filePath = path.join(DOCS_DIR, `${doc.slug}.md`);
  const raw = fs.readFileSync(filePath, "utf8");
  const content = marked.parse(rewriteLinksForStandalone(raw));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${doc.title}</title>
<style>${baseStyles()}${coverStyles()}</style>
</head>
<body>
  ${coverHtml({ eyebrow: doc.section, title: doc.title, subtitle: `${PROJECT_NAME} Documentation` })}
  <div class="doc-content">${content}</div>
</body>
</html>`;
}

function buildCombinedHtml() {
  const toc = DOC_GROUPS.map(
    (group) => `
      <li class="toc-section">${group.section}
        <ul>
          ${group.docs.map((d) => `<li><a href="#${d.slug}">${d.title}</a></li>`).join("\n")}
        </ul>
      </li>`
  ).join("\n");

  const body = ALL_DOCS.map((doc) => {
    const filePath = path.join(DOCS_DIR, `${doc.slug}.md`);
    const raw = fs.readFileSync(filePath, "utf8");
    const html = marked.parse(rewriteLinksForCombined(raw));
    return `<section id="${doc.slug}" class="doc">${html}</section>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${PROJECT_NAME} - Documentation</title>
<style>
  ${baseStyles()}
  ${coverStyles()}
  .toc { page-break-after: always; }
  .toc ul { list-style: none; padding-left: 0; }
  .toc-section { font-weight: 600; margin-top: 1em; }
  .toc-section ul { padding-left: 1.4em; font-weight: 400; margin-top: 0.4em; }
  .toc-section li { margin: 0.25em 0; }
  .doc { page-break-before: always; }
</style>
</head>
<body>
  ${coverHtml({ eyebrow: "Complete Reference", title: PROJECT_NAME, subtitle: "Project Documentation" })}
  <div class="toc">
    <h2>Contents</h2>
    <ul>${toc}</ul>
  </div>
  ${body}
</body>
</html>`;
}

async function findBrowser(chromium) {
  if (process.env.CHROME_PATH) {
    return chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  }
  const channels = ["chrome", "chromium", "msedge"];
  for (const channel of channels) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      // try the next channel
    }
  }
  throw new Error(
    "Could not launch Google Chrome, Chromium, or Edge.\n" +
      "Install one of those, or set CHROME_PATH to a browser binary, then re-run."
  );
}

async function printPdf(page, html, outPath, { docTitle, cover }) {
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.pdf({
    path: outPath,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: headerTemplate(docTitle),
    footerTemplate: footerTemplate(),
    margin: { top: "20mm", bottom: "16mm", left: "0mm", right: "0mm" },
  });
}

async function main() {
  fs.mkdirSync(BUILD_DIR, { recursive: true });

  const { chromium } = require("playwright-core");
  const browser = await findBrowser(chromium);
  const page = await browser.newPage();

  for (const doc of ALL_DOCS) {
    const html = buildStandaloneHtml(doc);
    const outName = `${pad(doc.number)}-${doc.slug}.pdf`;
    const outPath = path.join(BUILD_DIR, outName);
    await printPdf(page, html, outPath, { docTitle: doc.title });
    console.log(`Wrote docs/_build/${outName}`);
  }

  const combinedHtml = buildCombinedHtml();
  const combinedName = "00-HomeReady-AI-Documentation-Complete.pdf";
  await printPdf(page, combinedHtml, path.join(BUILD_DIR, combinedName), {
    docTitle: "Complete Reference",
  });
  console.log(`Wrote docs/_build/${combinedName}`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
