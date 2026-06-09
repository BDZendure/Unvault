import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';

function captureExchangeError(e: unknown) {
  Sentry.withScope((scope) => {
    scope.setTag('integration', 'supabase');
    scope.setTag('route', 'auth/callback');
    scope.setTag('supabase_stage', 'exchange_code');
    scope.setFingerprint(['supabase', 'exchange_code', 'callback']);
    Sentry.captureException(e);
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        captureExchangeError(error);
        const errorUrl = new URL('/', url.origin);
        errorUrl.searchParams.set('auth', 'signin');
        errorUrl.searchParams.set('error', 'callback_failed');
        return NextResponse.redirect(errorUrl);
      }
    } catch (e) {
      captureExchangeError(e);
      const errorUrl = new URL('/', url.origin);
      errorUrl.searchParams.set('auth', 'signin');
      errorUrl.searchParams.set('error', 'callback_failed');
      return NextResponse.redirect(errorUrl);
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
