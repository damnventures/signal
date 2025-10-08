import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { accessToken, callbackUrl } = await request.json();
    console.log('[Composio API] Received request with token:', !!accessToken, 'callback:', callbackUrl);

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    if (!callbackUrl) {
      return NextResponse.json({ error: 'Callback URL is required' }, { status: 400 });
    }

    // Get user profile to get user ID
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.shrinked.ai';
    const profileResponse = await fetch(`${API_BASE_URL}/users/profile`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('Failed to fetch user profile:', errorText);
      return NextResponse.json({
        error: 'Failed to fetch user profile',
        message: 'Backend authentication service may be temporarily unavailable'
      }, { status: profileResponse.status });
    }

    const userProfile = await profileResponse.json();
    const userId = userProfile.userId || userProfile.id || userProfile._id;

    if (!userId) {
      console.error('User profile structure:', userProfile);
      return NextResponse.json({ error: 'User ID not found in profile' }, { status: 400 });
    }

    console.log('[Composio Gmail Route] Using userId:', userId, 'from profile:', userProfile.email);

    // TODO: Implement actual Composio integration
    // For now, return a demo response that matches expected Composio format
    const demoConnectionId = `demo_gmail_${userId}_${Date.now()}`;

    // In a real implementation, this would:
    // 1. Initialize Composio SDK with API key
    // 2. Call composio.connectedAccounts.initiate()
    // 3. Return the actual redirectUrl from Composio

    // Use our callback endpoint instead of the provided callbackUrl
    const ourCallbackUrl = `${new URL(request.url).origin}/api/composio/gmail-callback`;
    const demoRedirectUrl = `https://accounts.google.com/oauth/authorize?client_id=demo&redirect_uri=${encodeURIComponent(ourCallbackUrl)}&scope=https://www.googleapis.com/auth/gmail.readonly&response_type=code&state=${demoConnectionId}`;

    return NextResponse.json({
      redirectUrl: demoRedirectUrl,
      connectionRequestId: demoConnectionId,
      status: 'initiated',
      message: 'Demo Gmail OAuth flow initiated. In production, this would redirect to Composio-managed OAuth.'
    });

    /*
    // PRODUCTION CODE (uncomment when ready):

    import { Composio } from '@composio/core';

    const composio = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY, // Add to .env.local
    });

    // Create connection request for Gmail
    const connectionRequest = await composio.connectedAccounts.initiate(
      userId,
      process.env.COMPOSIO_GMAIL_AUTH_CONFIG_ID, // Auth config ID from Composio dashboard
      {
        callbackUrl: callbackUrl,
        data: {
          scope: ['https://www.googleapis.com/auth/gmail.readonly']
        }
      }
    );

    return NextResponse.json({
      redirectUrl: connectionRequest.redirectUrl,
      connectionRequestId: connectionRequest.id,
      status: 'initiated'
    });
    */

  } catch (error: any) {
    console.error('Error in Composio Gmail route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}