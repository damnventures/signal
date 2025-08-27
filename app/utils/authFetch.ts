// Utility function for making authenticated API calls with automatic token refresh
export const createAuthFetch = (refreshTokenFn: () => Promise<boolean>) => {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    // First attempt
    const response = await fetch(url, options);
    
    // If successful, return the response
    if (response.ok) {
      return response;
    }
    
    // If 401 or 403, try to refresh token and retry once
    if (response.status === 401 || response.status === 403) {
      console.log(`[AuthFetch] Got ${response.status}, attempting token refresh...`);
      
      const refreshed = await refreshTokenFn();
      
      if (!refreshed) {
        console.log('[AuthFetch] Token refresh failed, returning original response');
        return response;
      }
      
      // Update the Authorization header with new token if it exists
      const accessToken = localStorage.getItem('auth_access_token');
      if (accessToken && options.headers) {
        const headers = options.headers as Record<string, string>;
        if (headers['Authorization'] || headers['authorization']) {
          headers['Authorization'] = `Bearer ${accessToken}`;
          // Remove lowercase version if it exists
          delete headers['authorization'];
        }
      }
      
      console.log('[AuthFetch] Retrying request with refreshed token...');
      
      // Retry the request with potentially updated headers
      const retryResponse = await fetch(url, options);
      return retryResponse;
    }
    
    // For any other status code, return the original response
    return response;
  };
};