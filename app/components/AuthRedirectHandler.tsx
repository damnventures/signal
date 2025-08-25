'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const AuthRedirectHandler: React.FC = () => {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if we have tokens in the URL (successful auth)
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    
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
  }, [searchParams]);

  return null; // This component doesn't render anything
};

export default AuthRedirectHandler;