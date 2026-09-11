"use client";

import { useEffect, useState } from "react";

import { StarIcon } from "@/components/icons";
import type { Testimonial } from "@/lib/types";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <StarIcon
          key={index}
          className={`h-4 w-4 ${
            index < rating ? "text-amber-400" : "text-slate-200 dark:text-slate-700"
          }`}
        />
      ))}
    </div>
  );
}

export function Testimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/testimonials", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: Testimonial[]) => {
        if (!cancelled) setTestimonials(data);
      })
      .catch(() => {
        if (!cancelled) setTestimonials([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to show yet (still loading, or genuinely no 4-5 star reviews)
  // - fail quiet rather than showing an empty section on a fresh install.
  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-slate-100 py-16 dark:border-slate-900 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            What people are saying
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Real feedback from homebuyers and real-estate partners using HomeReady AI.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <figure
              key={testimonial.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <Stars rating={testimonial.rating} />
              <blockquote className="mt-4 flex-1 text-sm text-slate-600 dark:text-slate-300">
                &ldquo;{testimonial.content}&rdquo;
              </blockquote>
              <figcaption className="mt-4 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {testimonial.author_name}
                </span>
                <span className="text-slate-400"> · {testimonial.author_role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
