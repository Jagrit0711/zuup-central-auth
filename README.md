# Zuup Auth

Zuup Auth is the central OAuth and account system for Zuup apps.

Client apps should integrate with **auth.zuup.dev** endpoints. Zuup Auth handles auth flows and server-side token logic.

## Integration Endpoints

- Authorize: `https://auth.zuup.dev/authorize`
- Token: `https://auth.zuup.dev/api/oauth/token`

Client callback example:

- `https://watch.zuup.dev/auth/zuup/callback`

## Architecture

- Frontend: React + TypeScript + Vite
- Auth backend/API: Vercel serverless routes under `api/oauth/*`
- Identity + storage: Supabase (Auth + Postgres)

## Required Supabase Tables

Run this SQL in Supabase:

```sql
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
```

Notes:

- For dynamic multi-app registration, do **not** set `ZUUP_CLIENT_ID`, `ZUUP_CLIENT_SECRET`, or `ZUUP_CLIENT_SECRETS_JSON`.
- New apps are expected to be persisted to `oauth_clients`.

## OAuth Flow (Recommended)

1. App redirects user to `https://auth.zuup.dev/authorize` with OAuth params.
2. Zuup Auth validates `client_id`, `redirect_uri`, scopes.
3. User signs in and grants consent.
4. Zuup Auth issues a short-lived auth code server-side.
5. App backend exchanges code at `https://auth.zuup.dev/api/oauth/token`.
6. Zuup Auth verifies PKCE + code and returns tokens.

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
