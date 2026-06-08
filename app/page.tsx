import * as Sentry from '@sentry/nextjs';
import LandingPage from '@/components/LandingPage';
import { createClient } from '@/lib/supabase/server';
import type { AuthMode } from '@/components/AuthModal';

type Props = {
  searchParams: Promise<{ auth?: string }>;
};

export default async function Page({ searchParams }: Props) {
  let isAuthenticated = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = !!user;
  } catch (e) {
    Sentry.withScope((scope) => {
      scope.setTag('integration', 'supabase');
      scope.setTag('route', 'landing');
      scope.setTag('supabase_stage', 'get_user');
      scope.setFingerprint(['supabase', 'get_user', 'landing']);
      Sentry.captureException(e);
    });
    // Fall through and render landing as unauthenticated.
  }

  const { auth } = await searchParams;
  const initialAuth: AuthMode | null =
    auth === 'signin' || auth === 'signup' ? auth : null;
  return <LandingPage initialAuth={initialAuth} isAuthenticated={isAuthenticated} />;
}
