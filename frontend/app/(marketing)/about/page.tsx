import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About - HomeReady AI",
  description: "What HomeReady AI is, how the readiness score works, and what it isn't.",
};

const CATEGORIES = [
  { name: "Financial stability", weight: "25%" },
  { name: "Debt management", weight: "20%" },
  { name: "Down payment", weight: "20%" },
  { name: "Credit", weight: "15%" },
  { name: "Savings", weight: "10%" },
  { name: "Employment stability", weight: "10%" },
];

const STATUSES = [
  { range: "0 - 39", label: "Not ready" },
  { range: "40 - 59", label: "Needs improvement" },
  { range: "60 - 74", label: "Almost ready" },
  { range: "75 - 89", label: "Ready" },
  { range: "90 - 100", label: "Highly ready" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">About</span>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        A clear answer to &ldquo;am I ready to buy a home?&rdquo;
      </h1>
      <p className="mt-5 text-lg text-slate-600 dark:text-slate-400">
        Most people figure out whether they&apos;re ready to buy a home by piecing together advice from
        a dozen different sources. HomeReady AI exists to give you one place to put in your actual
        numbers and get a single, explainable answer - plus a plan for what to do next.
      </p>

      <div className="mt-12 space-y-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          How the readiness score works
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Your score is calculated deterministically from six weighted categories. There&apos;s no
          hidden model deciding your outcome - the same inputs always produce the same score under
          a given scoring version.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {CATEGORIES.map((category) => (
              <tr key={category.name}>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{category.name}</td>
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                  {category.weight}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Each category scores 0-100, and the weighted sum is your overall score, also 0-100, which
        maps to one of five readiness statuses:
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATUSES.map((status) => (
          <div
            key={status.label}
            className="rounded-xl border border-slate-200 px-3 py-3 text-center dark:border-slate-800"
          >
            <div className="text-xs text-slate-400">{status.range}</div>
            <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
              {status.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        These weights and thresholds are our own product methodology, not a universal financial
        or lending standard, and they aren&apos;t mortgage, legal, or financial advice. Every scoring
        version is preserved, so a past result never silently changes when the methodology is
        updated.
      </div>

      <div className="mt-12 space-y-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Where AI fits in
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          An AI assistant helps explain your results in plain language and answers questions about
          your own assessment history - for example, why your score moved between two dates. It
          only ever explains a score that&apos;s already been calculated; it never sets or adjusts the
          score itself.
        </p>
      </div>

      <div className="mt-12 space-y-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Your data stays yours
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Every assessment, score, and document belongs to the account that created it. Access is
          checked on every request, not just hidden in the interface - see our{" "}
          <a href="/privacy" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Privacy Policy
          </a>{" "}
          for the details.
        </p>
      </div>
    </div>
  );
}
