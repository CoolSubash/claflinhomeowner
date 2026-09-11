"use client";

import { TestimonialForm } from "@/components/testimonials/TestimonialForm";
import { useAuth } from "@/hooks/use-auth";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Your account information, as stored on HomeReady AI.
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold text-white">
            {initials(user.first_name, user.last_name)}
          </span>
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">
              {user.first_name} {user.last_name}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-1 gap-x-6 gap-y-5 border-t border-slate-100 pt-6 dark:border-slate-800 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Email verified</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  user.email_verified
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                }`}
              >
                {user.email_verified ? "Verified" : "Not verified"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Account status</dt>
            <dd className="mt-1">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                {user.is_active ? "Active" : "Inactive"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Member since</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
              {formatDate(user.created_at)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          How your account is protected
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>Your password is hashed with Argon2id - HomeReady AI never sees or stores it in plain text.</li>
          <li>Sign-in sessions use short-lived tokens that rotate automatically in the background.</li>
          <li>Every request for your data is checked against your account before it&apos;s returned.</li>
        </ul>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Share your experience
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your highest-rated feedback may be featured on our homepage, shown only with your first
          name and last initial.
        </p>
        <div className="mt-4">
          <TestimonialForm />
        </div>
      </div>
    </div>
  );
}
