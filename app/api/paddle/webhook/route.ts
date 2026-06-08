import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { EventName } from '@paddle/paddle-node-sdk';
import { getPaddle } from '@/lib/paddle';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const signature = request.headers.get('paddle-signature') ?? '';
  const secret = process.env.PADDLE_NOTIFICATION_KEY;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const raw = await request.text();
  // Stage tracks how far we got before throwing. The captured event tags
  // unmarshal-time vs processing-time errors distinctly so they group apart.
  let stage: 'unmarshal' | 'process' = 'unmarshal';
  let eventType: string | null = null;
  let subscriptionId: string | null = null;
  let customerIdFromEvent: string | null = null;

  try {
    const paddle = getPaddle();
    const event = await paddle.webhooks.unmarshal(raw, secret, signature);
    stage = 'process';
    eventType = event.eventType;

    const admin = createServiceClient();

    if (
      event.eventType === EventName.SubscriptionActivated ||
      event.eventType === EventName.SubscriptionCreated ||
      event.eventType === EventName.SubscriptionUpdated ||
      event.eventType === EventName.SubscriptionResumed
    ) {
      const sub = event.data;
      subscriptionId = sub.id;
      customerIdFromEvent = sub.customerId;
      const userId =
        (sub.customData as { supabase_user_id?: string } | null)?.supabase_user_id ?? null;
      const isActive = sub.status === 'active' || sub.status === 'trialing';

      if (userId) {
        await admin
          .from('profiles')
          .update({
            is_premium: isActive,
            paddle_customer_id: sub.customerId,
            paddle_subscription_id: sub.id,
          })
          .eq('id', userId);
      } else {
        await admin
          .from('profiles')
          .update({
            is_premium: isActive,
            paddle_subscription_id: sub.id,
          })
          .eq('paddle_customer_id', sub.customerId);
      }
    } else if (
      event.eventType === EventName.SubscriptionCanceled ||
      event.eventType === EventName.SubscriptionPastDue ||
      event.eventType === EventName.SubscriptionPaused
    ) {
      const sub = event.data;
      subscriptionId = sub.id;
      customerIdFromEvent = sub.customerId;
      await admin
        .from('profiles')
        .update({ is_premium: false })
        .eq('paddle_subscription_id', sub.id);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    // Bad signatures (probes, replays, misconfigured senders) are expected
    // noise. Return 400 without capturing so real bugs aren't drowned out.
    if (stage === 'unmarshal' && /signature/i.test(message)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    Sentry.withScope((scope) => {
      scope.setTag('integration', 'paddle');
      scope.setTag('route', 'api/paddle/webhook');
      scope.setTag('paddle_stage', stage);
      if (eventType) scope.setTag('paddle_event_type', eventType);
      scope.setContext('paddle', {
        stage,
        event_type: eventType,
        subscription_id: subscriptionId,
        customer_id: customerIdFromEvent,
        body_bytes: raw.length,
        signature_present: Boolean(signature),
      });
      scope.setFingerprint(
        eventType ? ['paddle', 'webhook', eventType] : ['paddle', 'webhook', stage],
      );
      Sentry.captureException(e);
    });

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
