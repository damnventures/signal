import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userApiKey } = await request.json();

    if (!userApiKey) {
      return NextResponse.json({ error: 'User API key is required' }, { status: 400 });
    }

    console.log('[Test Job Creation] Testing backend API job creation...');

    // Test with a simple job payload
    const testJobPayload = {
      type: 'test_job',
      name: 'Test Job Creation',
      data: {
        test: 'data'
      },
      metadata: {
        source: 'test'
      }
    };

    console.log('[Test Job Creation] Sending job payload:', JSON.stringify(testJobPayload, null, 2));

    const response = await fetch(`${process.env.BACKEND_API_URL || 'https://api.shrinked.ai'}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': userApiKey
      },
      body: JSON.stringify(testJobPayload)
    });

    console.log('[Test Job Creation] Response status:', response.status);
    console.log('[Test Job Creation] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Test Job Creation] Error response:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Job creation failed',
        status: response.status,
        details: errorText
      });
    }

    const result = await response.json();
    console.log('[Test Job Creation] Success response:', result);

    return NextResponse.json({
      success: true,
      jobResponse: result,
      message: 'Job creation test completed successfully'
    });

  } catch (error: any) {
    console.error('[Test Job Creation] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}