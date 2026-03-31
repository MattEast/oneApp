import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Register from '../Register';

describe('Register Component', () => {
  test('renders registration form fields', () => {
    render(<Register />);
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register/i })).toBeInTheDocument();
  });

  test('shows error when submitting empty form', () => {
    render(<Register />);
    fireEvent.click(screen.getByRole('button', { name: /Register/i }));
    expect(screen.getByText(/Full name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Please confirm your password/i)).toBeInTheDocument();
  });

  test('shows error if passwords do not match', () => {
    render(<Register />);
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'abc123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: /Register/i }));
    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
  });
});
