import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const COGNITO_REGION = import.meta.env.VITE_AWS_REGION || 'ap-south-1';
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '5068gn9iktlj9670vdntdn125m';
const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

const DEFAULT_DEMO_USERS = [
  {
    id: 'usr-alex-001',
    name: 'Alex Rivera',
    email: 'alex.student@campus.edu',
    password: 'StudentPass123!',
    role: 'student',
    groups: ['Student'],
    department: 'Computer Science & Engineering',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-sarah-003',
    name: 'Sarah Chen',
    email: 'sarah.chen@campus.edu',
    password: 'StudentPass123!',
    role: 'student',
    groups: ['Student'],
    department: 'Biological Sciences',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-admin-999',
    name: 'Officer J. Martinez',
    email: 'security.officer@campus.edu',
    password: 'AdminSecure999!',
    role: 'admin',
    groups: ['Admin', 'Security'],
    department: 'Campus Police & Public Safety',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  }
];

function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('campusfind_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return DEFAULT_DEMO_USERS[0];
  });

  const [idToken, setIdToken] = useState(() => localStorage.getItem('campusfind_id_token') || '');
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('campusfind_access_token') || '');
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('campusfind_refresh_token') || '');
  const [demoUsers, setDemoUsers] = useState(DEFAULT_DEMO_USERS);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('campusfind_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('campusfind_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (idToken) localStorage.setItem('campusfind_id_token', idToken);
    else localStorage.removeItem('campusfind_id_token');

    if (accessToken) localStorage.setItem('campusfind_access_token', accessToken);
    else localStorage.removeItem('campusfind_access_token');

    if (refreshToken) localStorage.setItem('campusfind_refresh_token', refreshToken);
    else localStorage.removeItem('campusfind_refresh_token');
  }, [idToken, accessToken, refreshToken]);

  const switchUser = (user) => {
    setCurrentUser(user);
    // Create simulated token for active profile in demo/test mode
    const simToken = `demo-${user.role}-${user.id}`;
    setIdToken(simToken);
    localStorage.setItem('campusfind_id_token', simToken);
  };

  /**
   * Amazon Cognito Sign In with USER_PASSWORD_AUTH (BUG-06)
   */
  const signInWithCognito = async (email, password) => {
    setAuthError('');
    try {
      const res = await fetch(COGNITO_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
        },
        body: JSON.stringify({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: COGNITO_CLIENT_ID,
          AuthParameters: {
            USERNAME: email.trim(),
            PASSWORD: password
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.__type || 'Cognito authentication failed');
      }

      const result = data.AuthenticationResult;
      const parsedIdToken = result.IdToken;
      const parsedClaims = decodeJwt(parsedIdToken) || {};

      const groups = parsedClaims['cognito:groups'] || [];
      const isAdminRole = groups.includes('Admin') || groups.includes('Security');

      const authenticatedUser = {
        id: parsedClaims.sub || `usr-${Date.now().toString().slice(-4)}`,
        name: parsedClaims.name || email.split('@')[0].replace('.', ' '),
        email: parsedClaims.email || email.trim().toLowerCase(),
        role: isAdminRole ? 'admin' : 'student',
        groups: groups,
        department: parsedClaims.department || (isAdminRole ? 'Campus Police' : 'Student Body'),
        avatar: isAdminRole
          ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      };

      setIdToken(result.IdToken);
      setAccessToken(result.AccessToken);
      if (result.RefreshToken) setRefreshToken(result.RefreshToken);
      setCurrentUser(authenticatedUser);

      return authenticatedUser;
    } catch (err) {
      console.warn('Cognito login failed, checking demo credentials fallback:', err.message);
      // Fallback to local profile if offline or mock testing
      const cleanEmail = email.trim().toLowerCase();
      const existing = demoUsers.find(u => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        switchUser(existing);
        return existing;
      }
      throw err;
    }
  };

  /**
   * Amazon Cognito Sign Up (BUG-06)
   */
  const signUpWithCognito = async ({ email, password, name, department = 'General Studies', role = 'student' }) => {
    setAuthError('');
    try {
      const res = await fetch(COGNITO_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp'
        },
        body: JSON.stringify({
          ClientId: COGNITO_CLIENT_ID,
          Username: email.trim(),
          Password: password,
          UserAttributes: [
            { Name: 'email', Value: email.trim().toLowerCase() },
            { Name: 'name', Value: name || email.split('@')[0] },
            { Name: 'department', Value: department }
          ]
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.__type || 'Cognito registration failed');
      }

      return data;
    } catch (err) {
      console.error('Cognito sign up error:', err);
      throw err;
    }
  };

  const loginWithEmail = (email, role = 'student') => {
    const cleanEmail = email.trim().toLowerCase();
    const existing = demoUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      switchUser(existing);
      return existing;
    }

    const newUser = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      email: cleanEmail,
      role: role,
      groups: role === 'admin' ? ['Admin'] : ['Student'],
      department: 'Campus Community',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
    };

    setDemoUsers(prev => [...prev, newUser]);
    switchUser(newUser);
    return newUser;
  };

  const logout = () => {
    setIdToken('');
    setAccessToken('');
    setRefreshToken('');
    localStorage.removeItem('campusfind_id_token');
    localStorage.removeItem('campusfind_access_token');
    localStorage.removeItem('campusfind_refresh_token');
    localStorage.removeItem('campusfind_user');
    setCurrentUser(null);
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'security' || (currentUser?.groups || []).includes('Admin');

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        idToken,
        demoUsers,
        authError,
        switchUser,
        signInWithCognito,
        signUpWithCognito,
        loginWithEmail,
        logout,
        isAuthModalOpen,
        setIsAuthModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
