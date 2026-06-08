# Unvault

AI-powered jewelry analysis — upload a photo of a piece, get a structured
report (metal, gemstone, estimated value, condition, authenticity signals,
care tips). Three free analyses per account, then $9.99/month for unlimited.

## Stack

- **Next.js 15 / App Router** (TypeScript, React 19)
- **Supabase** — auth, Postgres, storage
- **Gemini** (Google AI Studio) — image analysis
- **Paddle Billing** — subscriptions
- **Sentry** — error monitoring
- **Vercel** — hosting

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

Then open <http://localhost:3000>.

## Required services

You'll need accounts and keys for each integration:

| Service        | What to create | Env vars |
| -------------- | -------------- | -------- |
| **Supabase**   | Project + run `supabase/migrations/0001_init.sql` (see `supabase/README.md`). Use the new **publishable** (`sb_publishable_...`) and **secret** (`sb_secret_...`) keys from Project Settings → API. | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |
| **Gemini**     | API key from <https://aistudio.google.com/app/apikey> | `GEMINI_API_KEY` (optional: `GEMINI_MODEL`) |
| **Paddle**     | Sandbox account → Catalog → product with a $9.99/month recurring price → Notifications endpoint | `PADDLE_API_KEY`, `PADDLE_PRICE_ID`, `PADDLE_NOTIFICATION_KEY`, `NEXT_PUBLIC_PADDLE_ENV` |
| **Sentry**     | Project → DSN | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` |
| **App**        | — | `NEXT_PUBLIC_APP_URL` |

## Paddle webhook

Point Paddle's notification endpoint at:

```
https://<your-domain>/api/paddle/webhook
```

The webhook verifies the signature using `PADDLE_NOTIFICATION_KEY` and flips
`profiles.is_premium` on activation / cancellation.

## Project layout

```
app/
  page.tsx               # Landing
  dashboard/             # Authenticated grid of pieces
  analysis/[id]/         # Per-piece report
  auth/callback/         # Supabase email-confirm callback
  api/
    analyze/             # Gemini analyze + DB persist
    paddle/checkout/     # Create Paddle hosted checkout
    paddle/webhook/      # Receive subscription events
  globals.css            # Ported from the design prototype
components/              # LandingPage, AuthModal, DashboardView,
                         # AnalysisView, SubscriptionModal
lib/
  supabase/              # browser + server + middleware clients
  gemini.ts              # analyzeJewelryImage()
  paddle.ts              # SDK init
  types.ts               # shared types
supabase/migrations/     # SQL schema
middleware.ts            # Supabase session refresh + route protection
```

## Deploy

The recommended path is Vercel + the Supabase Marketplace integration. After
linking the project:

```bash
vercel env pull .env.local   # populates supabase + system vars
vercel deploy                # preview
vercel deploy --prod         # production
```

Add the remaining secrets (Gemini, Paddle, Sentry) via `vercel env add` or
the dashboard.
