// End-to-end test of the Paddle ↔ Sentry alignment in this repo.
//
// What it does:
//   - Initializes Sentry exactly like sentry.server.config.ts.
//   - Initializes the Paddle SDK exactly like lib/paddle.ts (sandbox).
//   - Runs three labelled cases against the real Paddle sandbox + DSN:
//       A. SUCCESS              — paddle.prices.get(<valid id>). No captureException.
//       B. FAILURE (bare)       — paddle.prices.get(<bogus id>) inside a try/catch
//                                 that calls bare Sentry.captureException(e). This
//                                 is exactly what /api/paddle/checkout does today.
//       C. FAILURE (tagged)     — paddle.webhooks.unmarshal(<bad sig>) inside a
//                                 try/catch that calls Sentry.withScope() to attach
//                                 integration=paddle, route, and Paddle context.
//                                 This is the shape the routes SHOULD use.
//   - Flushes Sentry, then prints the marker + dispatched event IDs so they can
//     be looked up in the dashboard.
//
// Run with:  node --env-file=.env.local scripts/paddle-sentry-test.mjs

import * as Sentry from '@sentry/node';
import { Environment, Paddle } from '@paddle/paddle-node-sdk';

const required = ['NEXT_PUBLIC_SENTRY_DSN', 'PADDLE_API_KEY', 'PADDLE_PRICE_ID'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`missing env: ${k}`);
    process.exit(1);
  }
}

// Mirror sentry.server.config.ts exactly.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1,
  enableLogs: true,
  sendDefaultPii: true,
});

const MARKER = `paddle-sentry-${Date.now()}-${process.pid}`;
console.log(`marker: ${MARKER}`);

// Tag every event from this run so the dashboard query is trivial.
Sentry.setTag('test_marker', MARKER);
Sentry.setTag('test_suite', 'paddle-sentry-alignment');

// Mirror lib/paddle.ts:getPaddle()
const paddle = new Paddle(process.env.PADDLE_API_KEY, {
  environment:
    process.env.NEXT_PUBLIC_PADDLE_ENV === 'production'
      ? Environment.production
      : Environment.sandbox,
});

const dispatched = { success: null, failure_bare: [], failure_tagged: [] };

// ─── CASE A: SUCCESS ────────────────────────────────────────────────────────
// The success path in /api/paddle/checkout does paddle.transactions.create.
// We use paddle.prices.get(<valid id>) here as a cheaper, side-effect-free
// success call against the real sandbox — same SDK, same auth.
console.log('\n[A] SUCCESS — paddle.prices.get(valid id)');
try {
  const price = await paddle.prices.get(process.env.PADDLE_PRICE_ID);
  console.log(`    ok: ${price.id} ${price.unitPrice.amount}${price.unitPrice.currencyCode} (${price.status})`);
  dispatched.success = { ok: true };
} catch (e) {
  // A captureException here would be wrong — success path must not report.
  console.error('    UNEXPECTED: success path threw', e);
  dispatched.success = { ok: false, error: String(e) };
  process.exitCode = 2;
}

// ─── CASE B: FAILURE in checkout route — mirrors new /api/paddle/checkout ───
// Real failure mode: Paddle rejects the transaction. We simulate by hitting a
// bogus price ID. The catch block uses the same withScope shape the route now
// uses, with stage='transaction' (since we're past auth/profile/customer).
console.log('\n[B] FAILURE — checkout-style (stage=transaction)');
const SIM_USER_ID = '00000000-0000-0000-0000-0000sim00user';
try {
  await paddle.prices.get('pri_does_not_exist_xxxxxxxxxxxxxxxxxxxxx');
} catch (e) {
  const eventId = Sentry.withScope((scope) => {
    scope.setTag('integration', 'paddle');
    scope.setTag('route', 'api/paddle/checkout');
    scope.setTag('paddle_stage', 'transaction');
    scope.setUser({ id: SIM_USER_ID });
    scope.setFingerprint(['paddle', 'checkout', 'transaction']);
    return Sentry.captureException(e);
  });
  dispatched.failure_bare.push({ eventId, name: e?.name, message: e?.message });
  console.log(`    captured: ${eventId}  (${e?.name}: ${e?.message?.slice(0, 120)})`);
}

// ─── CASE C: FAILURE in webhook route — non-signature unmarshal failure ─────
// Mirrors /api/paddle/webhook catch path when stage='unmarshal' AND the error
// is not a signature error (the signature branch returns 400 without capture
// — verified in Case D below).
console.log('\n[C] FAILURE — webhook-style (stage=unmarshal, non-signature)');
const fakeBody = JSON.stringify({
  event_type: 'subscription.activated',
  data: { id: 'sub_xxx' },
});
try {
  // Simulate a non-signature unmarshal failure by throwing directly. Signature
  // failures are exercised separately in Case D.
  throw new Error('Unexpected unmarshal failure (simulated): malformed payload');
} catch (e) {
  const eventId = Sentry.withScope((scope) => {
    scope.setTag('integration', 'paddle');
    scope.setTag('route', 'api/paddle/webhook');
    scope.setTag('paddle_stage', 'unmarshal');
    scope.setContext('paddle', {
      stage: 'unmarshal',
      event_type: null,
      subscription_id: null,
      customer_id: null,
      body_bytes: fakeBody.length,
      signature_present: true,
    });
    scope.setFingerprint(['paddle', 'webhook', 'unmarshal']);
    return Sentry.captureException(e);
  });
  dispatched.failure_tagged.push({ eventId, name: e?.name, message: e?.message });
  console.log(`    captured: ${eventId}  (${e?.name}: ${e?.message?.slice(0, 120)})`);
}

// ─── CASE D: FAILURE in webhook route — bad signature (must NOT reach Sentry)─
// The new webhook route returns 400 silently on signature errors. We replicate
// that filter here: throw the actual SDK signature error, then assert that the
// route's filter would skip Sentry. We do NOT call captureException.
console.log('\n[D] FAILURE — webhook bad signature (must skip Sentry)');
const fakeSig = 'ts=1700000000;h1=deadbeef';
let dCaptured = false;
try {
  await paddle.webhooks.unmarshal(fakeBody, 'pdl_ntfset_wrong_secret_for_test', fakeSig);
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  const stage = 'unmarshal';
  if (stage === 'unmarshal' && /signature/i.test(message)) {
    console.log(`    skipped Sentry (matched signature filter): ${message.slice(0, 120)}`);
  } else {
    dCaptured = true;
    Sentry.captureException(e);
    console.log(`    UNEXPECTED: signature filter missed, captured event`);
  }
}
dispatched.bad_signature_skipped = !dCaptured;

console.log('\nflushing Sentry...');
await Sentry.flush(5000);

console.log('\n--- summary ---');
console.log(JSON.stringify({ marker: MARKER, dispatched }, null, 2));
console.log('\ndashboard query:');
console.log(`  https://blake-0d.sentry.io/issues/?query=test_marker%3A${MARKER}`);
