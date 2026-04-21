'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { completeBankCallback } from '../../../lib/api';
import { getStoredToken } from '../../../lib/auth';

function toSafeProviderErrorLabel(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'access_denied') {
    return 'access_denied';
  }

  if (normalized === 'temporarily_unavailable') {
    return 'temporarily_unavailable';
  }

  return 'unknown_error';
}

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getStoredToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const providerError = searchParams.get('error');

    if (providerError) {
      const safeReason = toSafeProviderErrorLabel(providerError);
      setError(`Bank authorisation was declined: ${safeReason}`);
      return;
    }

    if (!code || !state) {
      setError('Missing authorisation parameters. Please try connecting again.');
      return;
    }

    async function exchangeCode() {
      const result = await completeBankCallback(token, code!, state!);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.replace('/banking');
    }

    exchangeCode();
  }, [router, searchParams]);

  if (error) {
    return (
      <main className="banking-shell">
        <section className="banking-card">
          <p className="eyebrow">Banking</p>
          <h1 className="banking-title">Connection failed</h1>
          <p className="error-text" role="alert">{error}</p>
          <div className="banking-footer">
            <a className="secondary-button" href="/banking">Back to banking</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="banking-shell">
      <section className="banking-card">
        <p className="eyebrow">Banking</p>
        <h1 className="banking-title">Completing bank connection...</h1>
        <p className="inline-note">Exchanging authorisation with your bank. This should only take a moment.</p>
      </section>
    </main>
  );
}

export default function BankingCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="banking-shell">
          <section className="banking-card">
            <p className="eyebrow">Banking</p>
            <h1 className="banking-title">Loading...</h1>
          </section>
        </main>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
