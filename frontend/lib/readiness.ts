// Display-only mappings for the backend's snake_case/enum values. Never
// used to compute or alter a score - purely presentational (CLAUDE.md
// section 24: the frontend only displays backend results).
export const CATEGORY_LABELS: Record<string, string> = {
  financial_stability: "Financial Stability",
  debt_management: "Debt Management",
  credit: "Credit",
  down_payment: "Down Payment",
  savings: "Savings",
  employment_stability: "Employment Stability",
};

export const READINESS_LEVEL_LABELS: Record<string, string> = {
  NOT_READY: "Not Ready",
  NEEDS_IMPROVEMENT: "Needs Improvement",
  ALMOST_READY: "Almost Ready",
  READY: "Ready",
  HIGHLY_READY: "Highly Ready",
};

export const READINESS_LEVEL_STYLES: Record<string, string> = {
  NOT_READY: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  NEEDS_IMPROVEMENT: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  ALMOST_READY: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400",
  READY: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  HIGHLY_READY: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400",
};

export const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  MEDIUM: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function readinessLevelLabel(level: string): string {
  return READINESS_LEVEL_LABELS[level] ?? level;
}
