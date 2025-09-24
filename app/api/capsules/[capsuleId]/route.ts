import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ capsuleId: string }> }
) {
  const { capsuleId } = await params;
  const body = await request.json();
  const userApiKey = request.headers.get('x-api-key');

  console.log(`[Update Capsule Route] Updating capsule ${capsuleId} with:`, body);

  // Use user's API key or fall back to default for demo capsules
  const API_KEY = userApiKey || process.env.SHRINKED_API_KEY;

  if (!API_KEY) {
    console.error('[Update Capsule Route] No API key available.');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const requestHeaders: Record<string, string> = {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  };

  const requestUrl = `https://api.shrinked.ai/capsules/${capsuleId}`;
  console.log(`[Update Capsule Route] Attempting to update capsule: ${requestUrl}`);

  try {
    const response = await fetch(requestUrl, {
      method: 'PATCH',
      headers: requestHeaders,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Update Capsule Route] API Error: Status: ${response.status}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to update capsule: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    console.log('[Update Capsule Route] API Success: Capsule updated successfully.');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Update Capsule Route] API Error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}