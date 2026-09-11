import type { ReactNode } from "react";

import { AuthIllustration } from "@/components/auth/AuthIllustration";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-[calc(100vh-73px)]">
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            {children}
          </div>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 lg:text-left">
            {footer}
          </p>
        </div>
      </div>

      <div className="hidden flex-1 items-center justify-center bg-indigo-50/60 dark:bg-slate-900/40 lg:flex">
        <div className="max-w-md px-10">
          <AuthIllustration />
          <p className="mt-6 text-center text-sm font-medium text-slate-600 dark:text-slate-300">
            Know exactly where you stand on the path to homeownership.
          </p>
        </div>
      </div>
    </div>
  );
}
