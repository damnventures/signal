import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      // OAuth was denied or failed
      const redirectUrl = new URL('/', url.origin);
      redirectUrl.searchParams.set('gmail_callback', 'failed');
      redirectUrl.searchParams.set('error', error);

      return NextResponse.redirect(redirectUrl.toString());
    }

    if (!code || !state) {
      // Missing required parameters
      const redirectUrl = new URL('/', url.origin);
      redirectUrl.searchParams.set('gmail_callback', 'failed');
      redirectUrl.searchParams.set('error', 'missing_parameters');

      return NextResponse.redirect(redirectUrl.toString());
    }

    console.log('[Composio Callback] Received OAuth callback with code and state:', { code: code.slice(0, 10) + '...', state });

    // TODO: In production, exchange the code for tokens via Composio
    // For now, simulate successful connection
    const connectionId = state; // state contains our connection request ID

    // Redirect back to the main app with success
    const redirectUrl = new URL('/', url.origin);
    redirectUrl.searchParams.set('gmail_callback', 'success');
    redirectUrl.searchParams.set('connectionId', connectionId);

    console.log('[Composio Callback] Redirecting to:', redirectUrl.toString());

    return NextResponse.redirect(redirectUrl.toString());

    /*
    // PRODUCTION CODE (uncomment when ready):

    import { Composio } from '@composio/core';

    const composio = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY,
    });

    // Complete the OAuth flow with Composio
    const connection = await composio.connectedAccounts.complete(state, {
      code: code,
      // Additional parameters if needed
    });

    if (connection.status === 'ACTIVE') {
      // Success - redirect with connection details
      const redirectUrl = new URL('/', url.origin);
      redirectUrl.searchParams.set('gmail_callback', 'success');
      redirectUrl.searchParams.set('connectionId', connection.id);

      return NextResponse.redirect(redirectUrl.toString());
    } else {
      // Connection failed
      const redirectUrl = new URL('/', url.origin);
      redirectUrl.searchParams.set('gmail_callback', 'failed');
      redirectUrl.searchParams.set('error', 'connection_failed');

      return NextResponse.redirect(redirectUrl.toString());
    }
    */

  } catch (error: any) {
    console.error('Error in Composio Gmail callback:', error);

    // Redirect to app with error
    const url = new URL(request.url);
    const redirectUrl = new URL('/', url.origin);
    redirectUrl.searchParams.set('gmail_callback', 'failed');
    redirectUrl.searchParams.set('error', 'callback_error');

    return NextResponse.redirect(redirectUrl.toString());
  }
}