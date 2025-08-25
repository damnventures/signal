'use client';

import { useEffect } from 'react';

const AuthRedirectHandler: React.FC = () => {
  useEffect(() => {
    // Check if we have tokens in the URL (successful auth)
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
    }
  }, []);

  return null; // This component doesn't render anything
};

export default AuthRedirectHandler;