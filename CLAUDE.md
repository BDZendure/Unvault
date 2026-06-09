# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # next dev (localhost:3000)
npm run build      # next build — runs Sentry source-map upload if SENTRY_AUTH_TOKEN is set
npm run start      # serve production build
npm run lint       # next lint (eslint-config-next)
npm run typecheck  # tsc --noEmit
```

There is no test runner configured.

## Architecture

Unvault is a Next.js 15 App Router + React 19 app that turns a jewelry photo into a structured appraisal report. The end-to-end flow ties together four external services, and most of the non-obvious code exists at those seams.

### Auth + route protection

- Two Supabase SSR clients live in `lib/supabase/`:
  - `client.ts` — browser client for client components.
  - `server.ts` — `createClient()` is the request-scoped server client (respects RLS via the user's cookie); `createServiceClient()` uses `SUPABASE_SECRET_KEY` and **bypasses RLS**. Only call the service client from server routes that need to read/write another user's row or escape RLS (e.g. `api/analyze`, `api/paddle/webhook`, `api/paddle/checkout`).
- `middleware.ts` → `lib/supabase/middleware.ts` refreshes the Supabase session on every request and redirects unauthenticated traffic on `/dashboard` or `/analysis/*` to `/?auth=signin`. The middleware matcher **excludes** `api/paddle/webhook` (it reads the raw body for signature verification) and `monitoring` (Sentry tunnel route — see `next.config.ts`). Adding new routes that must bypass middleware requires updating the matcher.
- Email-confirm callback: `app/auth/callback/route.ts` exchanges the OAuth `code` for a session, then redirects to `?next=...` (defaults to `/dashboard`).

### Supabase key scheme

The project uses the **new** Supabase publishable/secret key format (`sb_publishable_...` / `sb_secret_...`), not the legacy `anon` / `service_role` JWTs. Env vars are `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. Don't reintroduce `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.

### Data model (`supabase/migrations/0001_init.sql`)

- `profiles` — one row per `auth.users` row, auto-created by the `on_auth_user_created` trigger. Stores `is_premium`, `analyses_used`, and Paddle IDs. RLS: owner-only.
- `pieces` — one upload per row. `status` ∈ `'pending' | 'analyzed'`. `analysis` is the JSON Gemini returned. RLS: owner-only on all verbs.
- Private `pieces` storage bucket. RLS policies key off `(storage.foldername(name))[1] = auth.uid()::text`, so **every uploaded object must be stored at `${user_id}/...`** or RLS will reject it. The dashboard upload code already does this (`${profile.id}/${crypto.randomUUID()}.${ext}`).

### Analysis pipeline

1. Client uploads the image directly to Supabase storage at `${user_id}/<uuid>.<ext>` and inserts a `pieces` row with `status='pending'` (see `components/DashboardView.tsx`).
2. The analysis page (`app/analysis/[id]/page.tsx`) renders with `needsAnalysis` true and `AnalysisView` POSTs to `/api/analyze`.
3. `app/api/analyze/route.ts` (Node runtime, `maxDuration = 60`):
   - Enforces the quota gate: `!is_premium && analyses_used >= FREE_ANALYSIS_LIMIT` → returns 402 with `reason: 'quota_exceeded'`. The client opens the paywall on this response.
   - Uses the service client to read `pieces`, signs the storage URL, fetches bytes, calls `analyzeJewelryImage` from `lib/gemini.ts`, then writes `status='analyzed'` + `analysis` back. Only increments `analyses_used` for non-premium users.
   - Idempotent: if `piece.status === 'analyzed'`, returns the cached analysis without calling Gemini again.
- `lib/gemini.ts` pins the structured-output schema via `responseSchema` and `responseMimeType: 'application/json'`. `MODEL` is configurable via `GEMINI_MODEL`, default `gemini-2.5-flash`. `Analysis` (in `lib/types.ts`) is the contract the schema and the UI both depend on — keep them in sync when changing fields.

### Billing (Paddle)

- `lib/paddle.ts` chooses sandbox vs production via `NEXT_PUBLIC_PADDLE_ENV`.
- `app/api/paddle/checkout/route.ts` (POST) lazily creates a Paddle customer, stores `paddle_customer_id` on the profile, and returns a hosted-checkout URL. Passes `customData: { supabase_user_id: user.id }` so the webhook can match the subscription back to the user.
- `app/api/paddle/webhook/route.ts` verifies the signature against `PADDLE_NOTIFICATION_KEY` using `paddle.webhooks.unmarshal(rawBody, secret, signature)`. **This route is intentionally excluded from middleware** so the raw body is preserved. It flips `is_premium` on `SubscriptionActivated/Created/Updated/Resumed` (active or trialing) and clears it on `Canceled/PastDue/Paused`. Matching prefers `customData.supabase_user_id`, falling back to `paddle_customer_id`.
- Free tier constant: `FREE_ANALYSIS_LIMIT` in `lib/types.ts` — checked in both `/api/analyze` and `DashboardView` (UI gate). Update both if changing.

### Sentry

`next.config.ts` wraps the config with `withSentryConfig` and tunnels client reports through `/monitoring`. Server config is in `sentry.server.config.ts` / `sentry.edge.config.ts`; client uses `instrumentation-client.ts`. The `/monitoring` path must stay excluded from middleware.

### Path aliases

`@/*` resolves to the repo root (see `tsconfig.json`). Use `@/lib/...`, `@/components/...`, etc.

## Env / deployment

The full env-var matrix is in `README.md` and `.env.example`. For local work: `cp .env.example .env.local` and fill values. For Vercel: the recommended path is the Supabase Marketplace integration + `vercel env pull .env.local` to populate Supabase + system vars, then add Gemini / Paddle / Sentry secrets manually.
