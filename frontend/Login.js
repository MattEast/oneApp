import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Register.css';
import { buildApiUrl, unwrapApiData } from './api';
import { storeToken } from './auth';
const DEMO_CREDENTIALS = {
  email: 'demo@oneapp.local',
  password: 'DemoPass123!'
};

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const errs = {};
    if (!form.email) errs.email = 'Email is required';
    if (!form.password) errs.password = 'Password is required';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(buildApiUrl('/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      const data = await response.json();
      if (!response.ok) {
        setErrors({ form: data.error || 'Login failed.' });
        return;
      }

      storeToken(unwrapApiData(data).token);
      navigate('/dashboard');
    } catch (error) {
      setErrors({ form: 'Unable to reach the API. Check that the backend is running.' });
    } finally {
      setLoading(false);
    }
  }

  function getFieldProps(fieldName) {
    const hasError = Boolean(errors[fieldName]);

    return {
      'aria-invalid': hasError,
      'aria-describedby': hasError ? `${fieldName}-error` : undefined
    };
  }

  return (
    <main className="register-container" aria-busy={loading}>
      <h2>Sign in</h2>
      <p className="sr-only" role="status" aria-live="polite">
        {loading ? 'Signing you in.' : 'Sign-in form ready.'}
      </p>
      <div className="demo-credentials" aria-label="Demo sign-in details">
        <p className="demo-credentials-title">Prototype test sign-in</p>
        <p>Email address: {DEMO_CREDENTIALS.email}</p>
        <p>Password: {DEMO_CREDENTIALS.password}</p>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          autoComplete="username"
          {...getFieldProps('email')}
        />
        {errors.email && <div className="error" id="email-error" role="alert">{errors.email}</div>}

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          autoComplete="current-password"
          {...getFieldProps('password')}
        />
        {errors.password && <div className="error" id="password-error" role="alert">{errors.password}</div>}

        <button type="submit" disabled={loading}>{loading ? 'Signing you in...' : 'Sign in'}</button>
        {errors.form && <div className="error" role="alert">{errors.form}</div>}
      </form>
      <div className="login-link">
        Need an account? <Link to="/register">Create account</Link>
      </div>
    </main>
  );
}
