import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!process.env.BACKEND_API_URL) {
      console.error('[CheckEmail] Backend API URL not found in environment');
      return NextResponse.json({ error: 'Backend API configuration error' }, { status: 500 });
    }

    console.log('[CheckEmail] Checking email availability:', email);

    // Proxy request to backend API
    const url = new URL('/users/validate-email', process.env.BACKEND_API_URL);
    url.searchParams.set('email', email.toLowerCase());
    
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('[CheckEmail] Backend API error:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Email validation failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[CheckEmail] Email availability result:', data);

    // Transform backend response to match expected format
    return NextResponse.json({
      found: !data.available, // found=true means email is taken (not available)
      email: data.email,
      available: data.available
    });
    
  } catch (error) {
    console.error('[CheckEmail] Error:', error);
    return NextResponse.json(
      { error: 'Email validation failed' },
      { status: 500 }
    );
  }
}