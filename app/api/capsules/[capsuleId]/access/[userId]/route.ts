import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ capsuleId: string; userId: string }> }
) {
  const { capsuleId, userId } = await params;
  const userApiKey = request.headers.get('x-api-key');

  console.log(`[Remove Access Route] Removing access for user ${userId} from capsule ${capsuleId}`);

  // Use user's API key for removing their own access, or default for removing from demo capsules  
  const API_KEY = userApiKey || process.env.SHRINKED_API_KEY;
  
  if (!API_KEY) {
    console.error('[Remove Access Route] No API key available.');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const requestHeaders: Record<string, string> = {
    'x-api-key': API_KEY
  };

  const requestUrl = `https://api.shrinked.ai/capsules/${capsuleId}/access/${userId}`;
  console.log(`[Remove Access Route] Attempting to remove access: ${requestUrl}`);

  try {
    const response = await fetch(requestUrl, {
      method: 'DELETE',
      headers: requestHeaders
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Remove Access Route] API Error: Status: ${response.status}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to remove access: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    console.log('[Remove Access Route] API Success: Access removed successfully.');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Remove Access Route] API Error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Also support removing access by email instead of userId
export async function POST(
  request: Request,
  { params }: { params: Promise<{ capsuleId: string; userId: string }> }
) {
  const { capsuleId } = await params;
  const body = await request.json();
  const { email } = body;

  console.log(`[Remove Access Route] Removing pending invite for ${email} from capsule ${capsuleId}`);

  // Use default API key for demo capsules
  const API_KEY = process.env.SHRINKED_API_KEY;
  
  if (!API_KEY) {
    console.error('[Remove Access Route] No default API key available.');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const requestHeaders: Record<string, string> = {
    'x-api-key': API_KEY
  };

  const requestUrl = `https://api.shrinked.ai/capsules/${capsuleId}/pending?email=${encodeURIComponent(email)}`;
  console.log(`[Remove Access Route] Attempting to remove pending invite: ${requestUrl}`);

  try {
    const response = await fetch(requestUrl, {
      method: 'DELETE',
      headers: requestHeaders
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Remove Access Route] API Error: Status: ${response.status}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to remove pending invite: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    console.log('[Remove Access Route] API Success: Pending invite removed successfully.');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Remove Access Route] API Error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}