import { NextResponse } from 'next/server';
import { SHRINKED_CAPSULE_IDS } from '../../constants/shrinkedCapsules';

export async function GET(request: Request) {
  const userApiKey = request.headers.get('x-api-key');
  const defaultApiKey = process.env.SHRINKED_API_KEY;
  
  console.log(`[Shared Capsules Route] Request received`);
  console.log(`[Shared Capsules Route] User API Key present: ${userApiKey ? 'yes' : 'no'}`);
  console.log(`[Shared Capsules Route] Default API Key present: ${defaultApiKey ? 'yes' : 'no'}`);

  // Use user API key first, fallback to default API key for system capsules
  const apiKey = userApiKey || defaultApiKey;
  if (!apiKey) {
    console.log('[Shared Capsules Route] No API key available (neither user nor default) - returning empty array');
    return NextResponse.json([]);
  }
  
  const requestHeaders: Record<string, string> = {
    'x-api-key': apiKey
  };

  // The Shrinked API should have an endpoint to get shared capsules
  // If not available, we can get all capsules and filter for shared ones
  const requestUrl = `https://api.shrinked.ai/capsules?shared=true`;
  console.log(`[Shared Capsules Route] Attempting to fetch shared capsules from: ${requestUrl}`);

  try {
    const response = await fetch(requestUrl, {
      headers: requestHeaders,
    });

    if (!response.ok) {
      // If shared endpoint doesn't exist, fall back to regular capsules endpoint
      // and let the frontend filter
      console.log(`[Shared Capsules Route] Shared endpoint not available, falling back to regular capsules endpoint`);
      const fallbackUrl = `https://api.shrinked.ai/capsules`;
      const fallbackResponse = await fetch(fallbackUrl, {
        headers: requestHeaders,
      });
      
      if (!fallbackResponse.ok) {
        const errorText = await fallbackResponse.text();
        console.error(`[Shared Capsules Route] Fallback API Error: Status: ${fallbackResponse.status}, Body: ${errorText}`);
        return NextResponse.json({ error: `Failed to fetch capsules: ${fallbackResponse.statusText}` }, { status: fallbackResponse.status });
      }
      
      const data = await fallbackResponse.json();
      // Filter for shared capsules (those where user is not the owner)
      const sharedCapsules = Array.isArray(data) ? data.filter((capsule: any) => 
        capsule.visibility === 'shared' && capsule.shared === true
      ) : [];
      
      // Check all known Shrinked capsules for user access
      if (userApiKey) {
        for (const capsuleId of SHRINKED_CAPSULE_IDS) {
          try {
            const response = await fetch(`https://api.shrinked.ai/capsules/${capsuleId}`, {
              headers: { 'x-api-key': userApiKey }
            });

            if (response.ok) {
              const capsuleData = await response.json();
              // User has access to this capsule, add it to shared list
              sharedCapsules.push({
                _id: capsuleData._id,
                name: capsuleData.name,
                visibility: capsuleData.visibility || 'private',
                shared: true,
                isShared: true,
                acl: capsuleData.acl
              });
              console.log(`[Shared Capsules Route] Fallback: Added ${capsuleData.name} for user with verified access`);
            }
          } catch (error) {
            console.log(`[Shared Capsules Route] Fallback: User does not have access to capsule ${capsuleId}`);
          }
        }
      }

      console.log('[Shared Capsules Route] Fallback Success: Found', sharedCapsules.length, 'shared capsules');
      return NextResponse.json(sharedCapsules);
    }

    const data = await response.json();
    console.log('[Shared Capsules Route] API Success: Shared capsules fetched successfully.');
    console.log('[Shared Capsules Route] Found', Array.isArray(data) ? data.length : 'unknown', 'shared capsules');
    
    // Temporarily add the LastWeekTonight Preview capsule as a shared capsule for testing
    if (Array.isArray(data)) {
      data.push({
        _id: '68c32cf3735fb4ac0ef3ccbf',
        name: 'LastWeekTonight Preview',
        visibility: 'shared',
        shared: true,
        isPublic: false
      });

      // Check all known Shrinked capsules for user access
      if (userApiKey) {
        for (const capsuleId of SHRINKED_CAPSULE_IDS) {
          try {
            const response = await fetch(`https://api.shrinked.ai/capsules/${capsuleId}`, {
              headers: { 'x-api-key': userApiKey }
            });

            if (response.ok) {
              const capsuleData = await response.json();
              // User has access to this capsule, add it to shared list
              data.push({
                _id: capsuleData._id,
                name: capsuleData.name,
                visibility: capsuleData.visibility || 'private',
                shared: true,
                isShared: true,
                acl: capsuleData.acl
              });
              console.log(`[Shared Capsules Route] Added ${capsuleData.name} for user with verified access`);
            }
          } catch (error) {
            console.log(`[Shared Capsules Route] User does not have access to capsule ${capsuleId}`);
          }
        }
      }
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Shared Capsules Route] API Error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}