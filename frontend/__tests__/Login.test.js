import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '../Login';
import { renderWithRouter } from '../testUtils';

describe('Login form', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function renderLogin() {
    return renderWithRouter(<Login />);
  }

  it('renders login form fields', () => {
    renderLogin();
    expect(screen.getByText(/Prototype test sign-in/i)).toBeInTheDocument();
    expect(screen.getByText(/demo@oneapp.local/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/Email is required/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toHaveAttribute('aria-invalid', 'true');
    expect(await screen.findByText(/Password is required/i)).toBeInTheDocument();
  });

  it('stores the token after a successful login', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          token: 'login-token',
          expiresIn: 3600,
          user: { fullname: 'Integration User', email: 'integration@example.com' }
        }
      })
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'integration@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'integration123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(window.localStorage.getItem('token')).toBe('login-token');
    });
  });

  it('shows invalid credentials from the API', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ success: false, error: 'Invalid credentials.' })
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'integration@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/Invalid credentials/i)).toBeInTheDocument();
  });
});
