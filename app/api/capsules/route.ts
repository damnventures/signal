import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const userApiKey = request.headers.get('x-api-key');
  const authHeader = request.headers.get('authorization');
  
  console.log(`[Capsules Route] Request received`);
  console.log(`[Capsules Route] API Key present: ${userApiKey ? 'yes' : 'no'}`);
  console.log(`[Capsules Route] Auth header present: ${authHeader ? 'yes' : 'no'}`);

  // For capsules, try API key first as it's more likely to work
  let requestHeaders: Record<string, string> = {};
  let authMethod = '';
  
  if (userApiKey) {
    requestHeaders['x-api-key'] = userApiKey;
    authMethod = 'API key';
    console.log(`[Capsules Route] Using API key authentication (last 4 chars): ...${userApiKey.slice(-4)}`);
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    requestHeaders['Authorization'] = authHeader;
    authMethod = 'Bearer token';
    console.log(`[Capsules Route] Using Bearer token authentication`);
  } else {
    console.error('[Capsules Route] No authentication method available');
    return NextResponse.json({ error: 'Authentication required (Bearer token or API key)' }, { status: 401 });
  }

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