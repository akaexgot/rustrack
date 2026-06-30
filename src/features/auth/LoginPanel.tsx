import {
  ArrowLeft,
  Check,
  Fingerprint,
  Globe,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import { localizedPath } from '@/lib/i18n/routing';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type Props = {
  locale: Locale;
  dictionary: Dictionary;
};

type AuthMode = 'signin' | 'signup';

export default function LoginPanel({ locale, dictionary }: Props) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function submitWithPassword() {
    if (!supabase) {
      setStatus(dictionary.dashboard.noSupabaseDescription);
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setStatus(locale === 'es' ? 'Las contrasenas no coinciden.' : 'Passwords do not match.');
        return;
      }

      const { error } = await supabase.auth.signUp({ email, password });
      setStatus(error ? error.message : 'OK');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setStatus(error ? error.message : 'OK');
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setStatus(dictionary.dashboard.noSupabaseDescription);
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${localizedPath(locale, '/dashboard')}`,
      },
    });
  }

  return (
    <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-center gap-8 py-6 lg:grid-cols-[1fr_440px]">
      <div className="space-y-8">
        <a className="auth-logo" href={localizedPath(locale, '/')}>
          <img src="/images/rustrack-logo-cropped.png" alt="Rustrack" />
        </a>

        <div className="max-w-2xl">
          <p className="home-eyebrow">{dictionary.app.registered}</p>
          <h1 className="auth-title">{dictionary.auth.title}</h1>
          <p className="auth-description">{dictionary.auth.description}</p>
        </div>

        <div className="grid max-w-2xl gap-3 md:grid-cols-2">
          <AuthBenefit
            icon={ShieldCheck}
            title={dictionary.auth.secureTitle}
            text={dictionary.dashboard.noSupabaseDescription}
          />
          <AuthBenefit
            icon={Sparkles}
            title={dictionary.auth.guestTitle}
            text={dictionary.home.footer}
          />
        </div>

        <a className="auth-back-link" href={localizedPath(locale, '/')}>
          <ArrowLeft size={17} aria-hidden />
          {dictionary.actions.continueGuest}
        </a>
      </div>

      <div className="auth-panel">
        <div className="auth-mode-switch">
          <button
            className={mode === 'signin' ? 'is-active' : ''}
            type="button"
            onClick={() => setMode('signin')}
          >
            <Fingerprint size={16} aria-hidden />
            {dictionary.auth.signInTab}
          </button>
          <button
            className={mode === 'signup' ? 'is-active' : ''}
            type="button"
            onClick={() => setMode('signup')}
          >
            <UserPlus size={16} aria-hidden />
            {dictionary.auth.signUpTab}
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <AuthField
            icon={Mail}
            label={dictionary.auth.email}
            value={email}
            type="email"
            autoComplete="email"
            onChange={setEmail}
          />
          <AuthField
            icon={KeyRound}
            label={dictionary.auth.password}
            value={password}
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            onChange={setPassword}
          />
          {mode === 'signup' ? (
            <AuthField
              icon={LockKeyhole}
              label={dictionary.auth.confirmPassword}
              value={confirmPassword}
              type="password"
              autoComplete="new-password"
              onChange={setConfirmPassword}
            />
          ) : null}

          <button className="auth-primary-button" type="button" onClick={submitWithPassword}>
            <Check size={18} aria-hidden />
            {mode === 'signin' ? dictionary.auth.submitSignIn : dictionary.auth.submitSignUp}
          </button>

          <button className="auth-secondary-button" type="button" onClick={signInWithGoogle}>
            <Globe size={18} aria-hidden />
            {dictionary.auth.google}
          </button>

          <p className="text-sm leading-6 text-white/48">{dictionary.auth.steamLater}</p>

          {status ? <p className="auth-status">{status}</p> : null}
        </div>
      </div>
    </section>
  );
}

function AuthField({
  icon: Icon,
  label,
  value,
  type,
  autoComplete,
  onChange,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  type: 'email' | 'password';
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-white/72">{label}</span>
      <span className="auth-field">
        <Icon size={18} aria-hidden />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          autoComplete={autoComplete}
        />
      </span>
    </label>
  );
}

function AuthBenefit({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="auth-benefit">
      <span>
        <Icon size={18} aria-hidden />
      </span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
