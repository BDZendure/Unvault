'use client';

import { useState } from 'react';

export type SubscriptionMode = 'paywall' | 'pricing';

const BENEFITS = [
  'Unlimited AI analyses — rings, necklaces, bracelets & more',
  'Export detailed PDF reports for any piece',
  'Price history tracking & market trend alerts',
  'Priority analysis queue — results in under 5 seconds',
  'Share your vault with appraisers & insurers',
];

export default function SubscriptionModal({
  analysesUsed,
  mode = 'paywall',
  onClose,
  onSignUp,
}: {
  analysesUsed: number;
  mode?: SubscriptionMode;
  onClose: () => void;
  onSignUp?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isPricing = mode === 'pricing';

  async function handleSubscribe() {
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/paddle/checkout', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Checkout failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  const primaryClick = isPricing
    ? () => onSignUp?.()
    : handleSubscribe;

  return (
    <div className="in-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="in-card" style={{ width: '100%', maxWidth: 460, overflow: 'hidden', position: 'relative', animation: 'menuIn .3s ease' }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg,#5E0ED7,#A855F7)' }} />

        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', cursor: 'pointer', color: '#bbb', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, transition: 'color .15s, background .15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#000'; e.currentTarget.style.background = '#f5f5f5'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#bbb'; e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>

        <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--acc-dim)', border: '1px solid var(--acc-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M2 17h20M4 17l2-9 6 4.5 6-7 4 11.5" stroke="#5E0ED7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 8 }}>
            {isPricing ? 'Unvault Premium' : 'Unlock Unlimited Analyses'}
          </h2>
          <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.65, maxWidth: 320, margin: '0 auto' }}>
            {isPricing
              ? 'Everything you need to understand, track, and protect your jewelry collection.'
              : (analysesUsed >= 3
                  ? "You've used all 3 free analyses."
                  : `You've used ${analysesUsed} of 3 free analyses.`) + ' Subscribe to keep going.'}
          </p>
        </div>

        <div style={{ padding: '28px 32px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2, marginBottom: 24 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', alignSelf: 'flex-start', marginTop: 10 }}>$</span>
            <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-.04em', lineHeight: 1 }}>9</span>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--muted)', alignSelf: 'flex-start', marginTop: 8 }}>.99</span>
            <span style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4, marginLeft: 4 }}>/month</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {BENEFITS.map((b) => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--acc-dim)', border: '1px solid var(--acc-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="var(--acc)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{b}</span>
              </div>
            ))}
          </div>

          {err && (
            <p style={{ fontSize: 13, color: 'var(--err)', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 8, padding: '9px 12px', marginBottom: 12 }}>{err}</p>
          )}

          <button
            onClick={primaryClick}
            disabled={!isPricing && busy}
            style={{
              width: '100%', padding: 14, background: '#5E0ED7', color: '#fff', border: 'none', borderRadius: 10,
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
              cursor: busy ? 'default' : 'pointer', transition: 'background .3s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {busy ? (
              <>
                <svg width="15" height="15" viewBox="0 0 15 15" style={{ animation: 'spin .7s linear infinite' }}>
                  <circle cx="7.5" cy="7.5" r="5.5" stroke="rgba(255,255,255,.3)" strokeWidth="2" fill="none" />
                  <path d="M7.5 2a5.5 5.5 0 0 1 5.5 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
                Redirecting…
              </>
            ) : isPricing ? 'Get Started — $9.99 / mo' : 'Subscribe — $9.99 / mo'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>Cancel anytime · No hidden fees · Billed monthly</p>
        </div>
      </div>
    </div>
  );
}
