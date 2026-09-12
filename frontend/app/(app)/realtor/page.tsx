"use client";

import { useEffect, useState } from "react";

import { Spinner } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";
import type { ConnectionRequestForRealtor } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  ACCEPTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  DECLINED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  CANCELLED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function NotAuthorized() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        You don&apos;t have access to this page.
      </p>
    </div>
  );
}

export default function RealtorPage() {
  const { user, getAccessToken } = useAuth();
  const isRealtor = user?.roles.includes("REALTOR") ?? false;

  const [requests, setRequests] = useState<ConnectionRequestForRealtor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const authHeader = () => ({ Authorization: `Bearer ${getAccessToken()}` });

  useEffect(() => {
    if (!isRealtor) return;
    let cancelled = false;

    const load = async () => {
      const response = await fetch("/api/realtor/connection-requests", {
        headers: authHeader(),
        cache: "no-store",
      });
      const data = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setError(typeof data?.detail === "string" ? data.detail : "Unable to load connection requests.");
        return;
      }
      setRequests(data as ConnectionRequestForRealtor[]);
    };

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealtor]);

  const respond = async (id: string, status: "ACCEPTED" | "DECLINED") => {
    setRespondingId(id);
    const response = await fetch(`/api/realtor/connection-requests/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    setRespondingId(null);

    if (!response.ok) {
      setError(typeof data?.detail === "string" ? data.detail : "Unable to update this request.");
      return;
    }
    setRequests((prev) => prev?.map((r) => (r.id === id ? data : r)) ?? prev);
  };

  if (!user) return null;
  if (!isRealtor) return <NotAuthorized />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Realtor Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Connection requests from homebuyers who&apos;d like to work with you.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {!error && requests === null && (
        <div className="mt-10 flex justify-center">
          <Spinner className="h-6 w-6 text-slate-400" />
        </div>
      )}

      {!error && requests !== null && requests.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No connection requests yet.
        </div>
      )}

      {!error && requests !== null && requests.length > 0 && (
        <ul className="mt-6 space-y-3">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {request.requester_name}
                </p>
                <p className="text-xs text-slate-400">
                  Requested {new Date(request.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[request.status] ?? "bg-slate-100 text-slate-600"}`}
                >
                  {request.status}
                </span>
                {request.status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      onClick={() => respond(request.id, "ACCEPTED")}
                      disabled={respondingId === request.id}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => respond(request.id, "DECLINED")}
                      disabled={respondingId === request.id}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Decline
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
