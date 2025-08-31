import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL = 'https://chars-intent-core.shrinked.workers.dev';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    console.log(`[Tools Proxy] Forwarding ${action} request to worker:`, data);

    // Forward the request to the appropriate worker endpoint
    const workerEndpoint = `${WORKER_URL}/${action}`;
    console.log(`[Tools Proxy] Worker endpoint:`, workerEndpoint);

    const workerResponse = await fetch(workerEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
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