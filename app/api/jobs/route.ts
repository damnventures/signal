import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('id');
  const userApiKey = request.headers.get('x-api-key');

  const API_URL = process.env.BACKEND_API_URL || 'https://api.shrinked.ai';
  // Use user's API key if provided, otherwise fall back to default
  const API_KEY = userApiKey || process.env.SHRINKED_API_KEY;

  if (!API_KEY) {
    console.error('[Jobs API] No API key available (neither user nor default).');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    let endpoint = `${API_URL}/jobs`;
    if (jobId) {
      endpoint = `${API_URL}/jobs/${jobId}`;
    }

    console.log(`[Jobs API] Making request to: ${endpoint}`);
    console.log(`[Jobs API] Using ${userApiKey ? 'user' : 'default'} API Key (last 4 chars): ...${API_KEY.slice(-4)}`);
    
    const response = await fetch(endpoint, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
    });

    console.log(`[Jobs API] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Jobs API] Failed to fetch jobs. Status: ${response.status}, Body: ${errorText}`);
      
      // If it's an auth error and we're using the default key, suggest using user key
      if (response.status === 401 && !userApiKey) {
        return NextResponse.json({ 
          error: 'Authentication failed with default API key. Please login to use your personal API key.',
          needsAuth: true 
        }, { status: 401 });
      }
      
      return NextResponse.json({ error: `Failed to fetch jobs: ${response.statusText} - ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    console.log(`[Jobs API] Successfully fetched ${jobId ? 'job' : 'jobs'}`);
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Jobs API] Exception occurred: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}