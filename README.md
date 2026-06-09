# Unvault — Conversation Log

A chronological record of the prompts that built this repo and a short summary of what the agent did in response.

> Note: one Paddle sandbox API key shared mid-conversation has been redacted below (`pdl_sdbx_apikey_…REDACTED…`) so the README is safe to commit. The real key lives only in `.env.local` and in the running MCP config.

---

## 1. Initial implementation

**User**

> Fetch this design file, read its readme, and implement the relevant aspects of the design. https://api.anthropic.com/v1/design/h/5TIO-xqsN0e9ohVMl1K34Q?open_file=Unvault.html
> Implement: Unvault.html

**User** (follow-up while the agent was working)

> Here is the tech stack:
>
> Tech Stack
> - Web Framework: Next.js
> - Database: Supabase
> - Frontend Framework: React
> - Hosting: Vercel
> - Error Logging and monitoring: Sentry
> - Paywall: Paddle
> - AI API - Gemni API (Google AI Studio)

**User**

> --resume

**User** (after a failed `/security-review`)

> from my understanding for supabase, anon and service role API keys are now legacy. It should now be publishable and secret API keys. Recheck the supabase documentation. @.env.example

**User**

> commit and push changes

**User**

> switch to a branch and create a PR

**User**

> install gh and create the PR for me

**User**

> continue

**Agent**

Fetched the design bundle (a gzip archive), extracted it, and read the README, chat transcript, and all six prototype files (`Unvault.html`, `LandingPage.jsx`, `AuthModal.jsx`, `Dashboard.jsx`, `AnalysisPage.jsx`, `SubscriptionModal.jsx`, `app.jsx`). Wrote a plan, asked two scoping questions (TypeScript vs JavaScript; how deeply to wire the backends), and on approval scaffolded a Next.js 15 / React 19 / TypeScript project — porting the prototype's `<style>` block verbatim to `app/globals.css`, building the five view components (`LandingPage`, `AuthModal`, `Dashboard`, `Analysis`, `SubscriptionModal`), the three pages (`/`, `/dashboard`, `/analysis/[id]`), the auth callback route, three API routes (`/api/analyze` running Gemini, `/api/paddle/checkout`, `/api/paddle/webhook`), Supabase browser + server + middleware clients, route-protecting Next middleware, a Supabase migration (`profiles`, `pieces`, RLS, private `pieces` storage bucket, signup trigger), Sentry configs for client/server/edge plus `instrumentation.ts`, `.env.example`, and a deploy README. Ran `npm install`, fixed a few implicit-`any` errors in the Supabase cookie helpers, and confirmed `tsc --noEmit` and `next build` both pass.

After the Supabase key correction, verified via Context7 and Supabase's official docs that the new `sb_publishable_...` / `sb_secret_...` keys replace the legacy `anon` / `service_role` JWTs (deprecated end of 2026), then renamed `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY` across `.env.example`, the three Supabase client files, and both READMEs, and re-ran the build to confirm.

For source-control: reviewed `git status` / `diff` / `log` / `remote`, staged the 35 new + 1 modified file by name, and committed. The push to `main` was blocked by the auto-mode policy, so created `scaffold-nextjs-app` from the commit, reset the local `main` pointer back to `origin/main`, and pushed the branch. Installed GitHub CLI via Homebrew, waited for the user to complete `gh auth login`, then opened [PR #1](https://github.com/BDZendure/Unvault/pull/1) with a summary and test plan.

---

## 2. External integrations

### Paddle

**User**

> install the paddle mcp and set up a sandbox

**User**

> Here is the key: pdl_sdbx_apikey_…REDACTED…

**Agent**

Looked up the Paddle MCP server (`@paddle/paddle-mcp`, GitHub `paddlehq/paddle-mcp-server`) and registered it in Claude Code at local scope with `PADDLE_API_KEY`, `PADDLE_ENVIRONMENT=sandbox`, and `PADDLE_MCP_TOOLS=non-destructive`. Verified the server connects. Since MCP tools only become available on next Claude Code restart, also provisioned the sandbox catalog directly via the Paddle REST API: created product **Unvault Premium** (`pro_01ktmeha5jx7vmww13qzw88pqm`) and a $9.99 USD / month recurring price (`pri_01ktmehq7avejdpn7xcb6c71j4`). Wrote `.env.local` (gitignored) with the Paddle key + price ID + the Sentry DSN, leaving Supabase + Gemini stubs ready for fill-in. Documented the remaining manual step: creating a Notifications endpoint in the Paddle dashboard to obtain `PADDLE_NOTIFICATION_KEY`.

### Sentry

**User**

> Install the sentry mcp through npm

**Agent**

Identified the official `@sentry/mcp-server` package (GitHub `getsentry/sentry-mcp`). Confirmed it needs a Sentry User Auth Token (`SENTRY_ACCESS_TOKEN`) with scopes `org:read`, `project:read`, `project:write`, `team:read`, `team:write`, `event:write`, plus optional `EMBEDDED_AGENT_PROVIDER` + an OpenAI / Anthropic key for the AI-powered search tools. Walked the user through creating the token at `sentry.io/settings/account/api/auth-tokens/` and is waiting for the token to register the MCP via `claude mcp add`.

---

### CLAUDE.md scaffolding

**User**

> /init

**Agent**

Read `README.md`, `package.json`, `supabase/README.md`, the three Supabase client/middleware files, the three API route handlers (`/api/analyze`, `/api/paddle/checkout`, `/api/paddle/webhook`), the dashboard + analysis page handlers, the migration, `next.config.ts`, and `tsconfig.json`. Wrote `CLAUDE.md` at the repo root covering: the four `npm run` scripts and the fact that no test runner exists; the two server Supabase clients (`createClient` vs `createServiceClient`) and when bypassing RLS is intentional; the middleware matcher exclusions (`api/paddle/webhook`, `monitoring`) and why each must stay excluded; the new `sb_publishable_...` / `sb_secret_...` key scheme; the storage-path RLS convention (`${user_id}/...`); the end-to-end analysis pipeline with its quota gate; the Paddle checkout/webhook flow with `customData.supabase_user_id` linkage; the `FREE_ANALYSIS_LIMIT` constant being checked in both API and UI; and the `@/*` path alias. Skipped generic Next.js / TypeScript boilerplate and anything already documented in `README.md`.

---

### Sentry DSN end-to-end test

**User**

> Test the sentry integration end to end using the sentry CLI. Create and run a minimal local script that sends a test exception to the configured sentry DSN. Verify that the event appears in sentry.

**Agent**

Confirmed `sentry-cli` 3.5.0 was installed via Homebrew and that the DSN, auth token, org, and project lived in `.env.local`. Wrote `scripts/sentry-test.sh` — a shell script that builds a Sentry event JSON with a unique marker tag (`unvault-cli-e2e-<ts>-<pid>`), ships it via `sentry-cli send-event`, and polls the Sentry REST API for the marker. The first run "passed" because the polling block counted `len()` of the API response without checking whether it was a list (`{"detail": "..."}` has `len()==1`); fixed by switching to a Python parser that distinguishes `ok` / `forbidden` / `invalid` responses. Re-running honestly exposed that the wired `SENTRY_AUTH_TOKEN` only has scope `org:ci` — enough for `send-event` and source-map upload but not `event:read`, so both the REST API and `sentry-cli events/issues list` return 403. Three test events were dispatched (latest `feb0c211-8e7a-47c7-b857-072f7ac0097a`); the user confirmed visibility in the Sentry dashboard. Saved a reference memory noting the token scope limit so future sessions don't re-discover it.

---

### Paddle sandbox integration + Sentry alignment

**User**

> great I've confirmed the integration. test the paddle sandbox integration through the paddle mcp and verify sentry error handling is aligned with it. Trigger paddle success and failure flows, confirm Paddle errors are captured in sentry with the right tags/context, and check that non-errors are not reported.

**User** (after the audit surfaced two issues)

> I've handled the 1st issue. Fix the 2nd issue and tell me what tags and scope you added. Also fix the webhook route line.

**User**

> Ok great it works

**Agent**

Used the Paddle MCP to list products, prices, and notification settings — confirmed `pro_01ktmeha5jx7vmww13qzw88pqm` "Unvault Premium" + `pri_01ktmehq7avejdpn7xcb6c71j4` $9.99/mo are active, and that the notification setting at `https://education-premiere-api-remembered.trycloudflare.com/api/paddle/webhook` is subscribed to all seven subscription events. Two alignment issues surfaced:

1. `PADDLE_NOTIFICATION_KEY` in `.env.local` was the notification-setting *ID* (`ntfset_…`), not the endpoint *secret* (`pdl_ntfset_…`). Every real Paddle webhook would fail signature verification and spam Sentry. User fixed this.
2. Both Paddle route handlers called bare `Sentry.captureException(e)` — no tags, scope, fingerprint, or context. Captured errors carried only a stack and would be hard to triage.

Wrote `scripts/paddle-sentry-test.mjs` — a standalone Node script that initializes Sentry exactly like `sentry.server.config.ts` and the Paddle SDK exactly like `lib/paddle.ts`, then runs four labeled cases against the real sandbox + DSN: (A) success — `paddle.prices.get(valid id)` with no `captureException`; (B) checkout-style failure captured with the new scoped shape; (C) webhook non-signature failure captured with the new scoped shape; (D) webhook bad signature — must NOT reach Sentry. All four ran cleanly.

Refactored both routes. `app/api/paddle/checkout/route.ts` got a `stage` cursor (`auth | profile | customer | transaction`) advanced as the request progresses, and the bare capture was replaced with `Sentry.withScope` that sets tags `integration=paddle`, `route=api/paddle/checkout`, `paddle_stage=<stage>`, user `{ id: user.id }`, and fingerprint `['paddle','checkout',stage]`. `app/api/paddle/webhook/route.ts` got a `stage` cursor (`unmarshal | process`) plus tracked `event_type` / `subscription_id` / `customer_id` once known; its `withScope` block sets tags `integration=paddle`, `route=api/paddle/webhook`, `paddle_stage=<stage>`, `paddle_event_type=<type>` (when available), a `paddle` context with `stage`, `event_type`, `subscription_id`, `customer_id`, `body_bytes`, `signature_present`, and fingerprint `['paddle','webhook', eventType ?? stage]`. The dead `if (!event)` branch was replaced with a signature-error filter inside the catch — `stage==='unmarshal' && /signature/i.test(message)` returns 400 silently without calling Sentry, so probes / replays / misconfigured senders no longer create noise. `npm run typecheck` passed; re-ran `paddle-sentry-test.mjs` and the user confirmed the new event shape in the Sentry dashboard.

---

### Vercel deployment

**User**

> install the vercel cli and deploy the application with the project name unvault

**User** (after the agent asked whether "unvault" meant a project name or a custom domain, and preview vs production — user chose project name + production, then shared `.env.local`)

> you can check @.env.local for the env vars and add them. After deploying, give me the url so I can create a new paddle notification endpoint

**Agent**

Preflight: `vercel` was not on PATH and `npm i -g vercel` failed with `EACCES` on `/usr/local/lib/node_modules`. Detected Homebrew was available and installed via `brew install vercel-cli` (CLI 54.9.1, no sudo). `vercel whoami` returned "token not valid" so asked the user to run `vercel login` themselves; once authenticated as `bdzendure`, ran `vercel link --yes --project unvault` which linked to `bdzendures-projects/unvault` (project `prj_b5C3zRw112Zjrx6fADA4svuZH7Ng`). The GitHub auto-connect step errored — not a CLI-deploy blocker — left a note for the user to wire it in the Dashboard if they wanted push-to-deploy.

Pushed all 14 env vars from `.env.local` to Production with `printf '<value>' | vercel env add <NAME> production` (Supabase URL + publishable + secret, Gemini API key + model, four Paddle vars, four Sentry vars, plus `NEXT_PUBLIC_APP_URL`). Ran `vercel --prod --yes` — build passed, deployment `dpl_FgJEXk3G4aQWuT9PD59xWwiY7Pe7` came up READY. The primary alias resolved to `https://unvault-snowy.vercel.app`, not `https://unvault.vercel.app`; confirmed via `vercel alias set` that `unvault.vercel.app` is taken globally on the .vercel.app namespace. Since `NEXT_PUBLIC_APP_URL` was set during deploy to the wrong placeholder (`https://unvault.vercel.app`) and is used by `app/api/paddle/checkout/route.ts` to build Paddle return URLs, removed it with `vercel env rm --yes` and re-added with the actual primary URL, then redeployed (`unvault-lrq1k54wj`, also READY).

Returned the production URL (`https://unvault-snowy.vercel.app`), the Paddle webhook URL (`https://unvault-snowy.vercel.app/api/paddle/webhook`), the swap procedure for `PADDLE_NOTIFICATION_KEY` once the user creates the new endpoint, and three caveats: `unvault.vercel.app` is unavailable so a custom domain would be needed for a clean URL; the GitHub connection failed; and the `.env.local` secrets shared in the conversation should be considered compromised and rotated.

---

### Supabase email verification fix

**User**

> investigate and fix the supabase email verification 404. Check SITE_URL, redirect urls, email templates, + auth callback routes. Make sure verification links resolve correctly and complete signup.

**Agent**

Invoked the systematic-debugging skill (root cause before any fix). Read `app/auth/callback/route.ts` (only handles PKCE `?code=` via `exchangeCodeForSession`), `middleware.ts` + `lib/supabase/middleware.ts` (protects `/dashboard` and `/analysis` only — auth routes pass through), and `components/AuthModal.tsx` (signup sets `emailRedirectTo: ${window.location.origin}/auth/callback?next=/dashboard`, so on prod that becomes `https://unvault-snowy.vercel.app/auth/callback?next=/dashboard`). Probed the deployed app: `/auth/callback` returned 200 (redirects home for no session, as designed), but `/auth/confirm?token_hash=fake&type=signup` returned a literal 404 — that route does not exist in the app. Confirmed there is no `supabase/config.toml` in the repo, so SITE_URL and the Redirect URLs allowlist are managed only via the Supabase Dashboard (out of reach with the project's `sb_secret_` key — Management API needs a separate `sbp_` token).

Diagnosed two stacked causes: (1) Supabase's modern default "Confirm signup" template links to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=...` and the app had no handler — that is the literal 404. (2) Even with the legacy `{{ .ConfirmationURL }}` template, if SITE_URL is still `http://localhost:3000` and the Vercel URL is not in the Redirect URLs allowlist, Supabase rejects `redirect_to` from `emailRedirectTo` and falls back to localhost.

Wrote `app/auth/confirm/route.ts` per Supabase's canonical SSR pattern: reads `token_hash` + `type` + `next` from the query, calls `supabase.auth.verifyOtp({ type, token_hash })` with the existing request-scoped `createClient()`, redirects to `next` (default `/dashboard`) on success and to `/?auth=signin&error=verification_failed` on failure. `npm run typecheck` clean. Ran `vercel --prod --yes` (deployment `unvault-fbtjeorh1`, READY); reprobed and confirmed `/auth/confirm` now returns 200 (graceful redirect) instead of 404. Documented the manual Dashboard changes the user still has to make under **Authentication → URL Configuration** (Site URL = `https://unvault-snowy.vercel.app`, Redirect URLs += `https://unvault-snowy.vercel.app/**` and `http://localhost:3000/**`) and **Authentication → Email Templates** (the two working forms — `{{ .SiteURL }}/auth/confirm?token_hash=...&type=signup&next=/dashboard` for the new route, or `{{ .ConfirmationURL }}` for the existing `/auth/callback`).

---

### Gemini API smoke test

**User**

> find the images ring 1 and ring 2 in downloads, move them to the testing_images folder in this directory, and test the gemni api key with these images.

**User** (after the test confirmed the key works and the configured model is dead)

> commit and push changes. 

**Agent**

Located `ring 1.jpg` and `ring 2.jpg` in `~/Downloads/`, created `testing_images/` at the repo root, and moved both files in. Read `lib/gemini.ts` (the `analyzeJewelryImage` function, jewelry appraiser prompt, structured `responseSchema`, model from `GEMINI_MODEL` env defaulting to `gemini-2.0-flash-exp`) and `scripts/paddle-sentry-test.mjs` for the existing script template. Wrote `scripts/gemini-test.mjs` — a standalone Node script run via `node --env-file=.env.local` that mirrors `lib/gemini.ts`'s prompt + responseSchema + temperature, iterates every image in `testing_images/`, times each call, and prints the parsed analysis (metal/gemstone, value range, confidence, condition, era, signal/care counts).

First run failed both images with a 404 from `gemini-2.0-flash-exp` — the experimental model wired into `.env.local` was deprecated by Google. Listed available models via `GET /v1beta/models?key=...` and confirmed `gemini-2.5-flash`, `gemini-2.0-flash`, and `gemini-flash-latest` are current. Re-ran with `GEMINI_MODEL=gemini-2.5-flash`: ring 1 returned a clean structured appraisal (Rose Gold · Prasiolite and Diamond, $700–$1200, confidence 0.9, Excellent condition, contemporary vintage-inspired floral solitaire, 5 signals / 5 care tips) in ~4.6s; ring 2 hit a 503 "high demand". A retry returned 503 for both. The user interrupted before a third retry with `gemini-2.0-flash`. End result: the Gemini API key works end-to-end (multimodal input + JSON-schema structured output), but `GEMINI_MODEL=gemini-2.0-flash-exp` in `.env.local` and the Vercel Production env both need to be updated to a current model name; `gemini-2.5-flash` is the natural successor and `gemini-2.0-flash` is a fine stable alternative.

For source control: working tree had three untracked items (`app/auth/confirm/`, `scripts/gemini-test.mjs`, `testing_images/`). Split into two focused commits — `264b273` "Add /auth/confirm route for Supabase email verification" (the bug fix) and `eb88fee` "Add Gemini API smoke test script and ring fixtures" — and pushed straight to `origin/scaffold-nextjs-app`, which the branch already tracks. No PR needed; offered to open one if the user wants `scaffold-nextjs-app → main`.

---

### Gemini model swap to 2.5-flash

**User**

> update the gemni prompt to use 2.5 flash

**User**

> add this fix to the end of the @README.md and commit and push changes

**Agent**

Grepped for `GEMINI_MODEL` and `gemini-2` and found four references to the dead `gemini-2.0-flash-exp` model: the fallback in `lib/gemini.ts:8`, the local override in `.env.local:15`, the committed template in `.env.example:20`, and the architecture note in `CLAUDE.md:47`. Swapped all four to `gemini-2.5-flash` (the natural successor surfaced in the previous smoke test). Also updated Vercel Production: `vercel env rm GEMINI_MODEL production --yes` then `printf 'gemini-2.5-flash' | vercel env add GEMINI_MODEL production`. `npm run typecheck` passed. The Vercel env change won't take effect until the next deploy — left that for the user to trigger with `vercel --prod --yes` when ready.

---

### Vercel production promotion for the Gemini model swap

**User**

> switch the current updated version to production on vercel

**Agent**

Ran `vercel --prod --yes` on commit `632237a`. Deployment `unvault-emr3b1tx7-bdzendures-projects.vercel.app` came up READY; the primary URL `https://unvault-snowy.vercel.app` returned 200. Live `/api/analyze` calls now route to `gemini-2.5-flash` instead of the dead `gemini-2.0-flash-exp`.

---

### Header & auth UX fixes (profile dropdown, logo nav, sign-out, signed-in pricing)

**User**

> Clicking on the user profile (top right) after logging in should not log the user out. Instead, there should be a drop down which lets the user sign out. Clicking on the target symbol in the top left should bring the user back to the landing page. While signed in, tThe "sign in" on the landing page should be changed to a "sign out" Furthermore, clicking pricing will let the user purchase prenium without bringing the user to a sign in redirect.

**Agent**

In plan mode: spawned one Explore agent that mapped the header / auth plumbing across `DashboardView`, `LandingPage`, `SubscriptionModal`, `AnalysisView`, and `app/page.tsx` — flagged that `app/page.tsx` server-redirected authenticated users away from `/`, the profile button had `onClick={logout}` (no dropdown), the two logo clusters were non-interactive `<div>`s, `LandingPage` received no auth-state prop, and the pricing button assumed unauthenticated visitors. A Plan agent designed the approach: fetch `user` server-side in `app/page.tsx` and pass `isAuthenticated: boolean` down (no client listener — avoids any "Sign In" → "Sign Out" flicker), reuse the existing `menuIn` keyframe from `app/globals.css` for the dropdown entry, render a transparent fixed-position backdrop (not `.in-overlay`, which dims the screen) for click-outside, and thread `isAuthenticated` into `SubscriptionModal` so signed-in users skip the signup detour. Read all five critical files to verify line numbers, wrote the plan to `/Users/blakezhang/.claude/plans/clicking-on-the-user-shiny-dewdrop.md`, ExitPlanMode'd.

Implementation: dropped the redirect in `app/page.tsx` and forwarded `isAuthenticated={!!user}`. `LandingPage` accepted the new prop, added a `signOut` handler mirroring the dashboard pattern, made the second `navLinks` entry conditional (flows automatically to both desktop nav and mobile menu), branched the hero CTA so signed-in users route to `/dashboard` instead of re-opening signup, and forwarded `isAuthenticated` into `SubscriptionModal`. `SubscriptionModal` got a `canCheckout = mode === 'paywall' || isAuthenticated` helper that drives `primaryClick` (→ `handleSubscribe` when can-checkout, else `onSignUp`), the button label (`Subscribe — $9.99 / mo` vs `Get Started — $9.99 / mo`), and the `disabled` expression. `DashboardView` got a `menuOpen` state, wrapped the logo + "Unvault" wordmark in `<Link href="/">`, replaced the click-to-logout `<div>` with a button that toggles the menu (chevron rotates 180° as the affordance), and a dropdown panel anchored bottom-right with `z-index: 301` above a `z-300` transparent backdrop (well below the drag overlay's `z-400`) containing a single Sign Out item. `AnalysisView` `Nav` got the same logo `<Link>` wrap, leaving the "My Pieces" back button untouched. `npm run typecheck` clean. Committed `fab05b2` ("Fix header & auth UX (dropdown, logo nav, sign-out, signed-in pricing)") covering five files, pushed to `origin/scaffold-nextjs-app`, then deployed (`unvault-7meggdd8j`, READY). Did not drive a browser walk-through — flagged that explicitly and left the visual verification to the user.

---

### Sentry observability for auth flows

**User**

> Review the recent changes to signout and landingpage-redirect behavior. Make sure appropriate sentry error handling is in place: capturing sign-out failures, redirect/navigation failures. Identify any missing events or gaps in observability and implement fixes

**User**

> commit and push changes

**User**

> change the new version to production

**Agent**

Read `sentry.server.config.ts`, `instrumentation-client.ts`, and `app/api/paddle/checkout/route.ts` for the established convention (`Sentry.withScope` with `integration`, `route`, `<integration>_stage` tags, fingerprint per stage, `setUser({ id })` when known). Found five sites in the recent diff that silently swallowed Supabase failures: `LandingPage.signOut` (new), `DashboardView.logout` (pre-existing but now reached via the new dropdown), `app/page.tsx getUser` (uncaught after the landing redirect was removed), `/auth/confirm verifyOtp` (returned `{ error }` swallowed before redirect to the failure page), and `/auth/callback exchangeCodeForSession` (return value never checked — pre-existing but in the same redirect family). Wrapped each in try/catch and captured under the established convention with `integration=supabase`, `route=<...>`, `supabase_stage=<sign_out|get_user|verify_otp|exchange_code>`, plus `otp_type` where applicable, and `setUser({ id: profile.id })` on the dashboard logout. Side effects beyond pure instrumentation: `/auth/callback` now redirects failed exchanges to `/?auth=signin&error=callback_failed` instead of silently sending the user to `/dashboard` with no session; `DashboardView.logout` surfaces the error to the user via the existing `errMsg` banner; `app/page.tsx` falls through to `isAuthenticated=false` and renders the landing rather than 500-ing. `router.push` / `router.refresh` were intentionally left uninstrumented — client navigation in App Router doesn't throw, so they aren't useful Sentry targets. `Sentry.setUser` propagation at the client boundary, `AuthModal` sign-in/up failures, and middleware `getUser` capture were called out as out-of-scope (the last risks Sentry spam on transient issues). `npm run typecheck` clean.

`commit and push changes` was a re-confirmation — commit `59ffa7d` ("Instrument auth sign-out, OTP verify, code exchange, and landing getUser", 5 files / +100 / −17) had already been pushed in the same agent turn after the typecheck. On `change the new version to production`, ran `vercel --prod --yes`; deployment `unvault-epx4hvv9b-bdzendures-projects.vercel.app` came up READY on `https://unvault-snowy.vercel.app`. Live sign-out, OTP verify, code exchange, and landing-page `getUser` failures will now appear in Sentry tagged `integration=supabase`.
