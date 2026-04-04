import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Register.css';
import { buildApiUrl, buildAuthHeaders } from './api';
import { isInvalidSessionResponse } from './auth';
import { endClientSession, logoutCurrentSession } from './session';

const deprecationMessage =
  'Profile editing and password changes are deprecated until the account management design is realigned with the documented product scope.';

export default function Account() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ fullname: '', email: '' });
  const [profileErr, setProfileErr] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  async function handleSignOut() {
    await logoutCurrentSession();
    endClientSession(navigate);
  }

  // Fetch profile on mount
  useEffect(() => {
    async function fetchProfile() {
      setLoadingProfile(true);
      setProfileErr('');
      try {
        const res = await fetch(buildApiUrl('/account'), {
          headers: buildAuthHeaders()
        });
        const data = await res.json();
        if (res.ok) {
          setProfile({ fullname: data.fullname, email: data.email });
        } else if (isInvalidSessionResponse(res, data)) {
          endClientSession(navigate);
        } else {
          setProfileErr(data.error || 'Failed to load profile');
        }
      } catch (err) {
        setProfileErr('Network error');
      }
      setLoadingProfile(false);
    }
    fetchProfile();
  }, [navigate]);

  return (
    <main className="dashboard-shell">
      <div className="dashboard-panel account-panel">
        <div className="dashboard-header-row account-header-row">
          <div>
            <p className="dashboard-kicker">Your account</p>
            <h1 className="dashboard-title">Your details</h1>
          </div>
          <div className="dashboard-actions">
            <Link className="dashboard-link" to="/dashboard">Back to overview</Link>
            <button className="dashboard-secondary-action" type="button" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
        <div className="account-section">
          <div className="error-msg" role="note">{deprecationMessage}</div>
          {loadingProfile ? <div role="status" aria-live="polite">Loading your details...</div> : (
            profileErr ? <div className="error-msg" role="alert">{profileErr}</div> : (
              <dl className="account-summary">
                <div>
                  <dt>Full name</dt>
                  <dd>{profile.fullname}</dd>
                </div>
                <div>
                  <dt>Email address</dt>
                  <dd>{profile.email}</dd>
                </div>
              </dl>
            )
          )}
        </div>
      </div>
    </main>
  );
}
