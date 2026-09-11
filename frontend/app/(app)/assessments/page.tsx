"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ChartIcon, Spinner } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";
import { formatMoney } from "@/lib/format";
import type { Assessment } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  SUBMITTED: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  PROCESSING: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  COMPLETED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  FAILED: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
};

export default function AssessmentsPage() {
  const { getAccessToken } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = getAccessToken();
      if (!token) {
        setError("Your session expired - please sign in again.");
        return;
      }
      const response = await fetch("/api/assessments", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setError(typeof data?.detail === "string" ? data.detail : "Unable to load your assessments.");
        return;
      }
      setAssessments(data as Assessment[]);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Assessments</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Every home-readiness assessment you&apos;ve started, draft or submitted.
          </p>
        </div>
        <Link
          href="/assessments/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          New assessment
        </Link>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {!error && assessments === null && (
        <div className="mt-10 flex justify-center">
          <Spinner className="h-6 w-6 text-slate-400" />
        </div>
      )}

      {!error && assessments !== null && assessments.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <ChartIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            You haven&apos;t started an assessment yet.
          </p>
          <Link
            href="/assessments/new"
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Start your first assessment
          </Link>
        </div>
      )}

      {!error && assessments !== null && assessments.length > 0 && (
        <ul className="mt-6 space-y-2">
          {assessments.map((assessment) => (
            <li key={assessment.id}>
              <Link
                href={`/assessments/${assessment.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
              >
                <div>
                  <div className="font-medium text-slate-800 dark:text-slate-100">
                    {assessment.target_home_price
                      ? `Target: ${formatMoney(assessment.target_home_price)}`
                      : "Untitled draft"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(assessment.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[assessment.status] ?? "bg-slate-100 text-slate-600"}`}
                >
                  {assessment.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
