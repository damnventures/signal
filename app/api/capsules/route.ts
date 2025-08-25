import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userApiKey = searchParams.get('userApiKey');
  
  if (!userApiKey) {
    return NextResponse.json({ error: 'User API key required for this endpoint' }, { status: 400 });
  }

  const API_URL = 'https://api.shrinked.ai';

  try {
    const response = await fetch(`${API_URL}/capsules`, {
      headers: {
        'x-api-key': userApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Capsules API] Failed to fetch capsules. Status: ${response.status}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to fetch capsules: ${response.statusText}` }, { status: response.status });
    }

    const capsules = await response.json();
    return NextResponse.json(capsules);

  } catch (error: any) {
    console.error('[Capsules API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}