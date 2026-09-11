"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Spinner } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";
import type { ChatMessage, ChatSessionWithMessages } from "@/lib/types";

export default function ChatConversationPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { getAccessToken } = useAuth();

  const [session, setSession] = useState<ChatSessionWithMessages | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = getAccessToken();
      if (!token) {
        setLoadError("Your session expired - please sign in again.");
        return;
      }
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setLoadError(
          typeof data?.detail === "string" ? data.detail : "Unable to load this conversation."
        );
        return;
      }
      setSession(data as ChatSessionWithMessages);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, getAccessToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    const token = getAccessToken();
    if (!token) {
      setSendError("Your session expired - please sign in again.");
      return;
    }

    setSending(true);
    setSendError(null);

    const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
    const data = await response.json();
    setSending(false);

    if (!response.ok) {
      setSendError(
        typeof data?.detail === "string" ? data.detail : "Sorry, I couldn't send that. Please try again."
      );
      return;
    }

    const exchange = data as { user_message: ChatMessage; assistant_message: ChatMessage };
    setDraft("");
    setSession((prev) =>
      prev
        ? { ...prev, messages: [...prev.messages, exchange.user_message, exchange.assistant_message] }
        : prev
    );
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-slate-600 dark:text-slate-400">{loadError}</p>
        <Link href="/chat" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Back to conversations
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-6 w-6 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-73px)] max-w-2xl flex-col px-4 sm:px-6">
      <div className="flex items-center justify-between py-4">
        <Link href="/chat" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          ← Conversations
        </Link>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {session.title ?? "Untitled conversation"}
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {session.messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate-400">
            Ask a question about your readiness score or home-buying in general.
          </p>
        )}
        {session.messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "USER" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                message.role === "USER"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <Spinner className="h-4 w-4" />
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 py-4 dark:border-slate-800">
        {sendError && (
          <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">
            {sendError}
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about your results..."
            maxLength={4000}
            disabled={sending}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white dark:focus:ring-white"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Send
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          The assistant explains your HomeReady results - it doesn&apos;t change your score and
          isn&apos;t a mortgage approval.
        </p>
      </div>
    </div>
  );
}
