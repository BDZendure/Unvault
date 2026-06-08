import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getPaddle, priceId } from '@/lib/paddle';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const admin = createServiceClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('paddle_customer_id, email, name')
      .eq('id', user.id)
      .maybeSingle();

    const paddle = getPaddle();
    let customerId = profile?.paddle_customer_id ?? null;

    if (!customerId) {
      const customer = await paddle.customers.create({
        email: user.email ?? profile?.email ?? '',
        name: profile?.name ?? undefined,
      });
      customerId = customer.id;
      await admin
        .from('profiles')
        .update({ paddle_customer_id: customerId })
        .eq('id', user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const tx = await paddle.transactions.create({
      items: [{ priceId: priceId(), quantity: 1 }],
      customerId,
      customData: { supabase_user_id: user.id },
      checkout: { url: `${appUrl}/dashboard?subscribed=1` },
    });

    const url = tx.checkout?.url;
    if (!url) throw new Error('Paddle did not return a checkout URL');
    return NextResponse.json({ url });
  } catch (e) {
    Sentry.captureException(e);
    const message = e instanceof Error ? e.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
