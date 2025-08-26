import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');
  const headersList = headers();
  const userApiKey = headersList.get('x-api-key');

  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
  }

  const API_URL = process.env.BACKEND_API_URL || 'https://api.shrinked.ai';
  // Use user's API key if provided, otherwise fall back to default
  const API_KEY = userApiKey || process.env.SHRINKED_API_KEY;

  if (!API_KEY) {
    console.error('API Error: No API key available (neither user nor default).');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  console.log(`[Job Details API] Attempting to fetch jobId from: ${API_URL}/jobs/by-result/${fileId}`);
  console.log(`[Job Details API] Using ${userApiKey ? 'user' : 'default'} API Key (last 4 chars): ...${API_KEY.slice(-4)}`);

  try {
    // Step 1: Fetch jobId using fileId
    const jobIdUrl = `${API_URL}/jobs/by-result/${fileId}`;
    console.log(`[Job Details API] Making request to: ${jobIdUrl}`);
    
    const jobIdResponse = await fetch(jobIdUrl, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    console.log(`[Job Details API] Response status: ${jobIdResponse.status} ${jobIdResponse.statusText}`);

    if (!jobIdResponse.ok) {
      let errorText = `HTTP ${jobIdResponse.status}`;
      try {
        errorText = await jobIdResponse.text();
      } catch (readError: any) {
        console.warn(`[Job Details API] Could not read error response: ${readError.message}`);
      }
      
      console.error(`API Error: Failed to fetch jobId for fileId ${fileId}. Status: ${jobIdResponse.status}, Body: ${errorText}`);
      
      // If it's an auth error and we're using the default key, suggest using user key
      if (jobIdResponse.status === 401 && !userApiKey) {
        return NextResponse.json({ 
          error: 'Authentication failed with default API key. Please login to use your personal API key.',
          needsAuth: true 
        }, { status: 401 });
      }
      
      return NextResponse.json({ error: `Failed to fetch jobId: ${jobIdResponse.statusText} - ${errorText}` }, { status: jobIdResponse.status });
    }

    const jobIdData = await jobIdResponse.json();
    console.log(`[Job Details API] Received jobIdData:`, JSON.stringify(jobIdData, null, 2));
    const jobId = jobIdData._id;

    if (!jobId) {
      console.error(`API Error: No jobId found for fileId ${fileId}`);
      return NextResponse.json({ error: 'No jobId found for this fileId' }, { status: 404 });
    }

    console.log(`[Job Details API] Fetched jobId: ${jobId} for fileId: ${fileId}`);

    // Add a small delay before the second API call to avoid rapid successive requests
    await new Promise(resolve => setTimeout(resolve, 200));

    // Step 2: Fetch job details using jobId, with retry logic
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second
    let jobDetailsResponse;
    let jobData;

    for (let i = 0; i < MAX_RETRIES; i++) {
      console.log(`[Job Details API] Attempting to fetch job details for jobId ${jobId} (Attempt ${i + 1})`);
      jobDetailsResponse = await fetch(`${API_URL}/jobs/${jobId}`, {
        headers: {
          'x-api-key': API_KEY,
        },
      });

      if (jobDetailsResponse.ok) {
        jobData = await jobDetailsResponse.json();
        console.log(`[Job Details API] Received jobData for jobId ${jobId}:`, JSON.stringify(jobData, null, 2));
        break; // Success, exit loop
      }

      console.warn(`[Job Details API] Attempt ${i + 1} failed with status ${jobDetailsResponse.status}. Retrying in ${RETRY_DELAY}ms...`);
      
      if (i < MAX_RETRIES - 1) {
          await new Promise(res => setTimeout(res, RETRY_DELAY));
      }
    }

    if (!jobDetailsResponse || !jobDetailsResponse.ok) {
      let errorText = 'No response from server.';
      
      if (jobDetailsResponse) {
        try {
          // Only try to read the response body if it hasn't been read yet
          errorText = await jobDetailsResponse.text();
        } catch (readError: any) {
          console.warn(`[Job Details API] Could not read error response body: ${readError.message}`);
          errorText = `HTTP ${jobDetailsResponse.status} - ${jobDetailsResponse.statusText}`;
        }
      }
      
      console.error(`API Error: Failed to fetch job details for jobId ${jobId} after ${MAX_RETRIES} attempts. Last status: ${jobDetailsResponse?.status}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to fetch job details: ${jobDetailsResponse?.statusText}` }, { status: jobDetailsResponse?.status || 500 });
    }

    // Extract originalLink from steps where name is "UPLOAD_FILE"
    const uploadStep = jobData.steps?.find((step: any) => step.name === 'UPLOAD_FILE');
    console.log(`[Job Details API] Found UPLOAD_FILE step:`, JSON.stringify(uploadStep, null, 2));
    const originalLink = uploadStep?.data?.originalLink;

    if (originalLink) {
      console.log(`[Job Details API] Extracted originalLink: ${originalLink} from UPLOAD_FILE step.`);
      console.log(`[Job Details API] Fetched originalLink: ${originalLink} for jobId: ${jobId}`);
      return NextResponse.json({ originalLink });
    } else {
      console.error(`API Error: originalLink not found in UPLOAD_FILE step for jobId ${jobId}`);
      return NextResponse.json({ error: 'originalLink not found for this job' }, { status: 404 });
    }
  } catch (error: any) {
    console.error(`API Error: An exception occurred while fetching job details for fileId ${fileId}: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}