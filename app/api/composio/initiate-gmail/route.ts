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

    // For now, return instructions for proper Composio setup
    return NextResponse.json({
      error: 'Composio integration not yet configured',
      message: 'To complete Gmail integration, you need to:\n\n' +
               '1. Get Composio API key from https://app.composio.dev\n' +
               '2. Create Gmail auth config in Composio dashboard\n' +
               '3. Add COMPOSIO_API_KEY to environment variables\n' +
               '4. Add COMPOSIO_AUTH_CONFIG_ID to environment variables\n' +
               '5. Install @composio/core package\n\n' +
               'Then uncomment the production code in /api/composio/initiate-gmail/route.ts',
      redirectUrl: null,
      setupRequired: true
    }, { status: 501 }); // 501 = Not Implemented

    /*
    // PRODUCTION CODE (uncomment when Composio is configured):

    import { Composio } from '@composio/core';

    const composio = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY!, // Add to .env.local
    });

    // Create connection request for Gmail using Composio's managed OAuth
    const connectionRequest = await composio.connectedAccounts.initiate(
      userId, // User ID from authenticated user
      process.env.COMPOSIO_AUTH_CONFIG_ID!, // Auth Config ID from Composio dashboard (e.g., ac_-bF3mcMCuOBu)
      {
        redirectUrl: callbackUrl, // Where to redirect after OAuth completion
        labels: ['gmail', 'email'], // Optional labels for organization
      }
    );

    // The redirectUrl from Composio will be something like:
    // https://backend.composio.dev/api/v1/connectedAccounts/[id]/initiate
    // This redirects to Google OAuth, then back to Composio, then to your callbackUrl

    return NextResponse.json({
      redirectUrl: connectionRequest.redirectUrl, // Composio-managed OAuth URL
      connectionRequestId: connectionRequest.id,
      status: 'initiated',
      message: 'Redirecting to Composio-managed Gmail OAuth flow'
    });
    */

  } catch (error: any) {
    console.error('Error in Composio Gmail route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}