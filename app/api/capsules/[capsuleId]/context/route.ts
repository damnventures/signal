
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: any) {
  const capsuleId = params.capsuleId;

  if (!capsuleId) {
    return NextResponse.json({ error: 'capsuleId is required' }, { status: 400 });
  }

  const API_URL = process.env.BACKEND_API_URL || 'https://api.shrinked.ai';
  const API_KEY = process.env.SHRINKED_API_KEY;
  const requestUrl = `${API_URL}/capsules/${capsuleId}/context`;

  if (!API_KEY) {
    console.error('API Error: SHRINKED_API_KEY is not configured.');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  console.log(`[Capsule Context] Attempting to fetch from: ${requestUrl}`);

  try {
    const response = await fetch(requestUrl, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Capsule Context] API Error: Failed to fetch capsule context. Status: ${response.status}, StatusText: ${response.statusText}, Body: ${errorText}`);
      throw new Error(`Failed to fetch capsule context: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[Capsule Context] API Success: Capsule context fetched successfully.');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Capsule Context] API Error: An exception occurred: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
