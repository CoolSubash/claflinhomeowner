# HomeReady AI — Documentation

Read in this order for a complete picture of the system, top to bottom.
Each document owns exactly one concern; when two documents touch the same
topic, one is the source of truth and the other links to it rather than
repeating it.

## 1. System overview

| Doc | Covers |
|---|---|
| [`architecture.md`](architecture.md) | The three-tier system (Next.js / FastAPI / PostgreSQL), why it's split this way, request flow, and how the backend and frontend codebases are laid out |
| [`database.md`](database.md) | The full PostgreSQL schema: every table, its columns, its relationships, and the conventions behind them (UUIDs, ownership columns, migrations) |

## 2. Identity and access

| Doc | Covers |
|---|---|
| [`authentication.md`](authentication.md) | Registration, email verification, login, JWT access tokens, rotating refresh tokens, logout |
| [`authorization.md`](authorization.md) | RBAC (roles → permissions) and per-resource ownership checks - the two layers every protected endpoint enforces, and how they're implemented in code |
| [`api-design.md`](api-design.md) | REST conventions (versioning, errors, pagination) and the full endpoint reference across every resource |

## 3. The product

| Doc | Covers |
|---|---|
| [`assessments.md`](assessments.md) | The financial/home-buying data a user enters, its lifecycle (draft → submitted), and its API |
| [`scoring-methodology.md`](scoring-methodology.md) → [`scoring-v1.md`](scoring-v1.md) | The deterministic readiness-scoring engine: category formulas, weights, versioning, and a worked example |
| [`results.md`](results.md) | Reading a score back: the result/history API and the UI that displays it |
| [`recommendations.md`](recommendations.md) | The deterministic, rule-based engine that turns a score breakdown into actionable recommendations |
| [`ai-architecture.md`](ai-architecture.md) | The AI chat assistant: the provider-agnostic `AIService` abstraction (Bedrock/Anthropic), context construction, data minimization, and prompt-injection defenses |
| [`realtor-onboarding.md`](realtor-onboarding.md) | Invite-only realtor onboarding, the admin/realtor dashboards, and connection-request ownership |

## 4. Operating it

| Doc | Covers |
|---|---|
| [`security.md`](security.md) | A consolidated summary of every security control across the app, with pointers to where each is implemented |
| [`threat-model.md`](threat-model.md) | Concrete attack scenarios, what mitigates each one, and an honest list of what's still open |
| [`deployment.md`](deployment.md) | Running it locally, the recommended production architecture (Vercel + Render + managed Postgres), and what's left before a real deploy |

## Generating PDFs

Every document above can be built into its own designed PDF (cover page,
running header/footer, page numbers), plus one combined PDF with a table
of contents:

```bash
cd scripts/docs-pdf
npm install
npm run build
```

Output lands in `docs/_build/` (gitignored - generated from these
Markdown files, which stay the source of truth), numbered in the same
reading order as this page: `01-architecture.pdf` through
`14-deployment.pdf`, plus `00-HomeReady-AI-Documentation-Complete.pdf`.
See `scripts/docs-pdf/README.md` for how it works and what it requires.

## Conventions used throughout

- **No "Phase N" or spec-citation language.** These documents describe
  the system as it exists today, not the process that built it. What
  something does and why is documented directly; how it was arrived at
  isn't.
- **Honesty about what's not built.** A feature that's planned but not
  implemented is labeled that way explicitly (see `security.md` and
  `threat-model.md`'s "not yet built" rows) rather than omitted or
  implied to exist.
- **One file, one responsibility.** If you're looking for how an
  endpoint's request body is validated, that's the feature's own doc, not
  `api-design.md` (which only maps method + path + permission). If you're
  looking for a table's columns, that's `database.md`, not the feature
  doc that uses the table.
