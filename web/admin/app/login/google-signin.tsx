'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GOOGLE_CLIENT_ID } from '@/lib/api';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

const SCRIPT_ID = 'google-gsi-client';

export function GoogleSignIn() {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      setPending(true);
      setError(null);

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken: response.credential }),
        });
        const payload = await res.json().catch(() => null);

        if (!res.ok) {
          setError(payload?.message ?? 'Sign-in failed. Please try again.');
          return;
        }

        router.replace('/dashboard');
        router.refresh();
      } catch {
        setError('Cannot reach the admin API. Please try again.');
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const render = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
        ux_mode: 'popup',
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        logo_alignment: 'left',
        width: 320,
      });
    };

    if (document.getElementById(SCRIPT_ID)) {
      render();
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => setError('Could not load Google Sign-In. Check your connection.');
    document.head.appendChild(script);
  }, [handleCredential]);

  return (
    <div className="mt-6">
      <div ref={buttonRef} className="flex min-h-[44px] items-center justify-center" />
      {pending && <p className="mt-3 text-center text-xs text-slate-500">Verifying your admin access…</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
