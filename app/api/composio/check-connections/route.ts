import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { accessToken, userId, userEmail } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Check if environment variables are set
    if (!process.env.COMPOSIO_API_KEY) {
      return NextResponse.json({
        error: 'COMPOSIO_API_KEY not configured'
      }, { status: 500 });
    }

    try {
      // Dynamic import of Composio
      const { Composio } = await import('@composio/core');

      // Initialize Composio with API key
      const composio = new Composio({
        apiKey: process.env.COMPOSIO_API_KEY!,
      });

      // Get user's connected accounts
      const response = await composio.connectedAccounts.list({
        userIds: [userId]
      });

      const connectedAccounts = response.items || [];

      // Find Gmail connections
      const gmailConnections = connectedAccounts.filter(account =>
        account.toolkit?.slug?.toLowerCase() === 'gmail' && account.status === 'ACTIVE'
      );

      if (gmailConnections.length > 0) {
        // Return the first active Gmail connection
        const connection = gmailConnections[0];
        return NextResponse.json({
          connected: true,
          connectionId: connection.id,
          status: connection.status,
          appName: connection.toolkit?.slug || 'gmail',
          message: 'Gmail connection found'
        });
      } else {
        return NextResponse.json({
          connected: false,
          connections: connectedAccounts.map(acc => ({
            id: acc.id,
            appName: acc.toolkit?.slug || 'unknown',
            status: acc.status
          })),
          message: 'No active Gmail connection found'
        });
      }

    } catch (composioError: any) {
      console.error('Composio error:', composioError);
      return NextResponse.json({
        error: 'Failed to check connections',
        message: composioError.message || 'Unknown Composio error'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error in check connections route:', error);
    return NextResponse.json({
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}