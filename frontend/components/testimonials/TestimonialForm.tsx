"use client";

import { useState, type FormEvent } from "react";

import { StarIcon, Spinner } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";

export function TestimonialForm() {
  const { getAccessToken } = useAuth();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (rating < 1) {
      setError("Choose a star rating before submitting.");
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setError("Your session expired - please sign in again.");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/testimonials", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating, content }),
    });
    const data = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      const message =
        typeof data?.detail === "string" ? data.detail : "Unable to submit your review right now.";
      setError(message);
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
        Thanks for sharing your experience - it may appear on our homepage.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <div>
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Your rating
        </span>
        <div className="mt-2 flex gap-1" onMouseLeave={() => setHoverRating(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              className="p-0.5"
            >
              <StarIcon
                className={`h-6 w-6 ${
                  value <= (hoverRating || rating)
                    ? "text-amber-400"
                    : "text-slate-200 dark:text-slate-700"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="testimonial-content"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Your review
        </label>
        <textarea
          id="testimonial-content"
          required
          minLength={1}
          maxLength={500}
          rows={4}
          disabled={submitting}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="What was your experience with HomeReady AI?"
          className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white dark:focus:ring-white"
        />
        <p className="mt-1 text-right text-xs text-slate-400">{content.length}/500</p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        {submitting && <Spinner className="h-4 w-4" />}
        {submitting ? "Submitting..." : "Submit review"}
      </button>
    </form>
  );
}
