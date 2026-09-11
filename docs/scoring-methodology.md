# Scoring Methodology

HomeReady's readiness score is deterministic and versioned: every result
is calculated under a specific, immutable scoring
version, and a past result never silently changes when the methodology is
later revised.

The current version is **v1** - see [`docs/scoring-v1.md`](scoring-v1.md)
for the full category formulas, weights, readiness-level thresholds, edge
case handling, and a complete worked example.

As new scoring versions are introduced (`v2`, ...), each gets its own
`docs/scoring-vN.md` alongside this file, and this page will index them.
