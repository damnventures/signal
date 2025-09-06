import { NextRequest, NextResponse } from 'next/server';

const WRAP_WORKER_URL = process.env.WRAP_WORKER_URL || 'https://wrap.shrinked.workers.dev/';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.shrinked.ai';

interface Capsule {
  _id: string;
  name: string;
  content?: string;
  highlights?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface WrapRequest {
  accessToken?: string;
  apiKey?: string;
  lastStateHash?: string;
}

interface WrapResponse {
  success: boolean;
  summary: string;
  stateChanged: boolean;
  stateHash: string;
  metadata?: {
    capsuleCount: number;
    processingTimeMs: number;
    timestamp: string;
    contentSizeKB: number;
  };
  error?: string;
  fallback?: string;
}

async function fetchUserCapsules(accessToken: string, apiKey?: string): Promise<Capsule[]> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    console.log('[wrap-summary] Fetching user capsules...');
    const response = await fetch(`${API_BASE_URL}/capsules`, {
      headers,
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error('[wrap-summary] Failed to fetch capsules:', response.status);
      throw new Error(`Failed to fetch capsules: ${response.status}`);
    }

    const capsules = await response.json();
    console.log('[wrap-summary] Fetched', capsules.length, 'capsules');
    return capsules;
  } catch (error) {
    console.error('[wrap-summary] Error fetching capsules:', error);
    return [];
  }
}

async function fetchCapsuleContent(capsuleId: string, accessToken: string, apiKey?: string): Promise<string> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/capsules/${capsuleId}/signal`, {
      headers,
      cache: 'no-store'
    });

    if (response.ok) {
      const data = await response.json();
      return data.highlights || data.signal || '';
    } else {
      console.warn('[wrap-summary] Failed to fetch content for capsule:', capsuleId);
      return '';
    }
  } catch (error) {
    console.warn('[wrap-summary] Error fetching capsule content:', capsuleId, error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: WrapRequest = await request.json();
    const { accessToken, apiKey, lastStateHash } = body;

    if (!accessToken && !apiKey) {
      return NextResponse.json({
        error: 'Access token or API key required'
      }, { status: 400 });
    }

    console.log('[wrap-summary] Processing request...');

    // Fetch user's capsules
    const capsules = await fetchUserCapsules(accessToken || '', apiKey);

    if (capsules.length === 0) {
      return NextResponse.json({
        success: true,
        summary: "No capsules found. Start by creating your first capsule to see insights here.",
        stateChanged: false,
        stateHash: 'empty',
        metadata: {
          capsuleCount: 0,
          timestamp: new Date().toISOString(),
          processingTimeMs: 0,
          contentSizeKB: 0
        }
      });
    }

    // Enhance capsules with content (for first few capsules to avoid timeout)
    const enhancedCapsules: Capsule[] = [];
    const maxCapsulesWithContent = 5; // Limit to avoid timeouts

    for (let i = 0; i < Math.min(capsules.length, maxCapsulesWithContent); i++) {
      const capsule = capsules[i];
      console.log('[wrap-summary] Fetching content for capsule:', capsule.name);
      
      const content = await fetchCapsuleContent(capsule._id, accessToken || '', apiKey);
      enhancedCapsules.push({
        ...capsule,
        content: content || capsule.highlights || ''
      });
    }

    // Add remaining capsules without content if there are more
    if (capsules.length > maxCapsulesWithContent) {
      enhancedCapsules.push(...capsules.slice(maxCapsulesWithContent));
    }

    // Call Wrap worker
    console.log('[wrap-summary] Calling wrap worker with', enhancedCapsules.length, 'capsules');
    
    const wrapResponse = await fetch(WRAP_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        capsules: enhancedCapsules,
        userId: 'user', // Could extract from token if needed
        lastStateHash
      }),
    });

    if (!wrapResponse.ok) {
      throw new Error(`Wrap worker failed: ${wrapResponse.status}`);
    }

    const result: WrapResponse = await wrapResponse.json();
    console.log('[wrap-summary] Wrap worker completed successfully');

    return NextResponse.json(result);

  } catch (error) {
    console.error('[wrap-summary] Request failed:', error);
    
    return NextResponse.json({
      success: false,
      summary: "Your capsules are ready for analysis, but summary generation is temporarily unavailable.",
      stateChanged: true,
      stateHash: Date.now().toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        capsuleCount: 0,
        timestamp: new Date().toISOString(),
        processingTimeMs: 0,
        contentSizeKB: 0
      }
    }, { status: 500 });
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}