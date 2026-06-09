import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';

function captureVerifyError(e: unknown, type: EmailOtpType | null) {
  Sentry.withScope((scope) => {
    scope.setTag('integration', 'supabase');
    scope.setTag('route', 'auth/confirm');
    scope.setTag('supabase_stage', 'verify_otp');
    if (type) scope.setTag('otp_type', type);
    scope.setFingerprint(['supabase', 'verify_otp', type ?? 'unknown']);
    Sentry.captureException(e);
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';

  try {
    if (token_hash && type) {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ type, token_hash });
      if (!error) {
        return NextResponse.redirect(new URL(next, request.url));
      }
      captureVerifyError(error, type);
    }
  } catch (e) {
    captureVerifyError(e, type);
  }

  const errorUrl = new URL('/', request.url);
  errorUrl.searchParams.set('auth', 'signin');
  errorUrl.searchParams.set('error', 'verification_failed');
  return NextResponse.redirect(errorUrl);
}
