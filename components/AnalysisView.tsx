'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Analysis, Piece } from '@/lib/types';

const STEPS = [
  'Analyzing image quality…',
  'Identifying metal composition…',
  'Examining gemstone characteristics…',
  'Estimating market value…',
  'Compiling analysis report…',
];

function Nav({ onBack }: { onBack: () => void }) {
  return (
    <nav style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 48px', height: 60, display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 200 }}>
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', padding: 0, transition: 'color .15s' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#000')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8 2L3 6.5l5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        My Pieces
      </button>
      <span style={{ color: 'var(--border)', fontSize: 16 }}>|</span>
      <div className="lp-logo"><div className="lp-logo-dot" /></div>
      <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '.1em', textTransform: 'uppercase' }}>Unvault</span>
    </nav>
  );
}

function Row({ label, value, sub, accent, children }: {
  label: string;
  value?: string;
  sub?: string;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '18px 0', display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, alignItems: 'start' }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', paddingTop: 3 }}>{label}</p>
      <div>
        {value && (
          <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: accent ? '#5E0ED7' : '#000', lineHeight: 1.3 }}>
            {value}
          </p>
        )}
        {sub && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{sub}</p>}
        {children}
      </div>
    </div>
  );
}

export default function AnalysisView({
  piece,
  needsAnalysis,
}: {
  piece: Piece;
  needsAnalysis: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(needsAnalysis);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Analysis | null>(piece.analysis);
  const [err, setErr] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!needsAnalysis || started.current) return;
    started.current = true;

    let cancelled = false;
    const iv = window.setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 900);

    (async () => {
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pieceId: piece.id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (res.status === 402) {
            router.push('/dashboard?paywall=1');
            return;
          }
          throw new Error(body.error || `Analysis failed (${res.status})`);
        }
        const body = (await res.json()) as { analysis: Analysis };
        if (cancelled) return;
        setResult(body.analysis);
        setStep(STEPS.length - 1);
        setLoading(false);
        router.refresh();
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : 'Analysis failed.');
        setLoading(false);
      } finally {
        window.clearInterval(iv);
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [needsAnalysis, piece.id, router]);

  const onBack = () => router.push('/dashboard');

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <Nav onBack={onBack} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 48, padding: 48 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>AI Analysis in Progress</p>
            <h2 style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1 }}>{piece.name}</h2>
          </div>

          <svg width="48" height="48" viewBox="0 0 48 48" style={{ animation: 'spin 1.2s linear infinite' }}>
            <circle cx="24" cy="24" r="20" stroke="#f0f0f0" strokeWidth="2" fill="none" />
            <path d="M24 4 A20 20 0 0 1 44 24" stroke="#5E0ED7" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 320, borderTop: '1px solid var(--border)' }}>
            {STEPS.map((s, i) => {
              const past = i < step;
              const cur = i === step;
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)', opacity: past ? 0.35 : cur ? 1 : 0.2, transition: 'opacity .3s' }}>
                  <span style={{ fontSize: 13, fontWeight: cur ? 600 : 400, letterSpacing: '.01em', color: '#000' }}>{s}</span>
                  {past && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7l3.5 3.5 5.5-6" stroke="var(--ok)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {cur && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5E0ED7', display: 'block', animation: 'blink 1s ease infinite' }} />}
                </div>
              );
            })}
          </div>

          {err && (
            <p style={{ fontSize: 13, color: 'var(--err)', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 8, padding: '9px 12px', maxWidth: 360, textAlign: 'center' }}>{err}</p>
          )}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <Nav onBack={onBack} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Analysis unavailable</h2>
          <p style={{ fontSize: 14, color: 'var(--text2)', maxWidth: 420, textAlign: 'center' }}>{err || 'No analysis exists for this piece yet.'}</p>
          <button className="in-btn in-btn-primary" onClick={onBack}>Back to Pieces</button>
        </div>
      </div>
    );
  }

  const r = result;
  const valStr = `$${r.estimatedValue.low.toLocaleString()} – $${r.estimatedValue.high.toLocaleString()}`;
  const thumb = piece.image_url;

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <Nav onBack={onBack} />
      <main style={{ flex: 1, padding: 48, maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 28, marginBottom: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
              AI Analysis Report · {piece.date || new Date(piece.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <h1 style={{ fontSize: 'clamp(2rem,5vw,4rem)', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1 }}>{piece.name}</h1>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>AI Confidence</p>
            <p style={{ fontSize: 'clamp(2.5rem,4vw,3.5rem)', fontWeight: 700, letterSpacing: '-.04em', lineHeight: 1, color: r.confidence >= 88 ? 'var(--ok)' : 'var(--warn)' }}>
              {r.confidence}
              <span style={{ fontSize: '.4em' }}>%</span>
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 56, alignItems: 'start' }}>
          <div
            style={{
              borderRadius: 4, overflow: 'hidden', aspectRatio: '3/4',
              background: thumb ? '#f0f0f0' : 'radial-gradient(ellipse at 42% 38%,#D4A84C 0%,#6B4208 45%,#1A0E00 100%)',
              backgroundImage: thumb ? `url(${thumb})` : undefined,
              backgroundSize: 'cover', backgroundPosition: 'center',
            }}
          />
          <div>
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <Row label="Metal Type" value={r.metalType} sub={r.metalPurity} />
              <Row label="Gemstone" value={r.gemstone} sub={r.gemstoneDetails} />
              <Row label="Est. Value" value={valStr} accent />
              <Row label="Style & Era" value={r.style} sub={r.era} />

              <Row label="Condition">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#000' }}>{r.condition}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>{r.conditionScore}/100</p>
                </div>
                <div style={{ height: 2, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    style={{
                      ['--w' as keyof React.CSSProperties as string]: `${r.conditionScore}%`,
                      height: '100%', background: '#000', animation: 'barFill .9s ease .2s both', width: 'var(--w)',
                    } as React.CSSProperties}
                  />
                </div>
              </Row>

              <Row label="Authenticity">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {r.signals.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                        <path d="M2.5 7l3.5 3.5 5.5-6" stroke="var(--ok)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </Row>

              <div style={{ padding: '18px 0', display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, alignItems: 'start' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', paddingTop: 3 }}>Care Tips</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {r.care.map((tip, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1, marginTop: 1, flexShrink: 0 }}>—</span>
                      <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
