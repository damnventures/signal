import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL = 'https://chars-intent-core.shrinked.workers.dev';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userApiKey, ...data } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    console.log(`[Tools Proxy] Forwarding ${action} request to worker:`, data);
    console.log(`[Tools Proxy] User API Key: ${userApiKey ? 'present' : 'not provided'}`);

    // Forward the request to the appropriate worker endpoint
    const workerEndpoint = `${WORKER_URL}/${action}`;
    console.log(`[Tools Proxy] Worker endpoint:`, workerEndpoint);

    // Prepare headers - add user's API key if provided
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (userApiKey) {
      headers['x-api-key'] = userApiKey;
      console.log(`[Tools Proxy] Adding user API key to x-api-key header`);
    }

    const workerResponse = await fetch(workerEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...data, userApiKey })
    });

    console.log(`[Tools Proxy] Worker response status:`, workerResponse.status);

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      console.error(`[Tools Proxy] Worker error:`, errorText);
      return NextResponse.json(
        { error: `Worker request failed: ${errorText}` }, 
        { status: workerResponse.status }
      );
    }

    const result = await workerResponse.json();
    console.log(`[Tools Proxy] Worker success response:`, result);

    return NextResponse.json(result, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error) {
    console.error('[Tools Proxy] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}