"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";

import { EyeIcon, EyeOffIcon, Spinner } from "@/components/icons";
import type { RealtorInviteLookup } from "@/lib/types";

type Stage = "loading" | "new-account" | "existing-account" | "success" | "error";

export default function OnboardRealtorPage() {
  return (
    <Suspense fallback={<CardShell><Spinner className="mx-auto h-6 w-6 text-slate-400" /></CardShell>}>
      <OnboardRealtorContent />
    </Suspense>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {children}
      </div>
    </div>
  );
}

function OnboardRealtorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [stage, setStage] = useState<Stage>(token ? "loading" : "error");
  const [lookup, setLookup] = useState<RealtorInviteLookup | null>(null);
  const [message, setMessage] = useState<string | null>(token ? null : "This invitation link is missing its token.");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current || !token) return;
    requested.current = true;

    const run = async () => {
      const response = await fetch("/api/realtor-invitations/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStage("error");
        setMessage(typeof data?.detail === "string" ? data.detail : "This invitation link is invalid or has expired.");
        return;
      }

      setLookup(data as RealtorInviteLookup);
      setStage(data.account_exists ? "existing-account" : "new-account");
    };

    void run();
  }, [token]);

  const acceptInvite = async (body: Record<string, string>) => {
    setSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/realtor-invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...body }),
    });
    const data = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setMessage(typeof data?.detail === "string" ? data.detail : "Unable to complete onboarding.");
      return;
    }

    setStage("success");
    setTimeout(() => router.push("/login"), 2500);
  };

  const handleNewAccountSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void acceptInvite({ first_name: firstName, last_name: lastName, password });
  };

  if (stage === "loading") {
    return (
      <CardShell>
        <Spinner className="mx-auto h-6 w-6 text-slate-400" />
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Checking your invitation...</p>
      </CardShell>
    );
  }

  if (stage === "error") {
    return (
      <CardShell>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Invitation not valid</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Back to sign in
        </Link>
      </CardShell>
    );
  }

  if (stage === "success") {
    return (
      <CardShell>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">You&apos;re all set</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Your realtor access is active. Redirecting you to sign in...
        </p>
      </CardShell>
    );
  }

  if (stage === "existing-account") {
    return (
      <CardShell>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Confirm realtor access</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          You already have a HomeReady AI account with{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">{lookup?.email}</span>. Confirm
          below to add realtor access - you&apos;ll keep signing in with your existing password.
        </p>
        {message && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={() => void acceptInvite({})}
          disabled={submitting}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? "Confirming..." : "Confirm & link my account"}
        </button>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Set up your realtor account</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Onboarding <span className="font-medium text-slate-700 dark:text-slate-200">{lookup?.email}</span>
      </p>

      {message && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
      )}

      <form onSubmit={handleNewAccountSubmit} noValidate className="mt-6 space-y-4 text-left">
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            required
            placeholder="First name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            disabled={submitting}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
          />
          <input
            type="text"
            required
            placeholder="Last name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            disabled={submitting}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
          />
        </div>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            placeholder="Choose a password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        </div>
        <p className="text-xs text-slate-400">At least 8 characters, with a letter and a number.</p>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? "Creating account..." : "Create realtor account"}
        </button>
      </form>
    </CardShell>
  );
}
