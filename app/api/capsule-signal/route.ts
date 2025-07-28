import { NextResponse } from 'next/server';

export async function GET() {
  const API_KEY = process.env.SHRINKED_API_KEY;
  const CAPSULE_ID = '6887e02fa01e2f4073d3bb51';

  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(`https://api.shrinked.ai/capsules/${CAPSULE_ID}/context`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch signal: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
