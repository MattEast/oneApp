import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import Account from './Account';
import { hasStoredToken } from './auth';

function ProtectedRoute({ children }) {
  if (!hasStoredToken()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }) {
  if (hasStoredToken()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={(
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        )} />
        <Route path="/register" element={(
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        )} />
        <Route path="/dashboard" element={(
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        )} />
        <Route path="/account" element={(
          <ProtectedRoute>
            <Account />
          </ProtectedRoute>
        )} />
        <Route
          path="*"
          element={<Navigate to={hasStoredToken() ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </Router>
  );
}
