'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/client';
import type { Piece, Profile } from '@/lib/types';
import { FREE_ANALYSIS_LIMIT } from '@/lib/types';
import SubscriptionModal from './SubscriptionModal';

const THUMB_GRADIENTS = [
  'radial-gradient(ellipse at 42% 38%, #D4A84C 0%, #6B4208 45%, #1A0E00 100%)',
  'linear-gradient(155deg,#BFA0C0 0%,#7A4D7A 40%,#2A0E30 100%)',
  'radial-gradient(ellipse at 55% 45%,#6CA8D4 0%,#1A4060 50%,#060E18 100%)',
  'linear-gradient(140deg,#C0A882 0%,#7A6040 45%,#2A1E0C 100%)',
  'radial-gradient(ellipse at 40% 50%,#D48C6C 0%,#6B3418 50%,#1A0800 100%)',
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DashboardView({
  profile,
  pieces,
}: {
  profile: Profile;
  pieces: Piece[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const remaining = profile.is_premium
    ? Infinity
    : Math.max(0, FREE_ANALYSIS_LIMIT - profile.analyses_used);

  async function processFile(file: File | undefined | null) {
    if (!file || !file.type.startsWith('image/')) return;
    setErrMsg('');
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const cleanName = file.name.replace(/\.[^.]+$/, '') || 'New Piece';
      const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('pieces')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('pieces').insert({
        user_id: profile.id,
        name: cleanName,
        image_path: path,
        status: 'pending',
      });
      if (insErr) throw insErr;

      router.refresh();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function analyze(pieceId: number) {
    if (!profile.is_premium && profile.analyses_used >= FREE_ANALYSIS_LIMIT) {
      setPaywallOpen(true);
      return;
    }
    setErrMsg('');
    setAnalyzingId(pieceId);
    router.push(`/analysis/${pieceId}`);
  }

  async function logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/');
      router.refresh();
    } catch (e) {
      Sentry.withScope((scope) => {
        scope.setTag('integration', 'supabase');
        scope.setTag('route', 'dashboard');
        scope.setTag('supabase_stage', 'sign_out');
        if (profile?.id) scope.setUser({ id: profile.id });
        scope.setFingerprint(['supabase', 'sign_out', 'dashboard']);
        Sentry.captureException(e);
      });
      setErrMsg(e instanceof Error ? e.message : 'Sign out failed.');
    }
  }

  return (
    <div
      style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!e.currentTarget.contains(next)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        processFile(e.dataTransfer.files[0]);
      }}
    >
      {dragging && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(94,14,215,.06)', border: '2px dashed rgba(94,14,215,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style={{ opacity: 0.5, marginBottom: 12 }}>
              <rect x="3" y="3" width="46" height="46" rx="10" stroke="#5E0ED7" strokeWidth="2" strokeDasharray="6 4" />
              <path d="M26 18v16M18 26l8-8 8 8" stroke="#5E0ED7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p style={{ color: '#5E0ED7', fontSize: 17, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Drop to Upload</p>
          </div>
        </div>
      )}

      <nav style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 200 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
          <div className="lp-logo"><div className="lp-logo-dot" /></div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '.1em', textTransform: 'uppercase' }}>Unvault</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {profile.is_premium && (
            <span className="in-badge in-badge-acc" style={{ gap: 5 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 9h8M4 9l1-4 3 2 2-5 2 7" stroke="var(--acc)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Premium
            </span>
          )}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: 8, padding: '6px 10px', transition: 'background .15s', background: menuOpen ? '#f5f5f7' : 'transparent', border: 'none', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.background = '#f5f5f7'; }}
              onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = 'transparent'; }}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#5E0ED7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {(profile.name || profile.email || 'U')[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name || profile.email}</span>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: '#ccc', flexShrink: 0, transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                <path d="M2 4.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'transparent' }}
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 301, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.08)', minWidth: 180, padding: 6, animation: 'menuIn .18s ease' }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); logout(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 7, fontFamily: 'inherit', fontSize: 13, color: 'var(--text2)', textAlign: 'left', transition: 'background .15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f7')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M9 4V2.5A1.5 1.5 0 0 0 7.5 1h-4A1.5 1.5 0 0 0 2 2.5v9A1.5 1.5 0 0 0 3.5 13h4A1.5 1.5 0 0 0 9 11.5V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6 7h7M11 4.5L13.5 7 11 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <main style={{ flex: 1, padding: 40, maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1, marginBottom: 6 }}>My Pieces</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              {pieces.length === 0
                ? 'Upload your first piece'
                : `${pieces.length} piece${pieces.length !== 1 ? 's' : ''} in your vault`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {!profile.is_premium && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px' }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{ width: 7, height: 7, borderRadius: '50%', background: i < profile.analyses_used ? '#5E0ED7' : '#e5e5e5', transition: 'background .3s' }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: remaining === 0 ? 'var(--warn)' : 'var(--text2)' }}>
                  {remaining === 0
                    ? 'No free analyses left'
                    : `${remaining} free ${remaining === 1 ? 'analysis' : 'analyses'} left`}
                </span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                processFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button
              className="in-btn in-btn-primary"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M7.5 2v9M3.5 6.5l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 13h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {uploading ? 'Uploading…' : 'Add New Piece'}
            </button>
          </div>
        </div>

        {errMsg && (
          <p style={{ fontSize: 13, color: 'var(--err)', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 8, padding: '9px 12px', marginBottom: 16 }}>
            {errMsg}
          </p>
        )}

        {pieces.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 72, height: 72, borderRadius: 18, background: 'var(--acc-dim)', border: '1px solid var(--acc-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 6v14M10 12l6-6 6 6" stroke="#5E0ED7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 26h20" stroke="#5E0ED7" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 8 }}>Your vault is empty</h3>
            <p style={{ color: 'var(--text2)', fontSize: 14, maxWidth: 340, margin: '0 auto 24px', lineHeight: 1.7 }}>
              Upload a photo of any jewelry piece to begin your first AI analysis.
            </p>
            <button className="in-btn in-btn-primary" onClick={() => fileRef.current?.click()}>
              Upload Your First Piece
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 18 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: '1.5px dashed rgba(94,14,215,.3)', borderRadius: 16, aspectRatio: '3/4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', transition: 'all .2s', background: 'rgba(94,14,215,.02)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(94,14,215,.6)'; e.currentTarget.style.background = 'rgba(94,14,215,.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(94,14,215,.3)'; e.currentTarget.style.background = 'rgba(94,14,215,.02)'; }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 11, border: '1.5px dashed rgba(94,14,215,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(94,14,215,.5)' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'rgba(94,14,215,.7)', fontSize: 13, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>Add New Piece</p>
                <p style={{ color: '#bbb', fontSize: 12, marginTop: 3 }}>Drag &amp; drop or click</p>
              </div>
            </div>

            {pieces.map((p, idx) => {
              const thumb = p.image_url ?? null;
              const isAnalyzed = p.status === 'analyzed';
              const isAnalyzing = analyzingId === p.id;
              return (
                <div
                  key={p.id}
                  className="in-card"
                  style={{ overflow: 'hidden', transition: 'transform .2s', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
                  onClick={() => isAnalyzed && router.push(`/analysis/${p.id}`)}
                >
                  <div
                    style={{
                      aspectRatio: '4/3',
                      background: thumb ? '#000' : THUMB_GRADIENTS[idx % THUMB_GRADIENTS.length],
                      backgroundImage: thumb ? `url(${thumb})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                      {isAnalyzed ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ok)', letterSpacing: '.08em', textTransform: 'uppercase', textShadow: '0 1px 4px rgba(255,255,255,.6)' }}>ANALYZED</span>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)', letterSpacing: '.04em', textShadow: '0 1px 4px rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)', display: 'inline-block', animation: 'blink 1.4s ease infinite', flexShrink: 0 }} />
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px 16px' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3, letterSpacing: '-.01em' }}>{p.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase' }}>{p.date || formatDate(p.created_at)}</p>
                      {p.analysis?.estimatedValue && (
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--acc)', letterSpacing: '-.01em' }}>
                          ${p.analysis.estimatedValue.low.toLocaleString()} – ${p.analysis.estimatedValue.high.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button
                      className={`in-btn ${isAnalyzed ? 'in-btn-ghost' : 'in-btn-primary'}`}
                      style={{ width: '100%', justifyContent: 'center', padding: 9, fontSize: 12 }}
                      disabled={isAnalyzing}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isAnalyzed) router.push(`/analysis/${p.id}`);
                        else analyze(p.id);
                      }}
                    >
                      {isAnalyzed ? 'View Report' : isAnalyzing ? 'Opening…' : 'Analyze'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {paywallOpen && (
        <SubscriptionModal
          mode="paywall"
          analysesUsed={profile.analyses_used}
          onClose={() => setPaywallOpen(false)}
        />
      )}
    </div>
  );
}
