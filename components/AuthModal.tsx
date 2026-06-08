'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export type AuthMode = 'signin' | 'signup';

export default function AuthModal({
  mode,
  onClose,
  onSwitchMode,
}: {
  mode: AuthMode;
  onClose: () => void;
  onSwitchMode: (m: AuthMode) => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const isUp = mode === 'signup';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (isUp && !name.trim()) { setErr('Please enter your name.'); return; }
    if (!email.includes('@'))  { setErr('Enter a valid email address.'); return; }
    if (pass.length < 6)       { setErr('Password must be at least 6 characters.'); return; }
    setBusy(true);

    try {
      if (isUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push('/dashboard');
          router.refresh();
        } else {
          setConfirmSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="in-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="in-card" style={{ width: '100%', maxWidth: 420, padding: 36, position: 'relative', animation: 'menuIn .3s ease' }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: '#bbb', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, transition: 'color .15s, background .15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#000'; e.currentTarget.style.background = '#f5f5f5'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#bbb'; e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div className="lp-logo"><div className="lp-logo-dot" /></div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '.1em', textTransform: 'uppercase' }}>Unvault</span>
        </div>

        {confirmSent ? (
          <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Check your email</h3>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              We sent a confirmation link to <strong style={{ color: '#000' }}>{email}</strong>. Open it to finish creating your account.
            </p>
            <button onClick={onClose} className="in-btn in-btn-ghost" style={{ marginTop: 24, justifyContent: 'center', width: '100%' }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', background: '#f5f5f7', borderRadius: 10, padding: 4, marginBottom: 28 }}>
              {(['signup', 'signin'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onSwitchMode(m)}
                  style={{
                    flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer', borderRadius: 7, fontFamily: 'inherit',
                    fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', transition: 'all .2s',
                    background: mode === m ? '#fff' : 'transparent',
                    color: mode === m ? '#000' : '#999',
                    boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.12)' : 'none',
                  }}
                >
                  {m === 'signup' ? 'Sign Up' : 'Sign In'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isUp && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="in-label">Full Name</label>
                  <input className="in-input" type="text" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="in-label">Email</label>
                <input className="in-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="in-label">Password</label>
                <input className="in-input" type="password" placeholder="••••••••" value={pass} onChange={(e) => setPass(e.target.value)} />
              </div>

              {err && <p style={{ fontSize: 13, color: 'var(--err)', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 8, padding: '9px 12px' }}>{err}</p>}

              <button type="submit" className="in-btn in-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 13, marginTop: 4, fontSize: 14 }} disabled={busy}>
                {busy ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: 'spin .8s linear infinite' }}>
                      <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,.3)" strokeWidth="2" fill="none" />
                      <path d="M7 2a5 5 0 0 1 5 5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
                    </svg>
                    {isUp ? 'Creating account…' : 'Signing in…'}
                  </span>
                ) : (isUp ? 'Create Free Account' : 'Sign In')}
              </button>
            </form>

            {isUp && (
              <p style={{ textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 16, lineHeight: 1.7 }}>
                By signing up you agree to our <span style={{ color: '#555', cursor: 'pointer' }}>Terms</span> &amp; <span style={{ color: '#555', cursor: 'pointer' }}>Privacy Policy</span>.
              </p>
            )}

            <p style={{ textAlign: 'center', fontSize: 13, color: '#888', marginTop: 14 }}>
              {isUp ? 'Already have an account? ' : 'No account yet? '}
              <button onClick={() => onSwitchMode(isUp ? 'signin' : 'signup')} style={{ background: 'none', border: 'none', color: 'var(--acc)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                {isUp ? 'Sign In' : 'Sign Up Free'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
