# Realtor Onboarding & Connections

How a real-estate professional gets an account on the platform, and how a
homebuyer's connection request reaches them. Vetting a realtor happens
entirely outside this application (a separate review process); this
document covers only what happens once that vetting is done.

## Why invite-only

`POST /auth/register` can never produce a `REALTOR` account - that's
unconditional (`docs/authorization.md`). A `REALTOR` account only ever
comes from redeeming an invitation an admin created for a specific,
already-vetted `real_estate_partners` row. There is no "sign up as a
realtor" flow anywhere in the API.

## The model

```text
real_estate_partners          "a vetted company/agent we trust"
        │
        │ user_id (nullable - set once someone redeems an invite)
        ▼
      users                    the actual login, once onboarded
```

`real_estate_partners.user_id` is the missing link `docs/authorization.md`
used to call out as not existing - it's what lets a `REALTOR`-permissioned
request be scoped to "connection requests addressed to *my* partner
record" rather than to a `user_id` column, the ownership shape every
other resource in this app uses.

## Flow

```text
1. Admin creates a partner record
   POST /admin/realtor-partners { name, contact_email?, contact_phone? }
   -> real_estate_partners row, user_id still NULL

2. Admin sends an invite to a specific email
   POST /admin/realtor-partners/{id}/invite { email }
   -> realtor_invitations row (random token, only its hash stored,
      single-use, 72h expiry - same design as email_verification_tokens)
   -> EmailService.send_realtor_invite_email logs (today) the link:
      {FRONTEND_BASE_URL}/onboard-realtor?token=...

3. The invited person opens the link
   POST /realtor-invitations/lookup { token }
   -> { email, account_exists } - validates without consuming the token,
      so the frontend can show the right form

4a. No existing account for that email
    POST /realtor-invitations/accept { token, first_name, last_name, password }
    -> creates the user (email_verified = true immediately - the invite
       itself is the verification), grants USER + REALTOR

4b. An account with that email already exists
    POST /realtor-invitations/accept { token }
    -> no password fields needed or accepted for this path; the account's
       existing password is untouched. Grants REALTOR to the existing
       account.

   Both paths, in the same transaction: link real_estate_partners.user_id,
   mark the invitation used, log REALTOR_ONBOARDED + ROLE_CHANGED.

5. Sign in normally at /login - there is no separate realtor login.
```

Steps 3-4 are deliberately two calls, not one: `lookup` is safe to call
repeatedly (a page reload, a user re-checking the link) because it never
consumes the token; only `accept` does.

## Why the existing-account path needs no extra proof

Whoever has the invite link and the invited inbox is already the trusted
party here - the same reasoning `verify-email` already relies on
(`docs/authentication.md`). Requiring a password to "prove" account
ownership on top of that would be redundant, not more secure - it would
just gate the flow behind information (the current password) an admin's
invite never depended on granting to the underlying content already.

## Endpoints

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/admin/users` | `user:read:any` | Every account + its roles |
| POST | `/admin/realtor-partners` | `partner:manage` | Create a vetted partner record |
| GET | `/admin/realtor-partners` | `partner:manage` | List partners + onboarding status |
| POST | `/admin/realtor-partners/{id}/invite` | `partner:manage` | Issue + send an invite |
| POST | `/realtor-invitations/lookup` | none (public) | Validate a token without consuming it |
| POST | `/realtor-invitations/accept` | none (public) | Redeem a token |
| GET | `/realtor/connection-requests` | `connection:respond:own` | Requests addressed to *my* linked partner |
| POST | `/realtor/connection-requests/{id}/respond` | `connection:respond:own` | Accept/decline one |

`connection:respond:own` is a new permission (granted to `REALTOR`),
distinct from `connection:create` (the `USER`-side permission for
requesting a connection in the first place - see `docs/authorization.md`).

## Ownership: ownership via the partner link

Every other resource in this app is owned via a `user_id` column checked
directly (`docs/authorization.md` §5). Connection requests, from the
realtor's side, are different: ownership means "this row's `partner_id`
matches the `real_estate_partners` row linked to me." Every realtor route
resolves that link fresh from the database
(`realtor_partners.get_partner_by_user_id`) before touching
`connection_requests` - a client can't supply or influence which partner
it resolves to. `app/services/ownership.py::get_partner_owned_connection_request`
is the analog of every other `get_owned_*` function, just keyed on
`partner_id` instead of `user_id`.

A `REALTOR`-permissioned account with no linked partner record (a data
inconsistency - onboarding always links one) gets a `404` naming that
specifically, rather than an empty list pretending everything's fine -
safe to be specific about, since it only ever describes the caller's own
account.

## Data minimization

The realtor-facing view of a connection request
(`ConnectionRequestForRealtor`) never includes the requester's email or
full name - only first name + last initial, the same minimization
pattern public testimonials use. A realtor accepting a request is
expected to be given the requester's full contact details through a
later, explicit-consent step (not yet built) - not by this endpoint
handing over everything up front.

## Audit logging

`REALTOR_PARTNER_CREATED`, `REALTOR_INVITE_SENT`, `REALTOR_ONBOARDED`,
`ROLE_CHANGED`, `CONNECTION_REQUEST_RESPONDED`, `ADMIN_VIEWED_USER`.
Never logs a password, an invitation token, or a requester's contact
details.

## Frontend

- `/admin` - user list, partner list, "add partner" form, per-partner
  "send invite."
- `/realtor` - connection request list, accept/decline.
- `/onboard-realtor` - the public invite-link landing page (outside the
  authenticated app, like `/verify-email`): looks up the token, then
  shows either the new-account form or the "confirm & link" button
  depending on `account_exists`.
- The navbar shows "Admin"/"Realtor" links only to accounts whose
  `GET /auth/me` response actually lists that role - presentational only,
  same as everywhere else in this app; the real check is always the
  backend permission.

## What's not built yet

There is no `POST /connections` for a homebuyer to actually create a
connection request - `docs/authorization.md`'s `connection:create`
permission is seeded and granted to `USER`, but nothing calls it yet.
Testing the realtor dashboard's list/respond behavior today means
inserting a `connection_requests` row directly (exactly what
`tests/test_connections.py` does) rather than through a product flow.
There is also no UI yet for a homebuyer to see the status of their own
outgoing requests.
