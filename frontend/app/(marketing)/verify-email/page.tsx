"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/icons";

type VerifyState = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailFallback() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Spinner className="mx-auto h-6 w-6 text-slate-400" />
      </div>
    </div>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<VerifyState>(token ? "verifying" : "error");
  const [message, setMessage] = useState<string | null>(
    token ? null : "This verification link is missing its token."
  );
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current || !token) return;
    requested.current = true;

    const verify = async () => {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!response.ok) {
        setState("error");
        setMessage(
          typeof data?.detail === "string" ? data.detail : "This verification link is invalid or has expired."
        );
        return;
      }

      setState("success");
    };

    void verify();
  }, [token]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {state === "verifying" && (
          <>
            <Spinner className="mx-auto h-6 w-6 text-slate-400" />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Verifying your email...</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-emerald-600 dark:text-emerald-400">
                <path
                  d="m5 13 4 4L19 7"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Email verified</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Your account is active. You can sign in now.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Sign in
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Verification failed</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
