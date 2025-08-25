import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  
  // Handle OAuth error
  if (error) {
    console.error('[OAuth Callback] Error from OAuth provider:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }

  // Handle case where we get direct tokens (if the backend sends them directly)
  const accessToken = searchParams.get('accessToken');
  const refreshToken = searchParams.get('refreshToken');
  
  if (accessToken) {
    // Direct token case - redirect to frontend with tokens
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('accessToken', accessToken);
    if (refreshToken) {
      redirectUrl.searchParams.set('refreshToken', refreshToken);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    console.error('[OAuth Callback] No authorization code received');
    return NextResponse.redirect(new URL('/?error=no_auth_code', request.url));
  }

  try {
    // Exchange authorization code for tokens with the backend API
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.shrinked.ai';
    const requestUrl = new URL(request.url);
    const tokenResponse = await fetch(`${API_BASE_URL}/auth/google/redirect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirect_uri: `${requestUrl.origin}/api/auth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    
    // Redirect to frontend with tokens
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('accessToken', tokenData.accessToken);
    if (tokenData.refreshToken) {
      redirectUrl.searchParams.set('refreshToken', tokenData.refreshToken);
    }
    
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('[OAuth Callback] Error exchanging code for tokens:', error);
    return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
  }
}