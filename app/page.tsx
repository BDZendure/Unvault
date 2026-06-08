import { redirect } from 'next/navigation';
import LandingPage from '@/components/LandingPage';
import { createClient } from '@/lib/supabase/server';
import type { AuthMode } from '@/components/AuthModal';

type Props = {
  searchParams: Promise<{ auth?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  const { auth } = await searchParams;
  const initialAuth: AuthMode | null =
    auth === 'signin' || auth === 'signup' ? auth : null;
  return <LandingPage initialAuth={initialAuth} />;
}
