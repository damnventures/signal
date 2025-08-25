'use client';

import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const AuthButton: React.FC = () => {
  const { user, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return (
      <button className="auth-button loading" disabled>
        <span>Loading...</span>
      </button>
    );
  }

  if (user) {
    return (
      <div className="auth-container">
        <div className="user-info">
          <span className="user-email">{user.email}</span>
        </div>
        <button className="auth-button logout" onClick={logout}>
          <span>Logout</span>
        </button>
      </div>
    );
  }

  return (
    <button className="auth-button login" onClick={login}>
      <span>🔐 Login with Google</span>
    </button>
  );
};

export default AuthButton;