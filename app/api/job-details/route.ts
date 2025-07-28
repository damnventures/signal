import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
  }

  const API_URL = process.env.BACKEND_API_URL; // Your backend API URL

  if (!API_URL) {
    console.error('API Error: BACKEND_API_URL is not configured.');
    return NextResponse.json({ error: 'Backend API URL not configured' }, { status: 500 });
  }

  console.log(`[Job Details API] Attempting to fetch from: ${API_URL}/jobs/by-result/${fileId}`);

  try {
    const response = await fetch(`${API_URL}/jobs/by-result/${fileId}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: Failed to fetch job details for fileId ${fileId}. Status: ${response.status}, Body: ${errorText}`);
      return NextResponse.json({ error: `Failed to fetch job details: ${response.statusText}` }, { status: response.status });
    }

    const jobData = await response.json();

    if (jobData && jobData.originalLink) {
      return NextResponse.json({ originalLink: jobData.originalLink });
    } else {
      return NextResponse.json({ error: 'originalLink not found for this job' }, { status: 404 });
    }
  } catch (error: any) {
    console.error(`API Error: An exception occurred while fetching job details for fileId ${fileId}: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
