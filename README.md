# Zuup Auth

Zuup Auth is the centralized identity, profile, and OAuth service for Zuup products.

## Official Domains

- https://auth.zuup.dev
- https://order.zuup.dev
- https://time.zuup.dev
- https://code.zuup.dev
- https://watch.zuup.dev
- https://zuup.dev
- https://giza.zuup.dev
- https://zuup.dev/schools

## Core Endpoints

- Authorize: https://auth.zuup.dev/authorize
- Token: https://auth.zuup.dev/api/oauth/token
- Userinfo: https://auth.zuup.dev/api/oauth/userinfo
- Validate OAuth request: https://auth.zuup.dev/api/oauth/validate-request
- Register OAuth app: https://auth.zuup.dev/api/oauth/register-client

## Auth and Profile Data Model

Primary source of truth is Supabase Auth users.

- Account identity and session: auth.users
- Email/password, OTP, and recovery: Supabase Auth
- Profile fields: auth.users.raw_user_meta_data

Profile metadata keys currently used by app UI:

- full_name
- last_name
- username
- country
- phone
- phone_country_code
- full_phone
- address_line1
- address_line2
- city
- state_region
- postal_code
- mailing_address (object)
- avatar_url
- cover_image_url
- gallery_images (array)
- security_alerts_enabled

## Required Tables for OAuth Server Routes

Run this SQL in Supabase (public schema):

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

## SQL for Mailing Address and Extra Profile Fields

Supabase manages auth.users directly, so you should not alter auth.users table structure for custom columns.

Use metadata keys above for app logic. If you also want a queryable SQL mirror table for analytics/admin/reporting, run:

```sql
create table if not exists public.user_profile_details (
	user_id uuid primary key references auth.users(id) on delete cascade,
	email text,
	full_name text,
	last_name text,
	username text,
	country text,
	phone text,
	phone_country_code text,
	full_phone text,
	address_line1 text,
	address_line2 text,
	city text,
	state_region text,
	postal_code text,
	mailing_address jsonb not null default '{}'::jsonb,
	avatar_url text,
	cover_image_url text,
	gallery_images jsonb not null default '[]'::jsonb,
	updated_at timestamptz not null default now()
);

create or replace function public.sync_user_profile_details_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.user_profile_details (
		user_id,
		email,
		full_name,
		last_name,
		username,
		country,
		phone,
		phone_country_code,
		full_phone,
		address_line1,
		address_line2,
		city,
		state_region,
		postal_code,
		mailing_address,
		avatar_url,
		cover_image_url,
		gallery_images,
		updated_at
	) values (
		new.id,
		new.email,
		coalesce(new.raw_user_meta_data->>'full_name', ''),
		coalesce(new.raw_user_meta_data->>'last_name', ''),
		coalesce(new.raw_user_meta_data->>'username', ''),
		coalesce(new.raw_user_meta_data->>'country', ''),
		coalesce(new.raw_user_meta_data->>'phone', ''),
		coalesce(new.raw_user_meta_data->>'phone_country_code', ''),
		coalesce(new.raw_user_meta_data->>'full_phone', ''),
		coalesce(new.raw_user_meta_data->>'address_line1', ''),
		coalesce(new.raw_user_meta_data->>'address_line2', ''),
		coalesce(new.raw_user_meta_data->>'city', ''),
		coalesce(new.raw_user_meta_data->>'state_region', ''),
		coalesce(new.raw_user_meta_data->>'postal_code', ''),
		coalesce(new.raw_user_meta_data->'mailing_address', '{}'::jsonb),
		coalesce(new.raw_user_meta_data->>'avatar_url', ''),
		coalesce(new.raw_user_meta_data->>'cover_image_url', ''),
		coalesce(new.raw_user_meta_data->'gallery_images', '[]'::jsonb),
		now()
	)
	on conflict (user_id) do update
	set
		email = excluded.email,
		full_name = excluded.full_name,
		last_name = excluded.last_name,
		username = excluded.username,
		country = excluded.country,
		phone = excluded.phone,
		phone_country_code = excluded.phone_country_code,
		full_phone = excluded.full_phone,
		address_line1 = excluded.address_line1,
		address_line2 = excluded.address_line2,
		city = excluded.city,
		state_region = excluded.state_region,
		postal_code = excluded.postal_code,
		mailing_address = excluded.mailing_address,
		avatar_url = excluded.avatar_url,
		cover_image_url = excluded.cover_image_url,
		gallery_images = excluded.gallery_images,
		updated_at = now();

	return new;
end;
$$;

drop trigger if exists trg_sync_user_profile_details_from_auth on auth.users;

create trigger trg_sync_user_profile_details_from_auth
after insert or update of email, raw_user_meta_data
on auth.users
for each row
execute function public.sync_user_profile_details_from_auth();
```

## Supabase Email Templates

Use these HTML files for the matching Supabase Auth email templates. They all use the Zuup logo and dark coral theme.

- [supabase/templates/invite.html](supabase/templates/invite.html)
- [supabase/templates/confirmation.html](supabase/templates/confirmation.html)
- [supabase/templates/magic_link.html](supabase/templates/magic_link.html)
- [supabase/templates/email_change.html](supabase/templates/email_change.html)
- [supabase/templates/recovery.html](supabase/templates/recovery.html)
- [supabase/templates/reauthentication.html](supabase/templates/reauthentication.html)
- [supabase/templates/password_changed_notification.html](supabase/templates/password_changed_notification.html)
- [supabase/templates/email_changed_notification.html](supabase/templates/email_changed_notification.html)
- [supabase/templates/phone_changed_notification.html](supabase/templates/phone_changed_notification.html)
- [supabase/templates/identity_linked_notification.html](supabase/templates/identity_linked_notification.html)
- [supabase/templates/identity_unlinked_notification.html](supabase/templates/identity_unlinked_notification.html)
- [supabase/templates/mfa_factor_enrolled_notification.html](supabase/templates/mfa_factor_enrolled_notification.html)
- [supabase/templates/mfa_factor_unenrolled_notification.html](supabase/templates/mfa_factor_unenrolled_notification.html)

For local Supabase dev, wire them in `supabase/config.toml` like this:

```toml
[auth.email.template.invite]
content_path = "./supabase/templates/invite.html"

[auth.email.template.confirmation]
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.magic_link]
content_path = "./supabase/templates/magic_link.html"

[auth.email.template.email_change]
content_path = "./supabase/templates/email_change.html"

[auth.email.template.recovery]
content_path = "./supabase/templates/recovery.html"

[auth.email.template.reauthentication]
content_path = "./supabase/templates/reauthentication.html"

[auth.email.notification.password_changed]
content_path = "./supabase/templates/password_changed_notification.html"

[auth.email.notification.email_changed]
content_path = "./supabase/templates/email_changed_notification.html"

[auth.email.notification.phone_changed]
content_path = "./supabase/templates/phone_changed_notification.html"

[auth.email.notification.identity_linked]
content_path = "./supabase/templates/identity_linked_notification.html"

[auth.email.notification.identity_unlinked]
content_path = "./supabase/templates/identity_unlinked_notification.html"

[auth.email.notification.mfa_factor_enrolled]
content_path = "./supabase/templates/mfa_factor_enrolled_notification.html"

[auth.email.notification.mfa_factor_unenrolled]
content_path = "./supabase/templates/mfa_factor_unenrolled_notification.html"
```

Hosted Supabase projects can paste the same HTML into the Dashboard email template editor.

## Environment Variables (Vercel)

```env
ZUUP_ISSUER=https://auth.zuup.dev
ZUUP_OAUTH_SIGNING_SECRET=PUT_A_LONG_RANDOM_SECRET_HERE

SUPABASE_URL=https://qnapwukqhybziduhzpow.supabase.co
SUPABASE_SERVICE_ROLE_KEY=PUT_SUPABASE_SERVICE_ROLE_KEY_HERE

ZUUP_OAUTH_CODES_TABLE=oauth_authorization_codes
ZUUP_OAUTH_CLIENTS_TABLE=oauth_clients

RESEND_API_KEY=PUT_RESEND_KEY_HERE
SECURITY_ALERT_FROM_EMAIL="Zuup Security <security@zuup.dev>"
```

## Local Development

```bash
npm install
npm run dev
```

## Notes for Developers

- Use OAuth Authorization Code flow with PKCE.
- Keep token exchange on server side.
- Keep sessions in secure HTTP-only cookies in client apps.
- Email updates require inbox confirmation by Supabase Auth.

## Copyright

Copyright (c) 2026 Zuup. Created by Jagrit Sachdev.
