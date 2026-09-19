import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const COGNITO_REGION = import.meta.env.VITE_AWS_REGION || 'ap-south-1';
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '5068gn9iktlj9670vdntdn125m';
const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

export const VIT_CHENNAI_SCHOOLS = [
  'School of Computer Science and Engineering (SCOPE)',
  'School of Electronics Engineering (SENSE)',
  'School of Electrical Engineering (SELECT)',
  'School of Mechanical Engineering (SMEC)',
  'School of Civil Engineering (SCE)',
  'School of Bio Sciences and Technology (SBST)',
  'VIT Business School (VITBS)',
  'VIT School of Law (VITSOL)',
  'School of Social Sciences and Languages (SSL)',
  'VIT School of Media Arts and Technology (VSMART)',
  'VIT Fashion Institute of Technology (VFIT)'
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

async function callCognito(target, payload) {
  const res = await fetch(COGNITO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data.message || data.__type || 'Cognito operation failed';
    const err = new Error(errorMsg);
    err.code = (data.__type || '').split('#').pop();
    throw err;
  }
  return data;
}

// Clean up any legacy or demo localStorage keys on module execution
try {
  localStorage.removeItem('campusfind_user');
  localStorage.removeItem('findit_user');
} catch (e) {
  /* ignore */
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const sessionSaved = sessionStorage.getItem('findit_session_user');
    if (sessionSaved) {
      try { return JSON.parse(sessionSaved); } catch (e) { /* ignore */ }
    }
    return null;
  });

  const [idToken, setIdToken] = useState(() => sessionStorage.getItem('findit_session_id_token') || '');
  const [accessToken, setAccessToken] = useState(() => sessionStorage.getItem('findit_session_access_token') || '');
  const [refreshToken, setRefreshToken] = useState(() => sessionStorage.getItem('findit_session_refresh_token') || '');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('findit_session_user', JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem('findit_session_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (idToken) {
      sessionStorage.setItem('findit_session_id_token', idToken);
      localStorage.setItem('campusfind_id_token', idToken);
    } else {
      sessionStorage.removeItem('findit_session_id_token');
      localStorage.removeItem('campusfind_id_token');
    }

    if (accessToken) {
      sessionStorage.setItem('findit_session_access_token', accessToken);
      localStorage.setItem('campusfind_access_token', accessToken);
    } else {
      sessionStorage.removeItem('findit_session_access_token');
      localStorage.removeItem('campusfind_access_token');
    }

    if (refreshToken) {
      sessionStorage.setItem('findit_session_refresh_token', refreshToken);
      localStorage.setItem('campusfind_refresh_token', refreshToken);
    } else {
      sessionStorage.removeItem('findit_session_refresh_token');
      localStorage.removeItem('campusfind_refresh_token');
    }
  }, [idToken, accessToken, refreshToken]);

  // Check token expiration periodically or on mount
  useEffect(() => {
    if (idToken && idToken.startsWith('eyJ')) {
      const claims = decodeJwt(idToken);
      if (claims && claims.exp) {
        const now = Math.floor(Date.now() / 1000);
        if (claims.exp < now) {
          refreshSession().catch(() => logout());
        }
      }
    }
  }, [idToken]);

  /**
   * Amazon Cognito Sign In with USER_PASSWORD_AUTH
   */
  const signInWithCognito = async (email, password) => {
    setAuthError('');
    const cleanEmail = email.trim().toLowerCase();

    try {
      const data = await callCognito('InitiateAuth', {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: cleanEmail,
          PASSWORD: password
        }
      });

      const result = data.AuthenticationResult;
      const parsedIdToken = result.IdToken;
      const parsedClaims = decodeJwt(parsedIdToken) || {};

      const groups = parsedClaims['cognito:groups'] || [];
      const isAdminRole = groups.includes('Admin') || groups.includes('Security');

      const authenticatedUser = {
        id: parsedClaims.sub || `usr-${Date.now().toString().slice(-4)}`,
        name: parsedClaims.name || cleanEmail.split('@')[0].replace('.', ' '),
        email: parsedClaims.email || cleanEmail,
        role: isAdminRole ? 'admin' : 'student',
        groups: groups,
        department: parsedClaims['custom:department'] || (isAdminRole ? 'Campus Safety & Administration' : 'School of Computer Science and Engineering (SCOPE)')
      };

      setIdToken(result.IdToken);
      setAccessToken(result.AccessToken);
      if (result.RefreshToken) setRefreshToken(result.RefreshToken);
      setCurrentUser(authenticatedUser);

      return authenticatedUser;
    } catch (err) {
      console.warn('Cognito authentication note:', err.message);

      // If user not confirmed yet, let caller handle confirmation code entry
      if (err.code === 'UserNotConfirmedException' || err.message.includes('User is not confirmed')) {
        const confirmErr = new Error('Your email is not verified yet. Please enter the 6-digit confirmation code sent to your email.');
        confirmErr.code = 'UserNotConfirmedException';
        confirmErr.email = cleanEmail;
        throw confirmErr;
      }

      throw err;
    }
  };

  /**
   * Amazon Cognito Student-Only Sign Up
   * Strictly enforces @vitstudent.ac.in and captures VIT Chennai School
   */
  const signUpWithCognito = async ({ email, password, name, department }) => {
    setAuthError('');
    const cleanEmail = email.trim().toLowerCase();

    // Client-side domain enforcement
    if (!cleanEmail.endsWith('@vitstudent.ac.in')) {
      throw new Error('Registration is strictly restricted to VIT students with a valid @vitstudent.ac.in email address.');
    }

    const selectedDept = department || VIT_CHENNAI_SCHOOLS[0];

    const data = await callCognito('SignUp', {
      ClientId: COGNITO_CLIENT_ID,
      Username: cleanEmail,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: cleanEmail },
        { Name: 'name', Value: (name || '').trim() || cleanEmail.split('@')[0] },
        { Name: 'custom:department', Value: selectedDept }
      ]
    });

    return {
      userConfirmed: data.UserConfirmed,
      userSub: data.UserSub,
      codeDeliveryDetails: data.CodeDeliveryDetails
    };
  };

  /**
   * Amazon Cognito Confirm Sign Up (Email Verification Code)
   */
  const confirmSignUp = async (email, confirmationCode) => {
    setAuthError('');
    const cleanEmail = email.trim().toLowerCase();

    return await callCognito('ConfirmSignUp', {
      ClientId: COGNITO_CLIENT_ID,
      Username: cleanEmail,
      ConfirmationCode: confirmationCode.trim()
    });
  };

  /**
   * Resend Verification Code
   */
  const resendConfirmationCode = async (email) => {
    setAuthError('');
    const cleanEmail = email.trim().toLowerCase();

    return await callCognito('ResendConfirmationCode', {
      ClientId: COGNITO_CLIENT_ID,
      Username: cleanEmail
    });
  };

  /**
   * Forgot Password - Trigger Reset Code
   */
  const forgotPassword = async (email) => {
    setAuthError('');
    const cleanEmail = email.trim().toLowerCase();

    return await callCognito('ForgotPassword', {
      ClientId: COGNITO_CLIENT_ID,
      Username: cleanEmail
    });
  };

  /**
   * Confirm Forgot Password with Code & New Password
   */
  const confirmForgotPassword = async (email, confirmationCode, newPassword) => {
    setAuthError('');
    const cleanEmail = email.trim().toLowerCase();

    return await callCognito('ConfirmForgotPassword', {
      ClientId: COGNITO_CLIENT_ID,
      Username: cleanEmail,
      ConfirmationCode: confirmationCode.trim(),
      Password: newPassword
    });
  };

  /**
   * Refresh Session with REFRESH_TOKEN_AUTH
   */
  const refreshSession = async () => {
    if (!refreshToken) return null;

    try {
      const data = await callCognito('InitiateAuth', {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken
        }
      });

      if (data.AuthenticationResult) {
        setIdToken(data.AuthenticationResult.IdToken);
        setAccessToken(data.AuthenticationResult.AccessToken);
        return data.AuthenticationResult;
      }
    } catch (err) {
      console.warn('Silent token refresh note:', err);
    }
    return null;
  };

  const logout = () => {
    setIdToken('');
    setAccessToken('');
    setRefreshToken('');
    sessionStorage.removeItem('findit_session_id_token');
    sessionStorage.removeItem('findit_session_access_token');
    sessionStorage.removeItem('findit_session_refresh_token');
    sessionStorage.removeItem('findit_session_user');
    localStorage.removeItem('campusfind_id_token');
    localStorage.removeItem('campusfind_access_token');
    localStorage.removeItem('campusfind_refresh_token');
    localStorage.removeItem('campusfind_user');
    localStorage.removeItem('findit_user');
    localStorage.removeItem('findit_id_token');
    setCurrentUser(null);
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'security' || (currentUser?.groups || []).includes('Admin');

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        idToken,
        accessToken,
        refreshToken,
        authError,
        signInWithCognito,
        signUpWithCognito,
        confirmSignUp,
        resendConfirmationCode,
        forgotPassword,
        confirmForgotPassword,
        refreshSession,
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
