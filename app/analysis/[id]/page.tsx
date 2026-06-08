import { notFound, redirect } from 'next/navigation';
import AnalysisView from '@/components/AnalysisView';
import { createClient } from '@/lib/supabase/server';
import type { Piece } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pieceId = Number(id);
  if (!Number.isFinite(pieceId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: row, error } = await supabase
    .from('pieces')
    .select('*')
    .eq('id', pieceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !row) notFound();

  let image_url: string | null = null;
  if (row.image_path) {
    const { data: signed } = await supabase.storage
      .from('pieces')
      .createSignedUrl(row.image_path, 60 * 60);
    image_url = signed?.signedUrl ?? null;
  }

  const piece: Piece = {
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

  return <AnalysisView piece={piece} needsAnalysis={piece.status !== 'analyzed'} />;
}
