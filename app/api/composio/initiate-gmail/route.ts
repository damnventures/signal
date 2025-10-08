import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { accessToken, callbackUrl, userId, userEmail } = await request.json();
    console.log('[Composio API] Received request with token:', !!accessToken, 'callback:', callbackUrl, 'userId:', userId);

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    if (!callbackUrl) {
      return NextResponse.json({ error: 'Callback URL is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('[Composio Gmail Route] Using provided userId:', userId, 'email:', userEmail);

    // Check if environment variables are set
    if (!process.env.COMPOSIO_API_KEY) {
      return NextResponse.json({
        error: 'COMPOSIO_API_KEY not configured',
        message: 'Add COMPOSIO_API_KEY to your environment variables'
      }, { status: 500 });
    }

    if (!process.env.COMPOSIO_AUTH_CONFIG_ID) {
      return NextResponse.json({
        error: 'COMPOSIO_AUTH_CONFIG_ID not configured',
        message: 'Add COMPOSIO_AUTH_CONFIG_ID to your environment variables'
      }, { status: 500 });
    }

    try {
      // Dynamic import of Composio to avoid build issues
      const { Composio } = await import('@composio/core');

      // Initialize Composio with API key
      const composio = new Composio({
        apiKey: process.env.COMPOSIO_API_KEY!,
      });

      // Create connection request for Gmail using Composio's managed OAuth
      const connectionRequest = await composio.connectedAccounts.initiate(
        userId, // User ID from authenticated user (must be UUID format)
        process.env.COMPOSIO_AUTH_CONFIG_ID!, // Auth Config ID from Composio dashboard (e.g., ac_-bF3mcMCuOBu)
      );

      // The redirectUrl from Composio will be something like:
      // https://backend.composio.dev/api/v1/connectedAccounts/[id]/initiate
      // This redirects to Google OAuth, then back to Composio, then to your callbackUrl

      return NextResponse.json({
        redirectUrl: connectionRequest.redirect_url, // Composio-managed OAuth URL
        connectionRequestId: connectionRequest.id,
        status: connectionRequest.status || 'initiated',
        message: 'Redirecting to Composio-managed Gmail OAuth flow'
      });

    } catch (composioError: any) {
      console.error('Composio error:', composioError);

      if (composioError.message?.includes("Cannot resolve module '@composio/core'")) {
        return NextResponse.json({
          error: 'Composio SDK not installed',
          message: 'Please install @composio/core package: npm install @composio/core',
          setupRequired: true
        }, { status: 500 });
      }

      return NextResponse.json({
        error: 'Composio integration failed',
        message: composioError.message || 'Unknown Composio error'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error in Composio Gmail route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}