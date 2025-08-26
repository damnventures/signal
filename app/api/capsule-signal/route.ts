import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const userApiKey = request.headers.get('x-api-key');
  const { searchParams } = new URL(request.url);
  const capsuleId = searchParams.get('capsuleId');

  if (!capsuleId) {
    return NextResponse.json({ error: 'capsuleId is required' }, { status: 400 });
  }
  
  // Use user's API key if provided, otherwise fall back to default
  const API_KEY = userApiKey || process.env.SHRINKED_API_KEY;
  const requestUrl = `https://api.shrinked.ai/capsules/${capsuleId}`;

  if (!API_KEY) {
    console.error('API Error: No API key available (neither user nor default).');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  console.log(`[Route] Attempting to fetch from: ${requestUrl}`);
  console.log(`[Route] Using ${userApiKey ? 'user' : 'default'} API Key (last 4 chars): ...${API_KEY.slice(-4)}`);

  try {
    const response = await fetch(requestUrl, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Route] API Error: Failed to fetch capsule. Status: ${response.status}, StatusText: ${response.statusText}, Body: ${errorText}`);
      throw new Error(`Failed to fetch capsule: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[Route] API Success: Capsule fetched successfully.');
    console.log('[Route] Capsule data:', JSON.stringify(data, null, 2)); // Log the full data
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Route] API Error: An exception occurred: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}