'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ShieldCheck, ArrowLeft } from '@phosphor-icons/react';
import { CONSENT_VERSION } from '@shared/consent.mjs';
import { Privacy, Terms } from '../common/legal';
import { api } from '@/services/api';

export function ConsentGate({
  initialAccepted,
  children,
}: {
  initialAccepted: boolean;
  children: ReactNode;
}) {
  const path = usePathname();
  const [accepted, setAccepted] = useState(initialAccepted);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const legal = path === '/privacy' || path === '/terms';
  useEffect(() => {
    if (!accepted && !legal) heading.current?.focus();
    const expired = () => {
      setAccepted(false);
      setTerms(false);
      setPrivacy(false);
    };
    window.addEventListener('techcare-consent-required', expired);
    return () => window.removeEventListener('techcare-consent-required', expired);
  }, [accepted, legal]);
  if (legal)
    return (
      <main className="legal-page">
        <Link className="action-link" href="/">
          <ArrowLeft size={18} aria-hidden="true" /> Back to TechCare
        </Link>
        {path === '/terms' ? <Terms /> : <Privacy />}
      </main>
    );
  if (accepted) return children;
  return (
    <main className="consent-screen">
      <div className="consent-welcome" aria-hidden="true">
        <p>TechCare</p>
        <h1>Technology, together.</h1>
      </div>
      <section className="consent-panel" aria-labelledby="consent-heading">
        <ShieldCheck size={28} aria-hidden="true" />
        <h2 id="consent-heading" ref={heading} tabIndex={-1}>
          Before you join in
        </h2>
        <p>Please read and confirm these agreements to use TechCare.</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!terms || !privacy || busy) return;
            setBusy(true);
            setError('');
            try {
              await api('consent', { terms, privacy, version: CONSENT_VERSION });
              const check = await api<{ accepted: boolean }>('consent');
              if (!check.accepted)
                throw new Error(
                  'Please allow cookies for this site to remember your agreement, then try again.',
                );
              setAccepted(true);
            } catch (failure) {
              setError((failure as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="consent-choice">
            <input
              id="consent-terms"
              type="checkbox"
              required
              checked={terms}
              onChange={(event) => setTerms(event.target.checked)}
            />
            <label htmlFor="consent-terms">
              I have read and agree to TechCare’s <Link href="/terms">Terms of Use</Link>.
            </label>
          </div>
          <div className="consent-choice">
            <input
              id="consent-privacy"
              type="checkbox"
              required
              checked={privacy}
              onChange={(event) => setPrivacy(event.target.checked)}
            />
            <label htmlFor="consent-privacy">
              I have read the <Link href="/privacy">Privacy Notice</Link> and consent to the
              collection and use of my account details and contributions as described there.
            </label>
          </div>
          <p className="form-hint">
            You will be asked to confirm these agreements whenever TechCare is opened or reloaded.
            If you do not agree, you can read the notices or leave the site.
          </p>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={!terms || !privacy || busy}>
            {busy ? 'Saving…' : 'Accept and continue'}
          </button>
        </form>
      </section>
    </main>
  );
}
