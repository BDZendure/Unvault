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

  try {
    const paddle = getPaddle();
    const event = await paddle.webhooks.unmarshal(raw, secret, signature);
    if (!event) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const admin = createServiceClient();

    if (
      event.eventType === EventName.SubscriptionActivated ||
      event.eventType === EventName.SubscriptionCreated ||
      event.eventType === EventName.SubscriptionUpdated ||
      event.eventType === EventName.SubscriptionResumed
    ) {
      const sub = event.data;
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
      await admin
        .from('profiles')
        .update({ is_premium: false })
        .eq('paddle_subscription_id', sub.id);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    Sentry.captureException(e);
    const message = e instanceof Error ? e.message : 'Webhook error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
