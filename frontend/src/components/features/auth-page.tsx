'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Field, Form, Success } from '../ui/ui';
import { api } from '@/services/api';
import { useTechCare } from '@/context/techcare-context';
import { authPaths, type AuthMode } from '@/utils/auth-pages';
import type { Result, FormValues } from '@shared/types';

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { setUser, notify, classroom, authDraft, updateAuthDraft } = useTechCare(),
    router = useRouter();
  const { email, code, token, message } = authDraft;
  const setEmail = (email: string) => updateAuthDraft({ email });
  const setCode = (code: string) => updateAuthDraft({ code });
  const setToken = (token: string) => updateAuthDraft({ token });
  const setMessage = (message: string) => updateAuthDraft({ message });
  const titles = {
    login: 'Welcome back',
    register: 'Join the TechCare community',
    verify: 'Verify Your Email',
    forgot: 'Forgot your password?',
    reset: 'Choose a new password',
  };
  function setMode(next: AuthMode) {
    router.push(authPaths[next]);
  }
  async function submit(values: FormValues) {
    if (values.email) setEmail(values.email);
    const route = {
      login: 'login',
      register: 'register',
      verify: 'verify',
      forgot: 'forgot-password',
      reset: 'reset-password',
    }[mode];
    const r = await api<Result>(route, values);
    if (mode === 'login') {
      setUser(r.user!);
      router.replace('/profile');
      notify('Welcome back. Your dashboard is ready.');
    }
    if (mode === 'register') {
      setCode(r.development_code || '');
      setMode('verify');
      setMessage(r.message!);
    }
    if (mode === 'verify') {
      setMode('login');
      setCode('');
      setMessage(r.message!);
    }
    if (mode === 'forgot') {
      setMessage(r.message!);
      if (r.development_token) setToken(r.development_token);
    }
    if (mode === 'reset') {
      setUser(null);
      setMode('login');
      setToken('');
      setMessage(r.message!);
    }
  }
  return (
    <section className="inner-page auth-page" aria-labelledby="auth-title">
      <header className="page-heading">
        <div>
          <h1 id="auth-title">{titles[mode]}</h1>
          <p>
            {mode === 'register'
              ? 'A place to ask, learn, and lend a helping hand.'
              : mode === 'verify'
                ? 'Enter the six-digit code sent to your email.'
                : mode === 'login'
                  ? 'Sign in to pick up where you left off.'
                  : 'Securely recover access to your account.'}
          </p>
        </div>
      </header>
      {message && <Success>{message}</Success>}
      {classroom &&
        ((mode === 'verify' && code) || (['forgot', 'reset'].includes(mode) && token)) && (
          <div className="demo-note">
            {mode === 'verify' && code && <strong>Demo code: {code}</strong>}
            {['forgot', 'reset'].includes(mode) && token && (
              <>
                <br />
                Recovery token: <code className="break-token">{token}</code>
              </>
            )}
          </div>
        )}
      <Form
        key={mode}
        submit={
          {
            login: 'Sign In',
            register: 'Create Account',
            verify: 'Verify email',
            forgot: 'Send recovery instructions',
            reset: 'Reset password',
          }[mode]
        }
        onSubmit={submit}
      >
        {mode === 'register' && (
          <Field label="Display name" name="name" min={2} max={80} autoComplete="name" />
        )}
        {mode !== 'reset' && (
          <Field
            label="Email address"
            name="email"
            type="email"
            max={160}
            value={email}
            autoComplete="email"
          />
        )}
        {['login', 'register', 'reset'].includes(mode) && (
          <Field
            label={mode === 'login' ? 'Password' : 'Password (12 to 128 characters)'}
            name="password"
            type="password"
            min={12}
            max={128}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        )}
        {mode === 'verify' && (
          <Field
            label="Six-digit code"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            min={6}
            max={6}
            autoComplete="one-time-code"
          />
        )}
        {mode === 'reset' && (
          <Field
            label="Recovery token from your email"
            name="token"
            min={20}
            max={100}
            value={token}
          />
        )}
        {mode === 'register' && (
          <p className="form-hint">
            Your display name appears on approved public contributions. Please read our{' '}
            <Link href="/privacy">privacy and community guidelines</Link>.
          </p>
        )}
      </Form>
      <div className="auth-links">
        {mode === 'login' ? (
          <>
            <Link className="text-button" href={authPaths.forgot} onClick={() => setMessage('')}>
              Forgot password?
            </Link>
            <Link className="text-button" href={authPaths.verify} onClick={() => setMessage('')}>
              Verify a pending account
            </Link>
            <p>
              New here?{' '}
              <Link
                className="text-button"
                href={authPaths.register}
                onClick={() => setMessage('')}
              >
                Create Account
              </Link>
            </p>
          </>
        ) : (
          <>
            <Link className="text-button" href={authPaths.login} onClick={() => setMessage('')}>
              Back to Sign In
            </Link>
            {mode === 'forgot' && (
              <Link className="text-button" href={authPaths.reset} onClick={() => setMessage('')}>
                Reset password with a token
              </Link>
            )}
            {mode === 'verify' && (
              <Form
                submit="Send a new code"
                onSubmit={async (values) => {
                  setEmail(values.email);
                  const r = await api<Result>('resend-verification', values);
                  setCode(r.development_code || '');
                  setMessage(r.message!);
                }}
              >
                <Field
                  label="Email for a new code"
                  name="email"
                  type="email"
                  value={email}
                  max={160}
                />
              </Form>
            )}
          </>
        )}
      </div>
    </section>
  );
}
