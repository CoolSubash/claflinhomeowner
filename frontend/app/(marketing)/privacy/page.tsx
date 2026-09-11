import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - HomeReady AI",
  description: "How HomeReady AI collects, uses, and protects your information.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Legal</span>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-slate-400">Last updated: September 11, 2026</p>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        This policy describes how HomeReady AI is actually built and operated today. It is a
        product document, not a document drafted or reviewed by legal counsel, and shouldn&apos;t be
        treated as a substitute for one before any real-world launch.
      </div>

      <Section title="1. Information we collect">
        <p>We collect information you provide directly:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account details - name, email address, and password (see Security, below).</li>
          <li>
            Assessment inputs - income, monthly debt, credit score, savings, down payment, target
            home price, employment history, and location.
          </li>
          <li>Documents you choose to upload in support of an assessment.</li>
          <li>Messages you send to the AI assistant about your own results.</li>
        </ul>
        <p>
          We also collect limited technical information automatically: IP address, browser/device
          user agent, and timestamps of security-relevant actions (sign-in, sign-out, document
          access), used only for account security and audit purposes.
        </p>
      </Section>

      <Section title="2. How we use your information">
        <ul className="list-disc space-y-1 pl-5">
          <li>To calculate your readiness score and category breakdown.</li>
          <li>To generate recommendations based on your own results.</li>
          <li>To power the AI assistant&apos;s answers about your own assessments.</li>
          <li>To operate your account: authentication, session management, support.</li>
          <li>To detect and respond to fraud, abuse, or unauthorized access attempts.</li>
        </ul>
        <p>
          We do not use your financial data to train shared AI models, and we do not sell your
          information.
        </p>
      </Section>

      <Section title="3. How we protect your information">
        <ul className="list-disc space-y-1 pl-5">
          <li>Passwords are hashed with Argon2id and are never stored or logged in plain text.</li>
          <li>
            Sessions use short-lived access tokens paired with rotating, hashed refresh tokens;
            reusing a revoked token invalidates the entire session family.
          </li>
          <li>Every request is checked against your account - your data is never returned to another user&apos;s session, by permission and by row-level ownership.</li>
          <li>Uploaded documents are stored in a private object store, never made public, and only ever accessed through short-lived, ownership-checked links.</li>
          <li>Security-relevant actions are recorded in an audit trail that never contains your password, tokens, or full document contents.</li>
        </ul>
      </Section>

      <Section title="4. When we share your information">
        <p>We share the minimum necessary information, and only in these cases:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">AI provider:</span>{" "}
            when you ask the assistant a question, we send only the specific figures needed to
            answer it (for example, two score values) - never your full account or document
            contents.
          </li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Real-estate professionals:
            </span>{" "}
            only if you explicitly request a connection, and only with information you&apos;ve
            consented to share for that request.
          </li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">Service providers:</span>{" "}
            infrastructure providers (hosting, database, storage) that process data on our behalf
            under contract, and never for their own purposes.
          </li>
        </ul>
        <p>We never share your data for advertising or marketing purposes.</p>
      </Section>

      <Section title="5. Cookies">
        <p>
          We use one essential cookie - a refresh token stored as HttpOnly, so it&apos;s inaccessible
          to page scripts, and marked Secure in production. It exists solely to keep you signed
          in; we don&apos;t use tracking or advertising cookies.
        </p>
      </Section>

      <Section title="6. Data retention">
        <p>
          We keep your account and assessment history for as long as your account is active, so
          you can track your progress over time. You can request deletion of your account and
          associated data at any time by contacting us (see below).
        </p>
      </Section>

      <Section title="7. Your rights and choices">
        <ul className="list-disc space-y-1 pl-5">
          <li>Access the personal data associated with your account.</li>
          <li>Correct inaccurate account information.</li>
          <li>Delete your account and the data tied to it.</li>
          <li>Withdraw consent for a real-estate connection at any time.</li>
        </ul>
      </Section>

      <Section title="8. Changes to this policy">
        <p>
          If this policy changes in a way that affects how your data is handled, we&apos;ll update the
          date at the top of this page and, for material changes, notify you directly.
        </p>
      </Section>

      <Section title="9. Contact us">
        <p>
          Questions about this policy or your data can be sent to{" "}
          <a
            href="mailto:privacy@homeready.ai"
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            privacy@homeready.ai
          </a>
          , or see our{" "}
          <a href="/contact" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Contact page
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
