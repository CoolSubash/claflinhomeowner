"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Spinner } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";
import { categoryLabel, PRIORITY_STYLES, READINESS_LEVEL_STYLES, readinessLevelLabel } from "@/lib/readiness";
import type { ReadinessResult, Recommendation } from "@/lib/types";

const WEAK_AREA_LIMIT = 2;
// Mirrors the backend's recommendation threshold (backend/app/services/
// recommendations.py::_RECOMMENDATION_THRESHOLD) - a category at or above
// this is already "Ready", so it's never worth calling out as an area to
// focus on even if it happens to be the lowest of an otherwise-perfect set.
const WEAK_AREA_SCORE_CEILING = 75;

export default function ResultsPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const { getAccessToken } = useAuth();

  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = getAccessToken();
      if (!token) {
        setError("Your session expired - please sign in again.");
        setLoading(false);
        return;
      }

      const resultResponse = await fetch(`/api/assessments/${assessmentId}/result`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const resultData = await resultResponse.json();

      if (cancelled) return;

      if (!resultResponse.ok) {
        setError(
          typeof resultData?.detail === "string"
            ? resultData.detail
            : "Unable to load this readiness result."
        );
        setLoading(false);
        return;
      }

      setResult(resultData as ReadinessResult);

      const recResponse = await fetch(`/api/readiness-results/${resultData.id}/recommendations`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!cancelled && recResponse.ok) {
        setRecommendations((await recResponse.json()) as Recommendation[]);
      }
      if (!cancelled) setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [assessmentId, getAccessToken]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-6 w-6 text-slate-400" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {error ?? "This assessment doesn't have a readiness result yet."}
        </p>
        <Link
          href="/history"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Back to history
        </Link>
      </div>
    );
  }

  const weakAreas = [...result.components]
    .filter((component) => component.score < WEAK_AREA_SCORE_CEILING)
    .sort((a, b) => a.score - b.score)
    .slice(0, WEAK_AREA_LIMIT);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/history" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        ← My progress
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">Home Readiness</h1>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-5xl font-bold text-slate-900 dark:text-white">
          {result.overall_score}
          <span className="text-xl font-medium text-slate-400"> / 100</span>
        </div>
        <span
          className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${READINESS_LEVEL_STYLES[result.readiness_level] ?? "bg-slate-100 text-slate-700"}`}
        >
          {readinessLevelLabel(result.readiness_level)}
        </span>
        <p className="mt-2 text-xs text-slate-400">
          Scoring methodology {result.scoring_version} · {new Date(result.created_at).toLocaleDateString()}
        </p>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Score Breakdown</h2>
        <div className="mt-4 space-y-4">
          {result.components.map((component) => (
            <div key={component.category}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {categoryLabel(component.category)}
                </span>
                <span className="text-slate-500 dark:text-slate-400">{component.score}/100</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={component.score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${categoryLabel(component.category)} score`}
                className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
              >
                <div
                  className="h-full rounded-full bg-indigo-600"
                  style={{ width: `${component.score}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{component.explanation}</p>
            </div>
          ))}
        </div>
      </section>

      {weakAreas.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Areas to Focus On</h2>
          <ol className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {weakAreas.map((area, index) => (
              <li key={area.category}>
                {index + 1}. {categoryLabel(area.category)}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recommendations</h2>
        {recommendations.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            No specific recommendations right now - every category is performing at or above the
            HomeReady methodology&apos;s &ldquo;Ready&rdquo; benchmark.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recommendations.map((rec) => (
              <li
                key={rec.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[rec.priority] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {rec.priority}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {rec.title}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{rec.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href={`/chat?assessmentId=${assessmentId}`}
        className="mt-8 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
      >
        Discuss these results with the AI assistant
      </Link>

      <p className="mt-6 rounded-xl bg-slate-100 p-4 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        The HomeReady score is an educational readiness indicator based on HomeReady&apos;s own
        methodology. It is not a mortgage approval, credit score, or guarantee of loan eligibility.
      </p>
    </div>
  );
}
