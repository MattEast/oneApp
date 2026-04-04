import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Register.css';
import { buildApiUrl } from './api';
import { storeToken } from './auth';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullname: '',
    email: '',
    password: '',
    confirm: ''
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const errs = {};
    if (!form.fullname) errs.fullname = 'Full name is required';
    if (!form.email) errs.email = 'Email is required';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errs.email = 'Invalid email';
    if (!form.password) errs.password = 'Password is required';
    if (!form.confirm) errs.confirm = 'Please confirm your password';
    if (form.password && form.confirm && form.password !== form.confirm) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(buildApiUrl('/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullname: form.fullname,
          email: form.email,
          password: form.password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setErrors({ form: data.error || 'Registration failed.' });
        return;
      }

      storeToken(data.token);
      navigate('/dashboard');
    } catch (error) {
      setErrors({ form: 'Unable to reach the API. Check that the backend is running.' });
    } finally {
      setLoading(false);
    }
  };

  const getFieldProps = (fieldName) => {
    const hasError = Boolean(errors[fieldName]);

    return {
      'aria-invalid': hasError,
      'aria-describedby': hasError ? `${fieldName}-error` : undefined
    };
  };

  return (
    <main className="register-container" aria-busy={loading}>
      <div className="logo" aria-hidden="true"></div>
      <h2>Create account</h2>
      <p className="sr-only" role="status" aria-live="polite">
        {loading ? 'Creating your account.' : 'Registration form ready.'}
      </p>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="fullname">Full name</label>
        <input
          type="text"
          id="fullname"
          name="fullname"
          value={form.fullname}
          onChange={handleChange}
          autoComplete="name"
          required
          {...getFieldProps('fullname')}
        />
        {errors.fullname && <div className="error" id="fullname-error" role="alert">{errors.fullname}</div>}

        <label htmlFor="email">Email address</label>
        <input
          type="email"
          id="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
          required
          {...getFieldProps('email')}
        />
        {errors.email && <div className="error" id="email-error" role="alert">{errors.email}</div>}

        <label htmlFor="password">Password</label>
        <div className="password-field">
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            required
            {...getFieldProps('password')}
          />
          <button
            type="button"
            className="show-hide"
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {errors.password && <div className="error" id="password-error" role="alert">{errors.password}</div>}

        <label htmlFor="confirm">Confirm Password</label>
        <div className="password-field">
          <input
            type={showConfirm ? 'text' : 'password'}
            id="confirm"
            name="confirm"
            value={form.confirm}
            onChange={handleChange}
            autoComplete="new-password"
            required
            {...getFieldProps('confirm')}
          />
          <button
            type="button"
            className="show-hide"
            onClick={() => setShowConfirm(v => !v)}
            aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
            aria-pressed={showConfirm}
          >
            {showConfirm ? 'Hide' : 'Show'}
          </button>
        </div>
        {errors.confirm && <div className="error" id="confirm-error" role="alert">{errors.confirm}</div>}

        <button className="register-btn" type="submit" disabled={loading}>
          {loading ? 'Creating your account...' : 'Create account'}
        </button>
        {errors.form && <div className="error" role="alert">{errors.form}</div>}
      </form>
      <div className="login-link">
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </main>
  );
}
