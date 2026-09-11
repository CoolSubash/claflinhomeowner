"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ChatIcon, Spinner } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";
import type { ChatSession } from "@/lib/types";

export default function ChatSessionsPage() {
  const { getAccessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get("assessmentId");

  const [sessions, setSessions] = useState<ChatSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = getAccessToken();
      if (!token) {
        setError("Your session expired - please sign in again.");
        return;
      }
      const response = await fetch("/api/chat/sessions", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setError(typeof data?.detail === "string" ? data.detail : "Unable to load your conversations.");
        return;
      }
      setSessions(data as ChatSession[]);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  const startSession = async () => {
    const token = getAccessToken();
    if (!token) {
      setError("Your session expired - please sign in again.");
      return;
    }
    setCreating(true);
    setError(null);

    const response = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(assessmentId ? { assessment_id: assessmentId } : {}),
    });
    const data = await response.json();
    setCreating(false);

    if (!response.ok) {
      setError(typeof data?.detail === "string" ? data.detail : "Unable to start a new conversation.");
      return;
    }
    router.push(`/chat/${data.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Assistant</h1>
        <button
          type="button"
          onClick={startSession}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating && <Spinner className="h-4 w-4" />}
          New chat
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Ask about your readiness score, its breakdown, recommendations, or general home-buying
        questions.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {!error && sessions === null && (
        <div className="mt-10 flex justify-center">
          <Spinner className="h-6 w-6 text-slate-400" />
        </div>
      )}

      {!error && sessions !== null && sessions.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <ChatIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            You haven&apos;t started a conversation yet.
          </p>
        </div>
      )}

      {!error && sessions !== null && sessions.length > 0 && (
        <ul className="mt-6 space-y-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                href={`/chat/${session.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {session.title ?? "Untitled conversation"}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(session.updated_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
