'use client';

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';

const AuthRedirectHandler: React.FC = () => {
  const { setUserData } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handleAuthRedirect = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('accessToken');
      const refreshToken = urlParams.get('refreshToken');

      if (accessToken) {
        // Get the stored origin from localStorage
        const storedOrigin = localStorage.getItem('auth_redirect_origin');

        if (storedOrigin && storedOrigin !== window.location.origin) {
          // Clean up localStorage
          localStorage.removeItem('auth_redirect_origin');

          // Redirect to the original domain with tokens
          const redirectUrl = new URL('/', storedOrigin);
          redirectUrl.searchParams.set('accessToken', accessToken);
          if (refreshToken) {
            redirectUrl.searchParams.set('refreshToken', refreshToken);
          }

          window.location.href = redirectUrl.toString();
          return;
        }

        // If we're already on the correct domain, clean up localStorage
        localStorage.removeItem('auth_redirect_origin');

        // Clean the URL
        const newUrl = window.location.pathname;
        router.replace(newUrl);

        try {
          // Get API key and user profile
          const response = await fetch('/api/auth/api-key', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ accessToken }),
          });

          if (!response.ok) {
            throw new Error('Failed to get API key');
          }

          const { apiKey, userProfile } = await response.json();

          // Set user data in context
          setUserData(userProfile, accessToken, apiKey);

          // Store refresh token if it exists
          if (refreshToken) {
            localStorage.setItem('auth_refresh_token', refreshToken);
          }

        } catch (error) {
          console.error('Error during auth redirect handling:', error);
          // Handle error, maybe show a notification to the user
        }
      }
    };

    handleAuthRedirect();
  }, [router, setUserData]);

  return null; // This component doesn't render anything
};

export default AuthRedirectHandler;
