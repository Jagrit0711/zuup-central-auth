# Zuup Auth

Zuup Auth is the central OAuth and account system for Zuup apps.

Client apps should integrate with **auth.zuup.dev** endpoints. Zuup Auth handles auth flows and server-side token logic.

## Integration Endpoints

- Authorize: `https://auth.zuup.dev/authorize`
- Token: `https://auth.zuup.dev/api/oauth/token`
- Userinfo: `https://auth.zuup.dev/api/oauth/userinfo`

Client callback example:

- `https://watch.zuup.dev/auth/zuup/callback`

## Architecture

- Frontend: React + TypeScript + Vite
- Auth backend/API: Vercel serverless routes under `api/oauth/*`
- Account security/API: Vercel serverless routes under `api/account/*`
- Identity + storage: Supabase (Auth + Postgres)

## Account Features

- Persistent session behavior configured for reload-safe sign in.
- Password login and passwordless 6-digit email code login on login/signup and OAuth authorize.
- Security alert email API that can include IP, browser, app, and login method details.
- Security tab supports:
	- TOTP authenticator enrollment/verification/disable
	- backup code generation
	- login alert email preference toggle

## Required Supabase Tables

Run this SQL in Supabase:

```sql
create table if not exists public.zuup_users (
	id uuid primary key,
	email text not null unique,
	user_metadata jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	last_sign_in_at timestamptz
);

create table if not exists public.zuup_email_codes (
	id bigserial primary key,
	email text not null,
	purpose text not null,
	code_hash text not null,
	metadata jsonb not null default '{}'::jsonb,
	attempts integer not null default 0,
	consumed_at timestamptz,
	expires_at timestamptz not null,
	created_at timestamptz not null default now()
);

create table if not exists public.oauth_clients (
	client_id text primary key,
	client_secret text not null,
	name text not null,
	icon_url text,
	homepage_url text,
	allowed_redirect_uris jsonb not null default '[]'::jsonb,
	allowed_scopes jsonb not null default '[]'::jsonb,
	is_first_party boolean not null default false,
	created_at timestamptz not null default now()
);

create table if not exists public.oauth_authorization_codes (
	code text primary key,
	client_id text not null,
	redirect_uri text not null,
	user_id text not null,
	scopes jsonb not null default '[]'::jsonb,
	code_challenge text,
	code_challenge_method text,
	expires_at timestamptz not null,
	used boolean not null default false,
	created_at timestamptz not null default now(),
	consumed_at timestamptz
);

create index if not exists oauth_authorization_codes_client_id_idx
	on public.oauth_authorization_codes (client_id);

create index if not exists oauth_authorization_codes_expires_at_idx
	on public.oauth_authorization_codes (expires_at);

create index if not exists oauth_authorization_codes_used_idx
	on public.oauth_authorization_codes (used);
```

## Auth Project Env (Vercel)

Set these env vars on the `auth.zuup.dev` project:

```env
ZUUP_ISSUER=https://auth.zuup.dev
ZUUP_OAUTH_SIGNING_SECRET=PUT_A_LONG_RANDOM_SECRET_HERE

SUPABASE_URL=https://qnapwukqhybziduhzpow.supabase.co
SUPABASE_SERVICE_ROLE_KEY=PUT_SUPABASE_SERVICE_ROLE_KEY_HERE

ZUUP_OAUTH_CODES_TABLE=oauth_authorization_codes
ZUUP_OAUTH_CLIENTS_TABLE=oauth_clients
ZUUP_USERS_TABLE=zuup_users
ZUUP_EMAIL_CODES_TABLE=zuup_email_codes
ZUUP_SESSION_SECRET=PUT_A_LONG_RANDOM_SESSION_SECRET_HERE

# Independent SMTP delivery for 6-digit codes
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=noreply@zuup.dev
SMTP_PASS=PUT_MAILBOX_OR_APP_PASSWORD_HERE
SMTP_FROM=noreply@zuup.dev

# Optional: security alert email delivery
RESEND_API_KEY=PUT_RESEND_KEY_HERE
SECURITY_ALERT_FROM_EMAIL="Zuup Security <security@zuup.dev>"
```

Notes:

- For dynamic multi-app registration, do **not** set `ZUUP_CLIENT_ID`, `ZUUP_CLIENT_SECRET`, or `ZUUP_CLIENT_SECRETS_JSON`.
- New apps are expected to be persisted to `oauth_clients`.
- Passwordless 6-digit login/signup uses `zuup_users` and `zuup_email_codes` plus your SMTP account, not Supabase Auth OTP.
- OTP rows expire after 24 hours and are pruned automatically when new codes are requested.

## OAuth Flow (Recommended)

1. App redirects user to `https://auth.zuup.dev/authorize` with OAuth params.
2. Zuup Auth validates `client_id`, `redirect_uri`, scopes.
3. User signs in and grants consent.
4. Zuup Auth issues a short-lived auth code server-side.
5. App backend exchanges code at `https://auth.zuup.dev/api/oauth/token`.
6. Zuup Auth verifies PKCE + code and returns tokens.
7. Client app calls `https://auth.zuup.dev/api/oauth/userinfo` with the bearer token.

## Passwordless Email Code Flow

1. User requests a 6-digit code from `api/account/otp/request`.
2. Zuup sends the code through your SMTP account.
3. User enters the code in the 6-box OTP UI.
4. `api/account/otp/verify` validates the code and creates a signed Zuup session.
5. The app uses that session for login, profile, and sign-out without Supabase Auth OTP.

## Auto Sign-In Like Google

- Zuup Auth keeps its own first-party session on `auth.zuup.dev`, so returning users should skip login on `/authorize` when their session is valid.
- For client apps, store Zuup tokens server-side in secure, HTTP-only cookies and refresh through your backend.
- Do not call Supabase `/auth/v1/user` with Zuup-issued access tokens; use Zuup `userinfo` endpoint.

## Common Errors

- `redirect_uri not registered`: callback URL mismatch against client allowlist.
- `invalid_client`: unknown client_id or secret mismatch.
- `invalid_grant`: auth code expired/used or PKCE mismatch.
- `method_not_allowed`: app is calling token endpoint with GET instead of POST.

## Local Development

```bash
npm install
npm run dev
```

## Copyright

Copyright © 2026 Zuup. Created by Jagrit Sachdev.
