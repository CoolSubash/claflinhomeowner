// Small hand-authored inline SVG (no external image request, no binary
// asset) - a house-and-checkmark motif that fits "home-buying readiness"
// without depicting anyone. Uses the same indigo/slate palette as the
// rest of the UI so it reads as one system in both themes.
export function AuthIllustration() {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      className="h-auto w-full max-w-sm"
      role="img"
      aria-label="Illustration of a house with a readiness checkmark"
    >
      <circle cx="200" cy="200" r="180" className="fill-indigo-50 dark:fill-slate-800/60" />
      <path
        d="M120 210 L200 140 L280 210 V300 A8 8 0 0 1 272 308 H128 A8 8 0 0 1 120 300 Z"
        className="fill-white stroke-indigo-600 dark:fill-slate-900 dark:stroke-indigo-400"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path
        d="M104 222 L200 138 L296 222"
        className="stroke-indigo-600 dark:stroke-indigo-400"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="178"
        y="240"
        width="44"
        height="68"
        rx="4"
        className="fill-indigo-100 stroke-indigo-600 dark:fill-slate-800 dark:stroke-indigo-400"
        strokeWidth="4"
      />
      <circle cx="240" cy="260" r="34" className="fill-emerald-500 dark:fill-emerald-400" />
      <path
        d="M225 260 L236 271 L257 248"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
