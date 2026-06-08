import { redirect } from 'next/navigation';
import DashboardView from '@/components/DashboardView';
import { createClient } from '@/lib/supabase/server';
import type { Piece, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const [{ data: profileRow }, { data: piecesRows }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('pieces')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const profile: Profile = profileRow ?? {
    id: user.id,
    email: user.email ?? '',
    name: (user.user_metadata?.name as string | undefined) ?? null,
    is_premium: false,
    analyses_used: 0,
    paddle_customer_id: null,
    paddle_subscription_id: null,
  };

  const pieces: Piece[] = await Promise.all(
    (piecesRows ?? []).map(async (row: PieceRow) => {
      let image_url: string | null = null;
      if (row.image_path) {
        const { data: signed } = await supabase.storage
          .from('pieces')
          .createSignedUrl(row.image_path, 60 * 60);
        image_url = signed?.signedUrl ?? null;
      }
      return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        image_path: row.image_path,
        image_url,
        status: row.status,
        analysis: row.analysis,
        created_at: row.created_at,
        date: new Date(row.created_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        }),
      };
    }),
  );

  return <DashboardView profile={profile} pieces={pieces} />;
}

type PieceRow = {
  id: number;
  user_id: string;
  name: string;
  image_path: string;
  status: Piece['status'];
  analysis: Piece['analysis'];
  created_at: string;
};
