import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.shrinked.ai';

export async function POST(request: Request) {
  try {
    const { accessToken } = await request.json();
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    // First, get user profile to get user ID
    const profileResponse = await fetch(`${API_BASE_URL}/users/profile`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('Failed to fetch user profile:', errorText);
      return NextResponse.json({ 
        error: 'Failed to fetch user profile',
        message: 'Backend authentication service may be temporarily unavailable' 
      }, { status: profileResponse.status });
    }

    const userProfile = await profileResponse.json();
    const userId = userProfile.userId || userProfile.id;

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found in profile' }, { status: 400 });
    }

    // Check if user already has an API key
    const existingKeysResponse = await fetch(`${API_BASE_URL}/users/api-keys`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (existingKeysResponse.ok) {
      const existingKeys = await existingKeysResponse.json();
      
      // Find an active key named "default" or "Chars"
      const activeKey = existingKeys.find((key: any) => 
        key.isActive && (key.name === 'default' || key.name === 'Chars')
      );
      
      if (activeKey) {
        console.log('Using existing API key for user:', userId);
        return NextResponse.json({ 
          apiKey: activeKey.key, 
          userProfile,
          existing: true 
        });
      }
    }

    // Create new API key if none exists
    const createKeyResponse = await fetch(`${API_BASE_URL}/users/${userId}/api-key`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Chars', // Using "Chars" as requested by user
      }),
    });

    if (!createKeyResponse.ok) {
      const errorText = await createKeyResponse.text();
      console.error('Failed to create API key:', errorText);
      // Still return the user profile even if API key creation failed
      return NextResponse.json({ 
        error: 'Failed to create API key',
        userProfile 
      }, { status: createKeyResponse.status });
    }

    const newApiKey = await createKeyResponse.json();
    console.log('Created new API key for user:', userId);
    
    return NextResponse.json({ 
      apiKey: newApiKey.key, 
      userProfile,
      existing: false 
    });

  } catch (error: any) {
    console.error('Error in API key route:', error);
    
    // Try to still return user profile if we got that far
    try {
      const { accessToken } = await request.clone().json();
      if (accessToken) {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.shrinked.ai';
        const profileResponse = await fetch(`${API_BASE_URL}/users/profile`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (profileResponse.ok) {
          const userProfile = await profileResponse.json();
          return NextResponse.json({ 
            error: error.message, 
            userProfile 
          }, { status: 500 });
        }
      }
    } catch (profileError) {
      console.warn('Could not fetch user profile in error handler');
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}