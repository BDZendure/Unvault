'use client';

import { useEffect, useRef, useState } from 'react';
import AuthModal, { type AuthMode } from './AuthModal';
import SubscriptionModal from './SubscriptionModal';

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260517_222138_3e3205be-3364-417b-a64a-bfe087acbec4.mp4';
const FADE = 0.9;

function ArrowUpRight() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M7 7h10v10" />
    </svg>
  );
}

export default function LandingPage({ initialAuth }: { initialAuth?: AuthMode | null }) {
  const [vis, setVis] = useState(false);
  const [menu, setMenu] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(initialAuth ?? null);
  const [pricingOpen, setPricingOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVis(true), 80);
    return () => clearTimeout(t);
  }, []);

  const v0 = useRef<HTMLVideoElement>(null);
  const v1 = useRef<HTMLVideoElement>(null);
  const activeVid = useRef(0);
  const inTransit = useRef(false);
  const [ops, setOps] = useState<[number, number]>([1, 0]);

  useEffect(() => {
    const refs = [v0, v1];
    refs.forEach((r) => r.current?.load());
    v0.current?.play().catch(() => {});

    const iv = window.setInterval(() => {
      const a = activeVid.current;
      const cur = refs[a].current;
      const nxt = refs[1 - a].current;
      if (!cur || !nxt || !cur.duration || inTransit.current) return;
      if (cur.currentTime >= cur.duration - FADE) {
        inTransit.current = true;
        nxt.currentTime = 0;
        nxt.play().catch(() => {});
        setOps(a === 0 ? [0, 1] : [1, 0]);
        window.setTimeout(() => {
          activeVid.current = 1 - a;
          inTransit.current = false;
        }, FADE * 1000);
      }
    }, 150);
    return () => window.clearInterval(iv);
  }, []);

  const ease = 'cubic-bezier(0.22,1,0.36,1)';
  const fd = (i: number) => ({
    opacity: vis ? 1 : 0,
    transform: vis ? 'translateY(0)' : 'translateY(-20px)',
    transition: `opacity .5s ${ease} ${i * 0.1}s, transform .5s ${ease} ${i * 0.1}s`,
  });
  const fu = (i: number) => ({
    opacity: vis ? 1 : 0,
    transform: vis ? 'translateY(0)' : 'translateY(32px)',
    transition: `opacity .6s ${ease} ${i * 0.12}s, transform .6s ${ease} ${i * 0.12}s`,
  });
  const hs = (i: number) => ({
    transform: vis ? 'translateY(0)' : 'translateY(110%)',
    transition: `transform .7s ${ease} ${0.4 + i * 0.14}s`,
    display: 'block' as const,
  });

  const openPricing = () => setPricingOpen(true);
  const openAuth = (m: AuthMode) => setAuthMode(m);
  const openSignupFromPricing = () => {
    setPricingOpen(false);
    setAuthMode('signup');
  };

  const navLinks: Array<{ label: string; act: () => void }> = [
    { label: 'Pricing', act: openPricing },
    { label: 'Sign In', act: () => openAuth('signin') },
  ];

  const stats: Array<{ num: string; label: string }> = [
    { num: '5K', label: 'PIECES\nANALYZED' },
    { num: '97%', label: 'AI\nACCURACY' },
    { num: '2K', label: 'HAPPY\nUSERS' },
  ];
  const words = ['Every', 'Piece', 'Revealed'];

  const vidStyle = (op: number): React.CSSProperties => ({
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%', height: '100%', objectFit: 'cover',
    opacity: op,
    transition: `opacity ${FADE}s ease`,
    zIndex: 0,
  });

  return (
    <>
      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F0EDE8' }}>
        <video ref={v0} muted playsInline style={vidStyle(ops[0])}>
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
        <video ref={v1} muted playsInline style={vidStyle(ops[1])}>
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <nav className="lp-nav">
            <div style={fd(0)}>
              <div className="lp-logo"><div className="lp-logo-dot" /></div>
            </div>
            <div className="lp-nav-links">
              {navLinks.map((l, i) => (
                <button key={l.label} className="lp-navbtn" style={fd(i + 1)} onClick={l.act}>{l.label}</button>
              ))}
            </div>
            <div style={fd(3)}>
              <button className="lp-hamburger" onClick={() => setMenu(true)} aria-label="Open menu">
                <span className="lp-ham-line" /><span className="lp-ham-line" /><span className="lp-ham-line" />
              </button>
            </div>
          </nav>

          <div className="lp-stats-row">
            <div className="lp-stats-inner">
              {stats.map((s, i) => (
                <div key={s.num} className="lp-stat" style={fu(i + 2)}>
                  <div className="lp-stat-num">
                    <span style={{ color: '#5E0ED7', fontSize: '.5em' }}>+</span>{s.num}
                  </div>
                  <div className="lp-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-bottom">
            <div className="lp-row-a">
              <p className="lp-tagline" style={fu(5)}>
                Uncover the Story<br />Behind Every Piece<br />You Treasure
              </p>
              <button className="lp-cta" style={fu(6)} onClick={() => openAuth('signup')}>
                Start Analyzing <ArrowUpRight />
              </button>
            </div>
            <div className="lp-row-b">
              <div className="lp-desc-wrap" style={fu(7)}>
                <p className="lp-desc">
                  AI-Powered Jewelry Analysis Built Around Understanding Every Detail of What You Own
                </p>
              </div>
              <div className="lp-heading-wrap">
                {words.map((w, i) => (
                  <div key={w} style={{ overflow: 'hidden' }}>
                    <span className="lp-word" style={hs(i)}>{w}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {menu && (
          <div className="lp-menu">
            <div className="lp-menu-top">
              <div className="lp-logo"><div className="lp-logo-dot" /></div>
              <button className="lp-menu-close" onClick={() => setMenu(false)} aria-label="Close menu">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>
            <nav className="lp-menu-nav">
              {navLinks.map((l) => (
                <button key={l.label} className="lp-menu-link" onClick={() => { setMenu(false); l.act(); }}>{l.label}</button>
              ))}
            </nav>
            <div className="lp-menu-footer">
              <button className="lp-cta" onClick={() => { setMenu(false); openAuth('signup'); }}>
                Start Analyzing <ArrowUpRight />
              </button>
            </div>
          </div>
        )}
      </div>

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSwitchMode={setAuthMode}
        />
      )}

      {pricingOpen && (
        <SubscriptionModal
          mode="pricing"
          analysesUsed={0}
          onClose={() => setPricingOpen(false)}
          onSignUp={openSignupFromPricing}
        />
      )}
    </>
  );
}
