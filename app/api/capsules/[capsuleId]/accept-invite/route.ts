import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { capsuleId: string } }
) {
  const { capsuleId } = params;
  const body = await request.json();
  const { email } = body;
  const userApiKey = request.headers.get('x-api-key');

  console.log(`[Accept Invite Route] Accepting invite for capsule ${capsuleId} by ${email}`);

  // Use user's API key for authenticated users
  const API_KEY = userApiKey || process.env.SHRINKED_API_KEY;
  
  if (!API_KEY) {
    console.error('[Accept Invite Route] No API key available.');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const requestHeaders: Record<string, string> = {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  };

  const requestUrl = `https://api.shrinked.ai/capsules/${capsuleId}/accept-invite`;
  console.log(`[Accept Invite Route] Attempting to accept invite: ${requestUrl}`);

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Accept Invite Route] API Error: Status: ${response.status}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to accept invite: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    console.log('[Accept Invite Route] API Success: Invite accepted successfully.');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Accept Invite Route] API Error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}