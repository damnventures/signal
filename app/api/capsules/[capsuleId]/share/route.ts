import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { capsuleId: string } }
) {
  const { capsuleId } = params;
  const body = await request.json();
  const { email, role = 'viewer' } = body;

  console.log(`[Share Route] Sharing capsule ${capsuleId} with ${email} as ${role}`);

  // Use default API key for demo capsules  
  const API_KEY = process.env.SHRINKED_API_KEY;
  
  if (!API_KEY) {
    console.error('[Share Route] No default API key available.');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const requestHeaders: Record<string, string> = {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  };

  const requestUrl = `https://api.shrinked.ai/capsules/${capsuleId}/share`;
  console.log(`[Share Route] Attempting to share capsule: ${requestUrl}`);

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ email, role })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Share Route] API Error: Status: ${response.status}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to share capsule: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    console.log('[Share Route] API Success: Capsule shared successfully.');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Share Route] API Error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}