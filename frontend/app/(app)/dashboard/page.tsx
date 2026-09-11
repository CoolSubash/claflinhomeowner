"use client";

import Link from "next/link";

import { useAuth } from "@/hooks/use-auth";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        Welcome back, {user.first_name}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Here&apos;s a quick look at your account.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Account overview
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Email</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">
                {user.email}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Email verified</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">
                {user.email_verified ? "Yes" : "No"}
              </dd>
            </div>
          </dl>
          <Link
            href="/profile"
            className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            View full profile →
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Your readiness</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Start an assessment to get your HomeReady score, then track your progress over time.
          </p>
          <Link
            href="/assessments/new"
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Start an assessment
          </Link>
          <div className="mt-3 flex gap-4">
            <Link
              href="/assessments"
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              My assessments
            </Link>
            <Link
              href="/history"
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              My progress
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
