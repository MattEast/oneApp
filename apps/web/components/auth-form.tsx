'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { buildApiUrl, unwrapApiData } from '../lib/api';
import { storeToken } from '../lib/auth';

type AuthMode = 'login' | 'register';

type FormState = {
  fullname: string;
  email: string;
  password: string;
  confirm: string;
};

type AuthResponse = {
  token: string;
  expiresIn: number;
  user?: {
    fullname: string;
    email: string;
  };
};

const DEMO_CREDENTIALS = {
  email: 'demo@oneapp.local',
  password: 'DemoPass123!'
};

const INITIAL_FORM: FormState = {
  fullname: '',
  email: '',
  password: '',
  confirm: ''
};

function validateEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';
  const title = isRegister ? 'Create account' : 'Sign in';
  const subtitle = isRegister
    ? 'Start a new authenticated prototype session using the target web stack.'
    : 'Use the current prototype API while the target customer app is rebuilt.';

  const submitLabel = useMemo(() => {
    if (!loading) {
      return isRegister ? 'Create account' : 'Sign in';
    }

    return isRegister ? 'Creating your account...' : 'Signing you in...';
  }, [isRegister, loading]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function getFieldProps(fieldName: keyof FormState) {
    const hasError = Boolean(errors[fieldName]);

    return {
      'aria-invalid': hasError,
      'aria-describedby': hasError ? `${fieldName}-error` : undefined
    };
  }

  function validate() {
    const nextErrors: Record<string, string> = {};

    if (isRegister && form.fullname.trim().length < 2) {
      nextErrors.fullname = 'Full name is required and must be at least 2 characters.';
    }

    if (!validateEmail(form.email)) {
      nextErrors.email = 'A valid email address is required.';
    }

    if (!form.password) {
      nextErrors.password = isRegister
        ? 'Password is required and must be at least 8 characters.'
        : 'Password is required.';
    } else if (isRegister && form.password.length < 8) {
      nextErrors.password = 'Password is required and must be at least 8 characters.';
    }

    if (isRegister) {
      if (!form.confirm) {
        nextErrors.confirm = 'Please confirm your password.';
      } else if (form.password !== form.confirm) {
        nextErrors.confirm = 'Passwords do not match.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(buildApiUrl(isRegister ? '/register' : '/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          isRegister
            ? { fullname: form.fullname.trim(), email: form.email.trim(), password: form.password }
            : { email: form.email.trim(), password: form.password }
        )
      });
      const body = await response.json();

      if (!response.ok) {
        setErrors({ form: body.error || (isRegister ? 'Registration failed.' : 'Login failed.') });
        return;
      }

      const data = unwrapApiData<AuthResponse>(body);
      storeToken(data.token, data.expiresIn ?? 3600);
      router.push('/dashboard');
    } catch (error) {
      setErrors({ form: 'Unable to reach the API. Check that the backend is running.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Target web slice</p>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-copy">{subtitle}</p>

        {!isRegister ? (
          <div className="demo-box" aria-label="Demo sign-in details">
            <strong>Prototype test sign-in</strong>
            <p className="inline-note">Email address: {DEMO_CREDENTIALS.email}</p>
            <p className="inline-note">Password: {DEMO_CREDENTIALS.password}</p>
          </div>
        ) : null}

        <form className="auth-grid" onSubmit={handleSubmit} noValidate aria-busy={loading}>
          {isRegister ? (
            <div className="field">
              <label htmlFor="fullname">Full name</label>
              <input
                id="fullname"
                name="fullname"
                type="text"
                value={form.fullname}
                onChange={(event) => setField('fullname', event.target.value)}
                autoComplete="name"
                {...getFieldProps('fullname')}
              />
              {errors.fullname ? <div className="error-text" id="fullname-error" role="alert">{errors.fullname}</div> : null}
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={(event) => setField('email', event.target.value)}
              autoComplete={isRegister ? 'email' : 'username'}
              {...getFieldProps('email')}
            />
            {errors.email ? <div className="error-text" id="email-error" role="alert">{errors.email}</div> : null}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="field-row">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => setField('password', event.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                {...getFieldProps('password')}
              />
              <button
                className="inline-button"
                type="button"
                onClick={() => setShowPassword((currentValue) => !currentValue)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password ? <div className="error-text" id="password-error" role="alert">{errors.password}</div> : null}
          </div>

          {isRegister ? (
            <div className="field">
              <label htmlFor="confirm">Confirm password</label>
              <div className="field-row">
                <input
                  id="confirm"
                  name="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={(event) => setField('confirm', event.target.value)}
                  autoComplete="new-password"
                  {...getFieldProps('confirm')}
                />
                <button
                  className="inline-button"
                  type="button"
                  onClick={() => setShowConfirm((currentValue) => !currentValue)}
                  aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
                  aria-pressed={showConfirm}
                >
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.confirm ? <div className="error-text" id="confirm-error" role="alert">{errors.confirm}</div> : null}
            </div>
          ) : null}

          {errors.form ? <div className="error-text" role="alert">{errors.form}</div> : null}

          <button className="submit-button" type="submit" disabled={loading}>{submitLabel}</button>
        </form>

        <div className="auth-footer">
          {isRegister ? (
            <Link className="secondary-button" href="/login">Already have an account? Sign in</Link>
          ) : (
            <Link className="secondary-button" href="/register">Need an account? Create one</Link>
          )}
          <Link className="secondary-button" href="/">Back to overview</Link>
        </div>
      </section>
    </main>
  );
}
