import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact - HomeReady AI",
  description: "Get in touch with the HomeReady AI team.",
};

const CHANNELS = [
  {
    title: "General support",
    body: "Questions about your account, an assessment, or how something works.",
    email: "support@homeready.ai",
  },
  {
    title: "Privacy & security",
    body: "Questions about your data, this policy, or reporting a security concern.",
    email: "privacy@homeready.ai",
  },
  {
    title: "Real-estate partners",
    body: "Interested in connecting with HomeReady AI users who've opted in.",
    email: "partners@homeready.ai",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Contact</span>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        We&apos;d like to hear from you
      </h1>
      <p className="mt-5 text-lg text-slate-600 dark:text-slate-400">
        Reach out by email and we&apos;ll get back to you as soon as we can. Pick the address below
        that best matches what you need.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {CHANNELS.map((channel) => (
          <a
            key={channel.email}
            href={`mailto:${channel.email}`}
            className="group rounded-2xl border border-slate-200 p-5 transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20"
          >
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {channel.title}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{channel.body}</p>
            <span className="mt-3 inline-block text-sm font-medium text-indigo-600 group-hover:underline dark:text-indigo-400">
              {channel.email}
            </span>
          </a>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Before you write in
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Never include your password, full financial documents, or any codes from a text/email in
          a support message - our team will never ask for them. For anything about a specific
          assessment, it helps to include the date it was created.
        </p>
      </div>
    </div>
  );
}
