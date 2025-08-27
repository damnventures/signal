// Utility function for making authenticated API calls with automatic token refresh and 502 retry
export const createAuthFetch = (refreshTokenFn: () => Promise<boolean>) => {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const maxRetries = 3;
    const baseDelay = 500; // 500ms base delay
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const response = await fetch(url, options);
      
      // If successful, return the response
      if (response.ok) {
        return response;
      }
      
      // Handle 502 Bad Gateway with exponential backoff
      if (response.status === 502 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // 500ms, 1000ms, 2000ms
        console.log(`[AuthFetch] Got 502 Bad Gateway on attempt ${attempt}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If 401 or 403, try to refresh token and retry once
      if (response.status === 401 || response.status === 403) {
        console.log(`[AuthFetch] Got ${response.status}, attempting token refresh...`);
        
        const refreshed = await refreshTokenFn();
        
        if (!refreshed) {
          console.log('[AuthFetch] Token refresh failed, returning original response');
          return response;
        }
        
        // Update the Authorization header with new token
        const accessToken = localStorage.getItem('auth_access_token');
        if (accessToken) {
          // Ensure options.headers exists
          if (!options.headers) {
            options.headers = {};
          }
          const headers = options.headers as Record<string, string>;
          headers['Authorization'] = `Bearer ${accessToken}`;
          // Remove lowercase version if it exists
          delete headers['authorization'];
          console.log('[AuthFetch] Updated Authorization header with refreshed token');
        }
        
        console.log('[AuthFetch] Retrying request with refreshed token...');
        
        // Retry the request with potentially updated headers
        const retryResponse = await fetch(url, options);
        return retryResponse;
      }
      
      // For any other status code, return the original response
      return response;
    }
    
    // This should never be reached due to the loop, but TypeScript needs it
    throw new Error('Unexpected: all retry attempts exhausted');
  };
};