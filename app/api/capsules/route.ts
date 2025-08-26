import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const userApiKey = request.headers.get('x-api-key');

  // User API key is required to list their capsules
  if (!userApiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 401 });
  }

  const requestUrl = `https://api.shrinked.ai/capsules`;

  console.log(`[Capsules Route] Attempting to fetch capsules from: ${requestUrl}`);
  console.log(`[Capsules Route] Using user API Key (last 4 chars): ...${userApiKey.slice(-4)}`);

  try {
    const response = await fetch(requestUrl, {
      headers: {
        'x-api-key': userApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Capsules Route] API Error: Failed to fetch capsules. Status: ${response.status}, StatusText: ${response.statusText}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to fetch capsules: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    console.log('[Capsules Route] API Success: Capsules fetched successfully.');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Capsules Route] API Error: An exception occurred: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}