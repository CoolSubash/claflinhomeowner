"use client";

import { useState, type FormEvent } from "react";

import { Spinner } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";
import type { Assessment } from "@/lib/types";

interface AssessmentFormProps {
  assessment: Assessment;
  onSaved: (updated: Assessment) => void;
}

interface FieldState {
  income: string;
  monthly_debt: string;
  credit_score: string;
  savings: string;
  down_payment: string;
  target_home_price: string;
  employment_years: string;
  location: string;
}

function toFieldState(assessment: Assessment): FieldState {
  return {
    income: assessment.income ?? "",
    monthly_debt: assessment.monthly_debt ?? "",
    credit_score: assessment.credit_score?.toString() ?? "",
    savings: assessment.savings ?? "",
    down_payment: assessment.down_payment ?? "",
    target_home_price: assessment.target_home_price ?? "",
    employment_years: assessment.employment_years ?? "",
    location: assessment.location ?? "",
  };
}

// Converts a raw input string to the JSON value the backend expects for a
// given field, or null for an empty input (see docs/assessments.md - PATCH
// treats a null field as "leave unchanged", it can't clear one back out).
function toPayload(fields: FieldState): Record<string, string | number | null> {
  const money = (value: string) => (value.trim() === "" ? null : Number(value).toFixed(2));
  return {
    income: money(fields.income),
    monthly_debt: money(fields.monthly_debt),
    credit_score: fields.credit_score.trim() === "" ? null : Number(fields.credit_score),
    savings: money(fields.savings),
    down_payment: money(fields.down_payment),
    target_home_price: money(fields.target_home_price),
    employment_years: fields.employment_years.trim() === "" ? null : Number(fields.employment_years).toFixed(1),
    location: fields.location.trim() === "" ? null : fields.location.trim(),
  };
}

const MONEY_FIELDS: { key: keyof FieldState; label: string; required: boolean }[] = [
  { key: "income", label: "Annual income", required: true },
  { key: "monthly_debt", label: "Monthly debt payments", required: true },
  { key: "savings", label: "Total savings", required: true },
  { key: "down_payment", label: "Planned down payment", required: true },
  { key: "target_home_price", label: "Target home price", required: true },
];

export function AssessmentForm({ assessment, onSaved }: AssessmentFormProps) {
  const { getAccessToken } = useAuth();
  const [fields, setFields] = useState<FieldState>(toFieldState(assessment));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const setField = (key: keyof FieldState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFields((prev) => ({ ...prev, [key]: event.target.value }));
    setSavedAt(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const token = getAccessToken();
    if (!token) {
      setError("Your session expired - please sign in again.");
      setSaving(false);
      return;
    }

    const response = await fetch(`/api/assessments/${assessment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(toPayload(fields)),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(typeof data?.detail === "string" ? data.detail : "Unable to save your changes.");
      return;
    }

    setSavedAt(Date.now());
    onSaved(data as Assessment);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {MONEY_FIELDS.map(({ key, label, required }) => (
          <div key={key}>
            <label htmlFor={key} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-400">
                $
              </span>
              <input
                id={key}
                type="number"
                min={key === "target_home_price" ? 0.01 : 0}
                step="0.01"
                value={fields[key]}
                onChange={setField(key)}
                placeholder="0.00"
                className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white dark:focus:ring-white"
              />
            </div>
          </div>
        ))}

        <div>
          <label htmlFor="credit_score" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Credit score <span className="text-red-500">*</span>
          </label>
          <input
            id="credit_score"
            type="number"
            min={300}
            max={850}
            step={1}
            value={fields.credit_score}
            onChange={setField("credit_score")}
            placeholder="300–850"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white dark:focus:ring-white"
          />
        </div>

        <div>
          <label htmlFor="employment_years" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Years at current employment <span className="text-red-500">*</span>
          </label>
          <input
            id="employment_years"
            type="number"
            min={0}
            max={999.9}
            step="0.1"
            value={fields.employment_years}
            onChange={setField("employment_years")}
            placeholder="0.0"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white dark:focus:ring-white"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="location" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Location <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="location"
            type="text"
            maxLength={255}
            value={fields.location}
            onChange={setField("location")}
            placeholder="City, State"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white dark:focus:ring-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {saving && <Spinner className="h-4 w-4" />}
          {saving ? "Saving..." : "Save draft"}
        </button>
        {savedAt && <span className="text-xs text-slate-400">Saved</span>}
      </div>
    </form>
  );
}
