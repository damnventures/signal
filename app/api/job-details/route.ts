import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');
  const userApiKey = request.headers.get('x-api-key');

  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
  }

  const API_URL = process.env.BACKEND_API_URL || 'https://api.shrinked.ai';
  const defaultApiKey = process.env.SHRINKED_API_KEY;
  let apiKey = userApiKey || defaultApiKey;
  let isUsingUserKey = !!userApiKey;

  if (!apiKey) {
    console.error('API Error: No API key available (neither user nor default).');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  console.log(`[Job Details API] Attempting to fetch jobId from: ${API_URL}/jobs/by-result/${fileId}`);

  try {
    // Step 1: Fetch jobId using fileId
    const jobIdUrl = `${API_URL}/jobs/by-result/${fileId}`;
    let jobIdResponse;

    const doFetchJobId = async (key: string, isUser: boolean) => {
      console.log(`[Job Details API] Making request to: ${jobIdUrl}`);
      console.log(`[Job Details API] Using ${isUser ? 'user' : 'default'} API Key (last 4 chars): ...${key.slice(-4)}`);
      return await fetch(jobIdUrl, {
        headers: { 'x-api-key': key },
      });
    };

    jobIdResponse = await doFetchJobId(apiKey, isUsingUserKey);

    // If user key fails with 403, and there is a default key, retry with default key
    if (jobIdResponse.status === 403 && isUsingUserKey && defaultApiKey) {
      console.log(`[Job Details API] User key failed with 403. Retrying with default API key.`);
      apiKey = defaultApiKey;
      isUsingUserKey = false;
      jobIdResponse = await doFetchJobId(apiKey, isUsingUserKey);
    }

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

    // Add a delay before the second API call to avoid rapid successive requests and reduce 502 errors
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Fetch job details using jobId, with retry logic
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds - increased to help with 502 errors
    let jobDetailsResponse;
    let jobData;

    for (let i = 0; i < MAX_RETRIES; i++) {
      console.log(`[Job Details API] Attempting to fetch job details for jobId ${jobId} (Attempt ${i + 1})`);
      jobDetailsResponse = await fetch(`${API_URL}/jobs/${jobId}`, {
        headers: {
          'x-api-key': apiKey, // Use the potentially updated apiKey
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