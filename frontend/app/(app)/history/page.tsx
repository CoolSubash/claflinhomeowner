"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Spinner, TrackIcon } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";
import { READINESS_LEVEL_STYLES, readinessLevelLabel } from "@/lib/readiness";
import type { ReadinessResultSummary } from "@/lib/types";

export default function HistoryPage() {
  const { getAccessToken } = useAuth();
  const [results, setResults] = useState<ReadinessResultSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = getAccessToken();
      if (!token) {
        setError("Your session expired - please sign in again.");
        return;
      }
      const response = await fetch("/api/readiness-results", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (cancelled) return;

      if (!response.ok) {
        setError(typeof data?.detail === "string" ? data.detail : "Unable to load your history.");
        return;
      }
      setResults(data as ReadinessResultSummary[]);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  const oldestFirst = results ? [...results].reverse() : [];
  const first = oldestFirst[0];
  const latest = oldestFirst[oldestFirst.length - 1];
  const change = first && latest && first.id !== latest.id ? latest.overall_score - first.overall_score : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Progress</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Your readiness score over time, across every assessment you&apos;ve submitted.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {!error && results === null && (
        <div className="mt-10 flex justify-center">
          <Spinner className="h-6 w-6 text-slate-400" />
        </div>
      )}

      {!error && results !== null && results.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          You don&apos;t have any scored assessments yet.
        </div>
      )}

      {!error && results !== null && results.length > 0 && (
        <>
          {change !== null && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <TrackIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Your score {change >= 0 ? "increased" : "decreased"} by{" "}
                <span className="font-semibold">{Math.abs(change)} points</span> since your first
                scored assessment ({first.overall_score} → {latest.overall_score}).
              </p>
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {results.map((result) => (
                  <tr key={result.id} className="bg-white dark:bg-slate-900">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {new Date(result.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {result.overall_score}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${READINESS_LEVEL_STYLES[result.readiness_level] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {readinessLevelLabel(result.readiness_level)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/results/${result.assessment_id}`}
                        className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
