'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, sans-serif', padding: '48px 24px', textAlign: 'center', color: '#000' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Something went wrong</h2>
        <p style={{ color: '#555', fontSize: 14, marginBottom: 24 }}>
          We've logged the error. Try again or head back to the homepage.
        </p>
        <button
          onClick={reset}
          style={{
            background: '#5E0ED7', color: '#fff', border: 'none', padding: '11px 22px',
            borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            letterSpacing: '.06em', textTransform: 'uppercase',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
