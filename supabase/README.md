# Supabase setup

This directory contains the SQL migration for the Unvault schema.

## Apply the migration

### Option A — Supabase Dashboard (fastest)
1. Open the project in the Supabase dashboard.
2. SQL Editor → New query.
3. Paste the contents of `migrations/0001_init.sql`.
4. Run.

### Option B — Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref <your-ref>
npx supabase db push
```

### Option C — Vercel Marketplace (recommended for new projects)

Install Supabase from the Vercel Marketplace; it auto-provisions the project
and injects the Supabase URL + publishable key into your project's environment.
Then apply the migration via Option A or B. Grab the **publishable** and
**secret** keys from the Supabase dashboard (Project Settings → API) and set
them as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`) and
`SUPABASE_SECRET_KEY` (`sb_secret_...`). The legacy `anon` / `service_role`
JWTs are being deprecated end of 2026.

## What the migration creates

- `public.profiles` — one row per `auth.users` row, holds `is_premium`,
  `analyses_used`, and Paddle ids. Auto-populated by the
  `on_auth_user_created` trigger.
- `public.pieces` — one row per uploaded jewelry photo. RLS limits access
  to the owner.
- A private storage bucket `pieces` with RLS policies that scope objects
  by `auth.uid()` (first path segment).
