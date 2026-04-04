import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Register from '../Register';
import { renderWithRouter } from '../testUtils';

describe('Register Component', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function renderRegister() {
    return renderWithRouter(<Register />);
  }

  test('renders registration form fields', () => {
    renderRegister();
    expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create account/i })).toBeInTheDocument();
  });

  test('shows error when submitting empty form', () => {
    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /Create account/i }));
    expect(screen.getByText(/Full name is required/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Please confirm your password/i)).toBeInTheDocument();
  });

  test('shows error if passwords do not match', () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'abc123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: /Create account/i }));
    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
  });

  test('stores the token after successful registration', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        token: 'token-123',
        expiresIn: 3600,
        user: { fullname: 'Test User', email: 'test@example.com' }
      })
    });

    renderRegister();
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create account/i }));

    await waitFor(() => {
      expect(window.localStorage.getItem('token')).toBe('token-123');
    });
  });

  test('shows backend errors for duplicate emails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'An account with this email already exists.' })
    });

    renderRegister();
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create account/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });
});
