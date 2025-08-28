import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const userApiKey = request.headers.get('x-api-key');
  
  console.log(`[Capsules Route] Request received`);
  console.log(`[Capsules Route] API Key present: ${userApiKey ? 'yes' : 'no'}`);

  // Use user's API key if provided, otherwise fall back to default
  const API_KEY = userApiKey || process.env.SHRINKED_API_KEY;
  
  if (!API_KEY) {
    console.error('[Capsules Route] No API key available (neither user nor default).');
    console.error('[Capsules Route] Environment SHRINKED_API_KEY:', process.env.SHRINKED_API_KEY ? 'present' : 'not set');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }
  
  const requestHeaders: Record<string, string> = {
    'x-api-key': API_KEY
  };
  const authMethod = userApiKey ? 'User API key' : 'Default API key';
  console.log(`[Capsules Route] Using ${authMethod} (last 4 chars): ...${API_KEY.slice(-4)}`);

  const requestUrl = `https://api.shrinked.ai/capsules`;
  console.log(`[Capsules Route] Attempting to fetch capsules from: ${requestUrl}`);
  console.log(`[Capsules Route] Using ${authMethod}`);

  try {
    const response = await fetch(requestUrl, {
      headers: requestHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Capsules Route] API Error: Failed to fetch capsules. Status: ${response.status}, StatusText: ${response.statusText}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to fetch capsules: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    console.log('[Capsules Route] API Success: Capsules fetched successfully.');
    console.log('[Capsules Route] Data received:', JSON.stringify(data, null, 2));
    console.log('[Capsules Route] Data type:', typeof data);
    console.log('[Capsules Route] Is array:', Array.isArray(data));
    if (Array.isArray(data)) {
      console.log('[Capsules Route] Array length:', data.length);
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Capsules Route] API Error: An exception occurred: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}