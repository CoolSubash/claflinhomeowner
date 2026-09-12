"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Spinner } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";
import type { RealEstatePartner, User } from "@/lib/types";

function RoleBadges({ roles }: { roles: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <span
          key={role}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          {role}
        </span>
      ))}
    </div>
  );
}

function NotAuthorized() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        You don&apos;t have access to this page.
      </p>
    </div>
  );
}

export default function AdminPage() {
  const { user, getAccessToken } = useAuth();
  const isAdmin = user?.roles.includes("ADMIN") ?? false;

  const [users, setUsers] = useState<User[] | null>(null);
  const [partners, setPartners] = useState<RealEstatePartner[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerEmail, setNewPartnerEmail] = useState("");
  const [newPartnerPhone, setNewPartnerPhone] = useState("");
  const [creatingPartner, setCreatingPartner] = useState(false);

  const [inviteEmails, setInviteEmails] = useState<Record<string, string>>({});
  const [invitingPartnerId, setInvitingPartnerId] = useState<string | null>(null);
  const [invitedPartnerIds, setInvitedPartnerIds] = useState<Set<string>>(new Set());

  const authHeader = () => ({ Authorization: `Bearer ${getAccessToken()}` });

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    const loadAll = async () => {
      const [usersRes, partnersRes] = await Promise.all([
        fetch("/api/admin/users", { headers: authHeader(), cache: "no-store" }),
        fetch("/api/admin/realtor-partners", { headers: authHeader(), cache: "no-store" }),
      ]);
      if (cancelled) return;
      if (usersRes.ok) setUsers(await usersRes.json());
      if (partnersRes.ok) setPartners(await partnersRes.json());
    };

    void loadAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleCreatePartner = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setCreatingPartner(true);

    const response = await fetch("/api/admin/realtor-partners", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({
        name: newPartnerName,
        contact_email: newPartnerEmail || null,
        contact_phone: newPartnerPhone || null,
      }),
    });
    const data = await response.json();
    setCreatingPartner(false);

    if (!response.ok) {
      setError(typeof data?.detail === "string" ? data.detail : "Unable to create partner.");
      return;
    }
    setNewPartnerName("");
    setNewPartnerEmail("");
    setNewPartnerPhone("");
    setPartners((prev) => (prev ? [data, ...prev] : [data]));
  };

  const handleSendInvite = async (partnerId: string) => {
    const email = inviteEmails[partnerId];
    if (!email) return;
    setError(null);
    setInvitingPartnerId(partnerId);

    const response = await fetch(`/api/admin/realtor-partners/${partnerId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ email }),
    });
    setInvitingPartnerId(null);

    if (!response.ok) {
      const data = await response.json();
      setError(typeof data?.detail === "string" ? data.detail : "Unable to send invite.");
      return;
    }
    setInvitedPartnerIds((prev) => new Set(prev).add(partnerId));
  };

  if (!user) return null;
  if (!isAdmin) return <NotAuthorized />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Manage users and onboard real-estate partners.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Users</h2>
        {users === null ? (
          <Spinner className="mt-4 h-5 w-5 text-slate-400" />
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((row) => (
                  <tr key={row.id} className="bg-white dark:bg-slate-900">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {row.first_name} {row.last_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadges roles={row.roles} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {row.is_active ? "Active" : "Inactive"} ·{" "}
                      {row.email_verified ? "Verified" : "Unverified"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Real-Estate Partners</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Add a partner once they&apos;ve been vetted, then send an invite to onboard their login.
        </p>

        <form
          onSubmit={handleCreatePartner}
          className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3"
        >
          <input
            type="text"
            required
            placeholder="Company / agent name"
            value={newPartnerName}
            onChange={(event) => setNewPartnerName(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
          />
          <input
            type="email"
            placeholder="Contact email (optional)"
            value={newPartnerEmail}
            onChange={(event) => setNewPartnerEmail(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
          />
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={newPartnerPhone}
              onChange={(event) => setNewPartnerPhone(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={creatingPartner}
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingPartner && <Spinner className="h-4 w-4" />}
              Add
            </button>
          </div>
        </form>

        {partners === null ? (
          <Spinner className="mt-4 h-5 w-5 text-slate-400" />
        ) : partners.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No partners yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {partners.map((partner) => (
              <li
                key={partner.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{partner.name}</p>
                  <p className="text-xs text-slate-400">
                    {partner.contact_email ?? "no contact email"}
                    {partner.user_id ? " · Linked to an account" : " · Not onboarded yet"}
                  </p>
                </div>

                {!partner.user_id && (
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      placeholder="Invite email"
                      value={inviteEmails[partner.id] ?? ""}
                      onChange={(event) =>
                        setInviteEmails((prev) => ({ ...prev, [partner.id]: event.target.value }))
                      }
                      className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendInvite(partner.id)}
                      disabled={invitingPartnerId === partner.id || !inviteEmails[partner.id]}
                      className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {invitingPartnerId === partner.id && <Spinner className="h-4 w-4" />}
                      {invitedPartnerIds.has(partner.id) ? "Invite sent" : "Send invite"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
