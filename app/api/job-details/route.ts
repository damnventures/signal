import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
  }

  const API_URL = process.env.BACKEND_API_URL || 'https://api.shrinked.ai';
  const API_KEY = process.env.SHRINKED_API_KEY;

  if (!API_KEY) {
    console.error('API Error: SHRINKED_API_KEY is not configured.');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  console.log(`[Job Details API] Attempting to fetch jobId from: ${API_URL}/jobs/by-result/${fileId}`);

  try {
    // Step 1: Fetch jobId using fileId
    const jobIdResponse = await fetch(`${API_URL}/jobs/by-result/${fileId}`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!jobIdResponse.ok) {
      const errorText = await jobIdResponse.text();
      console.error(`API Error: Failed to fetch jobId for fileId ${fileId}. Status: ${jobIdResponse.status}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to fetch jobId: ${jobIdResponse.statusText}` }, { status: jobIdResponse.status });
    }

    const jobIdData = await jobIdResponse.json();
    const jobId = jobIdData._id;

    if (!jobId) {
      console.error(`API Error: No jobId found for fileId ${fileId}`);
      return NextResponse.json({ error: 'No jobId found for this fileId' }, { status: 404 });
    }

    console.log(`[Job Details API] Fetched jobId: ${jobId} for fileId: ${fileId}`);

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
        break; // Success, exit loop
      }

      console.warn(`[Job Details API] Attempt ${i + 1} failed with status ${jobDetailsResponse.status}. Retrying in ${RETRY_DELAY}ms...`);
      
      if (i < MAX_RETRIES - 1) {
          await new Promise(res => setTimeout(res, RETRY_DELAY));
      }
    }

    if (!jobDetailsResponse || !jobDetailsResponse.ok) {
      const errorText = jobDetailsResponse ? await jobDetailsResponse.text() : 'No response from server.';
      console.error(`API Error: Failed to fetch job details for jobId ${jobId} after ${MAX_RETRIES} attempts. Last status: ${jobDetailsResponse?.status}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to fetch job details: ${jobDetailsResponse?.statusText}` }, { status: jobDetailsResponse?.status || 500 });
    }

    // Extract originalLink from steps where name is "UPLOAD_FILE"
    const uploadStep = jobData.steps?.find((step: any) => step.name === 'UPLOAD_FILE');
    const originalLink = uploadStep?.data?.originalLink;

    if (originalLink) {
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