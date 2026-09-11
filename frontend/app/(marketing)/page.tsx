"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ChartIcon, ChatIcon, ShieldIcon, TrackIcon } from "@/components/icons";
import { Testimonials } from "@/components/Testimonials";
import { useAuth } from "@/hooks/use-auth";

const FEATURES = [
  {
    icon: ChartIcon,
    title: "A transparent score",
    body: "Your readiness score is a deterministic breakdown across six categories - financial stability, debt, down payment, credit, savings, and employment - so you know exactly what's moving it.",
  },
  {
    icon: TrackIcon,
    title: "Track your progress",
    body: "Every assessment is saved with the scoring version it was calculated under, so your history stays accurate even as the methodology improves.",
  },
  {
    icon: ChatIcon,
    title: "AI-powered explanations",
    body: "Ask why your score changed or what to focus on next. The AI explains your results - it never decides them.",
  },
  {
    icon: ShieldIcon,
    title: "Built with security first",
    body: "Passwords are hashed with Argon2id, sessions use short-lived tokens with automatic rotation, and your data is never visible to another account.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Enter your financials",
    body: "Income, monthly debt, savings, credit score, and your target home price - takes a few minutes.",
  },
  {
    step: "02",
    title: "Get your readiness score",
    body: "See an overall score from 0-100, plus a full breakdown of every category behind it.",
  },
  {
    step: "03",
    title: "Follow your recommendations",
    body: "Each category comes with clear, prioritized guidance on what would move your score the most.",
  },
];

export default function HomePage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              Home-buying readiness, made clear
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              Know exactly how ready you are to buy a home
            </h1>
            <p className="mt-5 max-w-lg text-lg text-slate-600 dark:text-slate-400">
              HomeReady AI turns your income, debt, savings, and credit into one clear readiness
              score - with a transparent breakdown and a plan to improve it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                Get started for free
              </Link>
              <Link
                href="/about"
                className="rounded-lg px-6 py-3 text-sm font-semibold text-slate-700 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                See how scoring works →
              </Link>
            </div>
          </div>

          {/* Illustrative example card - not live data */}
          <div className="relative">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Example assessment
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  READY
                </span>
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-5xl font-bold text-slate-900 dark:text-white">78</span>
                <span className="mb-1.5 text-sm text-slate-400">/ 100</span>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  { label: "Financial stability", value: 82 },
                  { label: "Debt management", value: 70 },
                  { label: "Down payment", value: 65 },
                  { label: "Credit", value: 88 },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>{row.label}</span>
                      <span>{row.value}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-1.5 rounded-full bg-indigo-600"
                        style={{ width: `${row.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-100 bg-slate-50 py-16 dark:border-slate-900 dark:bg-slate-950/50 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Everything you need to plan your next move
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              No guesswork, no black box - just a clear methodology and your own data.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <feature.icon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            How it works
          </h2>

          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((item) => (
              <div key={item.step}>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {item.step}
                </span>
                <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Testimonials />

      {/* CTA banner */}
      <section className="border-t border-slate-100 dark:border-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-indigo-600 px-6 py-10 text-center sm:flex-row sm:px-10 sm:text-left">
            <div>
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                Ready to see where you stand?
              </h2>
              <p className="mt-2 text-sm text-indigo-100">
                Create a free account and get your first readiness score in minutes.
              </p>
            </div>
            <Link
              href="/register"
              className="shrink-0 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
