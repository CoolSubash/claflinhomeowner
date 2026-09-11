"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";

export default function NewAssessmentPage() {
  const { getAccessToken } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    const create = async () => {
      const token = getAccessToken();
      if (!token) {
        setError("Your session expired - please sign in again.");
        return;
      }
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data?.detail === "string" ? data.detail : "Unable to start a new assessment.");
        return;
      }
      router.replace(`/assessments/${data.id}`);
    };

    void create();
  }, [getAccessToken, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <>
          <Spinner className="h-6 w-6 text-slate-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Starting your assessment...</p>
        </>
      )}
    </div>
  );
}
