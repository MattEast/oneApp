import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import Account from '../Account';
import { renderWithRouter } from '../testUtils';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('Account Management UI', () => {
  beforeEach(() => {
    window.localStorage.setItem('token', 'mocktoken');
    mockNavigate.mockReset();
    global.fetch = jest.fn((url, opts) => {
      if (url.endsWith('/api/logout') && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve('') });
      }

      if (url.endsWith('/api/account') && (!opts || !opts.method || opts.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ fullname: 'Test User', email: 'test@example.com' })
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'Unknown endpoint' }) });
    });
  });
  afterEach(() => {
    global.fetch.mockRestore && global.fetch.mockRestore();
    window.localStorage.clear();
  });

  it('renders the account summary and deprecation notice', async () => {
    renderWithRouter(<Account />);
    expect(await screen.findByText(/Profile editing and password changes are deprecated/i)).toBeInTheDocument();
    expect(await screen.findByText('Test User')).toBeInTheDocument();
    expect(await screen.findByText('test@example.com')).toBeInTheDocument();
  });

  it('shows an error when the profile request fails', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to load profile' })
      })
    );

    renderWithRouter(<Account />);
    expect(await screen.findByText(/Failed to load profile/i)).toBeInTheDocument();
  });

  it('signs the user out from the account page', async () => {
    renderWithRouter(<Account />);

    fireEvent.click(await screen.findByRole('button', { name: /sign out/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/logout',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});
