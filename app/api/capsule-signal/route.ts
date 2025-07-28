import { NextResponse } from 'next/server';

export async function GET() {
  const API_KEY = process.env.SHRINKED_API_KEY;
  const CAPSULE_ID = '6887e02fa01e2f4073d3bb51';
  const requestUrl = `https://api.shrinked.ai/capsules/${CAPSULE_ID}`;

  if (!API_KEY) {
    console.error('API Error: SHRINKED_API_KEY is not configured.');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  console.log(`Attempting to fetch from: ${requestUrl}`);
  console.log(`Using API Key (last 4 chars): ...${API_KEY.slice(-4)}`);

  try {
    const response = await fetch(requestUrl, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!response.ok) {
      console.error(`API Error: Failed to fetch signal. Status: ${response.status}, StatusText: ${response.statusText}`);
      throw new Error(`Failed to fetch signal: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('API Success: Data fetched successfully.');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`API Error: An exception occurred: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
