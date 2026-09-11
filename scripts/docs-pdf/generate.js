#!/usr/bin/env node
"use strict";

// Builds every file listed in DOC_GROUPS (docs/*.md) into one ordered
// HTML document, then shells out to a locally installed Chrome/Chromium
// to print that HTML to a single PDF. No browser-automation package is
// installed for this (no Puppeteer/Playwright dependency) - Chrome's own
// `--headless --print-to-pdf` flag does the whole job with zero extra
// npm weight beyond a markdown parser.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const { marked } = require("marked");

const DOCS_DIR = path.resolve(__dirname, "..", "..", "docs");
const BUILD_DIR = path.join(DOCS_DIR, "_build");
const HTML_PATH = path.join(BUILD_DIR, "full-documentation.html");
const PDF_PATH = path.join(BUILD_DIR, "HomeReady-AI-Documentation.pdf");

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

const ALL_SLUGS = DOC_GROUPS.flatMap((g) => g.docs.map((d) => d.slug));

// Rewrites cross-references like `docs/database.md`, `./database.md`, or
// `database.md#some-heading` into an in-document anchor (`#database`) so
// links still work once everything is concatenated into one file. This
// only resolves to the top of the target document, not a specific
// heading within it - good enough for "jump to that doc."
function rewriteLinks(markdown) {
  const pattern = new RegExp(
    `\\]\\((?:\\.\\/|docs\\/)?(${ALL_SLUGS.join("|")})\\.md(#[^)]*)?\\)`,
    "g"
  );
  return markdown.replace(pattern, (_match, slug) => `](#${slug})`);
}

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const platform = os.platform();

  if (platform === "darwin") {
    const candidates = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
    return candidates.find((c) => fs.existsSync(c)) || null;
  }

  if (platform === "win32") {
    const candidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    return candidates.find((c) => fs.existsSync(c)) || null;
  }

  // linux and everything else: look up common binary names on PATH
  const names = ["google-chrome-stable", "google-chrome", "chromium-browser", "chromium"];
  for (const name of names) {
    try {
      const resolved = execSync(`command -v ${name}`, { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
      if (resolved) return resolved;
    } catch {
      // not found under this name - try the next one
    }
  }
  return null;
}

function buildHtml() {
  const generatedAt = new Date().toISOString().slice(0, 10);

  const toc = DOC_GROUPS.map(
    (group) => `
      <li class="toc-section">${group.section}
        <ul>
          ${group.docs.map((d) => `<li><a href="#${d.slug}">${d.title}</a></li>`).join("\n")}
        </ul>
      </li>`
  ).join("\n");

  const body = DOC_GROUPS.map((group) =>
    group.docs
      .map((doc) => {
        const filePath = path.join(DOCS_DIR, `${doc.slug}.md`);
        if (!fs.existsSync(filePath)) {
          console.warn(`Skipping ${doc.slug}: ${filePath} not found`);
          return "";
        }
        const raw = fs.readFileSync(filePath, "utf8");
        const html = marked.parse(rewriteLinks(raw));
        return `<section id="${doc.slug}" class="doc">${html}</section>`;
      })
      .join("\n")
  ).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>HomeReady AI - Documentation</title>
<style>
  @page { margin: 18mm 16mm; }
  body {
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #1e293b;
    line-height: 1.55;
    font-size: 10.5pt;
  }
  h1, h2, h3, h4 { color: #0f172a; line-height: 1.25; }
  h1 { font-size: 20pt; margin-top: 0; }
  h2 { font-size: 15pt; margin-top: 1.6em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.2em; }
  h3 { font-size: 12.5pt; margin-top: 1.4em; }
  code {
    font-family: "SF Mono", Menlo, Consolas, monospace;
    background: #f1f5f9;
    padding: 0.1em 0.35em;
    border-radius: 3px;
    font-size: 0.92em;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: 0.9em 1em;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 9pt;
  }
  pre code { background: none; color: inherit; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 9.5pt; }
  th, td { border: 1px solid #cbd5e1; padding: 0.4em 0.6em; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  a { color: #4338ca; text-decoration: none; }
  blockquote { border-left: 3px solid #c7d2fe; margin-left: 0; padding-left: 1em; color: #475569; }

  .cover { text-align: center; padding-top: 30vh; page-break-after: always; }
  .cover h1 { font-size: 30pt; margin-bottom: 0.2em; }
  .cover p { color: #64748b; }

  .toc { page-break-after: always; }
  .toc ul { list-style: none; padding-left: 0; }
  .toc-section { font-weight: 600; margin-top: 1em; }
  .toc-section ul { padding-left: 1.4em; font-weight: 400; margin-top: 0.4em; }
  .toc-section li { margin: 0.25em 0; }

  .doc { page-break-before: always; }
  .doc:first-of-type { page-break-before: avoid; }
</style>
</head>
<body>
  <div class="cover">
    <h1>HomeReady AI</h1>
    <p>Project Documentation</p>
    <p>Generated ${generatedAt}</p>
  </div>

  <div class="toc">
    <h2>Contents</h2>
    <ul>${toc}</ul>
  </div>

  ${body}
</body>
</html>`;
}

function main() {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.writeFileSync(HTML_PATH, buildHtml(), "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), HTML_PATH)}`);

  const chrome = findChrome();
  if (!chrome) {
    console.error(
      "\nCould not find Google Chrome/Chromium/Edge on this machine.\n" +
        "Install one of those, or set CHROME_PATH to a browser binary, then re-run.\n" +
        `The combined HTML is still available at ${HTML_PATH} if you want to print it yourself.`
    );
    process.exit(1);
  }

  const fileUrl = "file://" + HTML_PATH;
  const result = spawnSync(
    chrome,
    ["--headless", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${PDF_PATH}`, fileUrl],
    // Chrome's headless mode is chatty on stderr (display-link warnings,
    // etc.) even on success - only surface it if the run actually failed.
    { stdio: ["ignore", "inherit", "pipe"] }
  );

  if (result.status !== 0) {
    console.error("Chrome exited with an error while generating the PDF.");
    if (result.stderr) console.error(result.stderr.toString());
    process.exit(result.status || 1);
  }

  console.log(`Wrote ${path.relative(process.cwd(), PDF_PATH)}`);
}

main();
