import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const userApiKey = request.headers.get('x-api-key');
  const { searchParams } = new URL(request.url);
  const capsuleId = searchParams.get('capsuleId');

  console.log(`[Capsule-Signal Route] Request received for capsuleId: ${capsuleId}`);
  console.log(`[Capsule-Signal Route] User API Key: ${userApiKey ? 'present' : 'not provided'}`);

  if (!capsuleId) {
    console.error('[Capsule-Signal Route] Error: capsuleId is required');
    return NextResponse.json({ error: 'capsuleId is required' }, { status: 400 });
  }
  
  // Use user's API key if provided, otherwise fall back to default
  const API_KEY = userApiKey || process.env.SHRINKED_API_KEY;
  const requestUrl = `https://api.shrinked.ai/capsules/${capsuleId}`;

  if (!API_KEY) {
    console.error('[Capsule-Signal Route] Error: No API key available (neither user nor default).');
    console.error('[Capsule-Signal Route] Environment SHRINKED_API_KEY:', process.env.SHRINKED_API_KEY ? 'present' : 'not set');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  console.log(`[Capsule-Signal Route] Making request to: ${requestUrl}`);
  console.log(`[Capsule-Signal Route] Using ${userApiKey ? 'user' : 'default'} API Key (last 4 chars): ...${API_KEY.slice(-4)}`);

  try {
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[Capsule-Signal Route] External API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Capsule-Signal Route] External API Error: Status ${response.status}, Body: ${errorText}`);
      return NextResponse.json({ 
        error: `External API error: ${response.statusText}`,
        details: errorText 
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('[Capsule-Signal Route] Success: Capsule fetched from external API');
    console.log('[Capsule-Signal Route] Data preview:', data ? 'data received' : 'no data');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Capsule-Signal Route] Exception: ${error.message}`);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}