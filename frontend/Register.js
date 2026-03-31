import React, { useState } from 'react';
import './Register.css';

export default function Register() {
  const [form, setForm] = useState({
    fullname: '',
    email: '',
    password: '',
    confirm: ''
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // TODO: Implement backend call
      alert('Registration successful!');
    }
  };

  return (
    <div className="register-container">
      <div className="logo"></div>
      <h2>Register</h2>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="fullname">Full Name</label>
        <input
          type="text"
          id="fullname"
          name="fullname"
          value={form.fullname}
          onChange={handleChange}
          required
        />
        {errors.fullname && <div className="error">{errors.fullname}</div>}

        <label htmlFor="email">Email Address</label>
        <input
          type="email"
          id="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          required
        />
        {errors.email && <div className="error">{errors.email}</div>}

        <label htmlFor="password">Password</label>
        <div className="password-field">
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
          />
          <button type="button" className="show-hide" onClick={() => setShowPassword(v => !v)}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {errors.password && <div className="error">{errors.password}</div>}

        <label htmlFor="confirm">Confirm Password</label>
        <div className="password-field">
          <input
            type={showConfirm ? 'text' : 'password'}
            id="confirm"
            name="confirm"
            value={form.confirm}
            onChange={handleChange}
            required
          />
          <button type="button" className="show-hide" onClick={() => setShowConfirm(v => !v)}>
            {showConfirm ? 'Hide' : 'Show'}
          </button>
        </div>
        {errors.confirm && <div className="error">{errors.confirm}</div>}

        <button className="register-btn" type="submit">Register</button>
      </form>
      <div className="login-link">
        Already have an account? <a href="#">Login</a>
      </div>
    </div>
  );
}
