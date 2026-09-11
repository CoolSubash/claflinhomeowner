"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AssessmentForm } from "@/components/assessments/AssessmentForm";
import { Spinner } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";
import { formatMoney, formatYears } from "@/lib/format";
import type { Assessment } from "@/lib/types";

const REQUIRED_FIELDS: (keyof Assessment)[] = [
  "income",
  "monthly_debt",
  "credit_score",
  "savings",
  "down_payment",
  "target_home_price",
  "employment_years",
];

function isReadyToSubmit(assessment: Assessment): boolean {
  return REQUIRED_FIELDS.every((field) => assessment[field] !== null);
}

export default function AssessmentDetailPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const { getAccessToken } = useAuth();
  const router = useRouter();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [hasResult, setHasResult] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = getAccessToken();
      if (!token) {
        setLoadError("Your session expired - please sign in again.");
        return;
      }
      const response = await fetch(`/api/assessments/${assessmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setLoadError(typeof data?.detail === "string" ? data.detail : "Unable to load this assessment.");
        return;
      }
      const loaded = data as Assessment;
      setAssessment(loaded);

      if (loaded.status !== "DRAFT") {
        const resultResponse = await fetch(`/api/assessments/${assessmentId}/result`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!cancelled) setHasResult(resultResponse.ok);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [assessmentId, getAccessToken]);

  const handleSubmitAndScore = async () => {
    const token = getAccessToken();
    if (!token || !assessment) return;

    setSubmitting(true);
    setSubmitError(null);

    const submitResponse = await fetch(`/api/assessments/${assessment.id}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const submitData = await submitResponse.json();

    if (!submitResponse.ok) {
      setSubmitting(false);
      setSubmitError(
        typeof submitData?.detail === "string" ? submitData.detail : "Unable to submit this assessment."
      );
      return;
    }

    const scoreResponse = await fetch(`/api/assessments/${assessment.id}/score`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    setSubmitting(false);

    if (!scoreResponse.ok) {
      // Submitted successfully, but scoring failed - the "Score this
      // assessment" retry button (rendered below once hasResult is false)
      // covers this case.
      setAssessment(submitData as Assessment);
      setHasResult(false);
      setSubmitError("Submitted, but scoring failed. You can retry below.");
      return;
    }

    router.push(`/results/${assessment.id}`);
  };

  const handleRetryScore = async () => {
    const token = getAccessToken();
    if (!token || !assessment) return;
    setSubmitting(true);
    setSubmitError(null);

    const response = await fetch(`/api/assessments/${assessment.id}/score`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json();
      setSubmitError(typeof data?.detail === "string" ? data.detail : "Unable to score this assessment.");
      return;
    }
    setHasResult(true);
    router.push(`/results/${assessment.id}`);
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-slate-600 dark:text-slate-400">{loadError}</p>
        <Link href="/assessments" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Back to assessments
        </Link>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-6 w-6 text-slate-400" />
      </div>
    );
  }

  const isDraft = assessment.status === "DRAFT";
  const readyToSubmit = isReadyToSubmit(assessment);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/assessments" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        ← My assessments
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {isDraft ? "Your assessment" : "Assessment details"}
        </h1>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {assessment.status}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {isDraft
          ? "Fill in your financial details, then submit to get your HomeReady score."
          : "This assessment has been submitted and can no longer be edited."}
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        {isDraft ? (
          <AssessmentForm assessment={assessment} onSaved={setAssessment} />
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Annual income</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{formatMoney(assessment.income)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Monthly debt</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{formatMoney(assessment.monthly_debt)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Credit score</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{assessment.credit_score ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Savings</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{formatMoney(assessment.savings)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Down payment</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{formatMoney(assessment.down_payment)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Target home price</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{formatMoney(assessment.target_home_price)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Employment</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{formatYears(assessment.employment_years)}</dd>
            </div>
            {assessment.location && (
              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400">Location</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{assessment.location}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {submitError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-400"
        >
          {submitError}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {isDraft && (
          <>
            <button
              type="button"
              onClick={handleSubmitAndScore}
              disabled={!readyToSubmit || submitting}
              className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Spinner className="h-4 w-4" />}
              {submitting ? "Submitting..." : "Submit & get my score"}
            </button>
            {!readyToSubmit && (
              <span className="text-xs text-slate-400">Fill in every required field first.</span>
            )}
          </>
        )}

        {!isDraft && hasResult === false && (
          <button
            type="button"
            onClick={handleRetryScore}
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Spinner className="h-4 w-4" />}
            Score this assessment
          </button>
        )}

        {!isDraft && hasResult === true && (
          <Link
            href={`/results/${assessment.id}`}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            View my results
          </Link>
        )}

        {!isDraft && hasResult === null && <Spinner className="h-5 w-5 text-slate-400" />}
      </div>
    </div>
  );
}
