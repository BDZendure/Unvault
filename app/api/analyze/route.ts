import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { analyzeJewelryImage } from '@/lib/gemini';
import { FREE_ANALYSIS_LIMIT } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { pieceId?: number };
    const pieceId = Number(body.pieceId);
    if (!Number.isFinite(pieceId)) {
      return NextResponse.json({ error: 'Missing pieceId' }, { status: 400 });
    }

    const admin = createServiceClient();

    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('id, is_premium, analyses_used')
      .eq('id', user.id)
      .maybeSingle();
    if (profErr) throw profErr;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { data: piece, error: pieceErr } = await admin
      .from('pieces')
      .select('*')
      .eq('id', pieceId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (pieceErr) throw pieceErr;
    if (!piece) {
      return NextResponse.json({ error: 'Piece not found' }, { status: 404 });
    }

    if (piece.status === 'analyzed' && piece.analysis) {
      return NextResponse.json({ analysis: piece.analysis, cached: true });
    }

    if (!profile.is_premium && profile.analyses_used >= FREE_ANALYSIS_LIMIT) {
      return NextResponse.json(
        { error: 'Free analyses exhausted', reason: 'quota_exceeded' },
        { status: 402 },
      );
    }

    const { data: signed, error: signErr } = await admin.storage
      .from('pieces')
      .createSignedUrl(piece.image_path, 60);
    if (signErr || !signed?.signedUrl) {
      throw signErr ?? new Error('Could not sign image URL');
    }

    const fileRes = await fetch(signed.signedUrl);
    if (!fileRes.ok) throw new Error(`Image fetch failed (${fileRes.status})`);
    const imageBytes = new Uint8Array(await fileRes.arrayBuffer());
    const mimeType = fileRes.headers.get('content-type') || 'image/jpeg';

    const analysis = await analyzeJewelryImage({
      imageBytes,
      mimeType,
      pieceName: piece.name,
    });

    const { error: updPieceErr } = await admin
      .from('pieces')
      .update({ status: 'analyzed', analysis })
      .eq('id', piece.id);
    if (updPieceErr) throw updPieceErr;

    if (!profile.is_premium) {
      const { error: updProfErr } = await admin
        .from('profiles')
        .update({ analyses_used: profile.analyses_used + 1 })
        .eq('id', profile.id);
      if (updProfErr) throw updProfErr;
    }

    return NextResponse.json({ analysis });
  } catch (e) {
    Sentry.captureException(e);
    const message = e instanceof Error ? e.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
