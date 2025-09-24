import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ capsuleId: string }> }
) {
  const { capsuleId } = await params;
  const body = await request.json();
  const { email } = body;

  console.log(`[Remove Access Route] Removing access for ${email} from capsule ${capsuleId}`);

  // Use system API key for removing from Shrinked capsules (similar to share)
  const API_KEY = process.env.SHRINKED_API_KEY;

  if (!API_KEY) {
    console.error('[Remove Access Route] No system API key available.');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const requestHeaders: Record<string, string> = {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  };

  // Try removing pending invite first
  const pendingUrl = `https://api.shrinked.ai/capsules/${capsuleId}/pending?email=${encodeURIComponent(email)}`;
  console.log(`[Remove Access Route] Attempting to remove pending invite: ${pendingUrl}`);

  try {
    const pendingResponse = await fetch(pendingUrl, {
      method: 'DELETE',
      headers: requestHeaders
    });

    if (pendingResponse.ok) {
      console.log('[Remove Access Route] Pending invite removed successfully.');
      return NextResponse.json({ message: 'Pending invite removed' });
    }
  } catch (error) {
    console.log('[Remove Access Route] No pending invite found, trying to remove user access...');
  }

  // If no pending invite, try to remove actual user access by email
  const removeUrl = `https://api.shrinked.ai/capsules/${capsuleId}/access/remove`;
  console.log(`[Remove Access Route] Attempting to remove user access: ${removeUrl}`);

  try {
    const response = await fetch(removeUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Remove Access Route] API Error: Status: ${response.status}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to remove access: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    console.log('[Remove Access Route] User access removed successfully.');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Remove Access Route] API Error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}