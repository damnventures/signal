import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userApiKey } = await request.json();

    if (!userApiKey) {
      return NextResponse.json({ error: 'User API key is required' }, { status: 400 });
    }

    console.log('[Test Email Worker] Testing chars-email worker connectivity...');

    // Test the email worker with a simple request
    const testEmails = [
      {
        id: 'test_1',
        subject: 'Investment Opportunity Test',
        from: 'test@venture.com',
        content: 'This is a test email about investment opportunities.',
        date: new Date().toISOString()
      }
    ];

    console.log('[Test Email Worker] Sending test request to worker...');

    const response = await fetch('https://chars-email.shrinked.workers.dev/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': userApiKey
      },
      body: JSON.stringify({
        emails: testEmails,
        emailType: 'investing',
        userId: 'test_user',
        filterPrompt: 'Test filter for investing emails',
        batchSize: 10
      })
    });

    console.log('[Test Email Worker] Response status:', response.status);
    console.log('[Test Email Worker] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Test Email Worker] Error response:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Worker request failed',
        status: response.status,
        details: errorText
      });
    }

    const result = await response.json();
    console.log('[Test Email Worker] Success response:', result);

    return NextResponse.json({
      success: true,
      workerStatus: response.status,
      workerResponse: result,
      message: 'Email worker test completed successfully'
    });

  } catch (error: any) {
    console.error('[Test Email Worker] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}