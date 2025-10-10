import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log('[Email Processing] Route called, parsing request body...');

    const {
      accessToken,
      userId,
      userEmail,
      connectionId,
      emailType = 'investing',
      userApiKey
    } = await request.json();

    console.log('[Email Processing] Request params:', {
      hasAccessToken: !!accessToken,
      hasUserId: !!userId,
      hasUserEmail: !!userEmail,
      hasConnectionId: !!connectionId,
      emailType,
      hasUserApiKey: !!userApiKey
    });

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!connectionId) {
      return NextResponse.json({ error: 'Gmail connection ID is required' }, { status: 400 });
    }

    if (!userApiKey) {
      return NextResponse.json({ error: 'User API key is required for processing' }, { status: 400 });
    }

    // Check if environment variables are set
    if (!process.env.COMPOSIO_API_KEY) {
      return NextResponse.json({
        error: 'COMPOSIO_API_KEY not configured'
      }, { status: 500 });
    }

    console.log(`[Email Processing] Starting ${emailType} email processing for user ${userId}`);

    try {
      console.log('[Email Processing] Starting Gmail fetching step...');

      // Step 1: Fetch emails from Gmail via Composio
      const { Composio } = await import('@composio/core');
      const composio = new Composio({
        apiKey: process.env.COMPOSIO_API_KEY!,
      });

      console.log('[Email Processing] Fetching emails from Gmail...');

      // Get Gmail emails using Composio Gmail actions
      const gmailQuery = emailType === 'investing'
        ? '(funding OR investment OR round OR valuation OR "term sheet" OR "due diligence" OR investor OR VC OR "venture capital") -in:spam -in:trash newer_than:30d'
        : 'in:inbox newer_than:7d';

      console.log(`[Email Processing] Gmail query: ${gmailQuery}`);

      let processedEmails: any[] = [];

      try {
        console.log('[Email Processing] Using Composio Gmail API via connected account');

        // Get the connected account first
        const connectedAccount = await composio.connectedAccounts.get(connectionId);
        console.log('[Email Processing] Connected account status:', connectedAccount.status);

        if (connectedAccount.status !== 'ACTIVE') {
          throw new Error(`Gmail connection not active. Status: ${connectedAccount.status}`);
        }

        // Try using the SDK method properly with the connected account ID
        console.log('[Email Processing] Attempting to use Composio SDK tools.execute method');

        // Try alternative v3 REST endpoint directly since SDK has signature issues
        const response = await fetch(`https://backend.composio.dev/api/v3/connectedAccounts/${connectionId}/execute`, {
          method: 'POST',
          headers: {
            'X-API-KEY': process.env.COMPOSIO_API_KEY!,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            appName: 'gmail',
            actionName: 'GMAIL_FETCH_EMAILS',
            params: {
              query: gmailQuery,
              max_results: 50,
              include_payload: true
            }
          })
        });

        console.log('[Email Processing] Composio v3 REST API response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Email Processing] Composio v3 REST API error:', errorText);
          throw new Error(`Composio v3 REST API failed: ${response.status} - ${errorText}`);
        }

        const emailsResponse = await response.json();

        console.log('[Email Processing] Composio Gmail emails response:', emailsResponse);

        // Transform Composio response to our expected format
        const emails = emailsResponse.data?.messages || emailsResponse.messages || [];
        const transformedEmails = emails.map((email: any) => {
          // Extract headers for subject, from, to
          const headers = email.payload?.headers || [];
          const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

          return {
            id: email.id || `email_${Date.now()}_${Math.random()}`,
            threadId: email.threadId || `thread_${Date.now()}`,
            subject: getHeader('Subject') || '(no subject)',
            from: getHeader('From') || 'unknown',
            to: getHeader('To') || userEmail,
            date: email.internalDate ? new Date(parseInt(email.internalDate)).toISOString() : new Date().toISOString(),
            content: email.snippet || '',
            snippet: email.snippet || ''
          };
        });

        console.log(`[Email Processing] Transformed ${transformedEmails.length} emails from Composio`);
        processedEmails = transformedEmails;

      } catch (gmailError) {
        console.error('[Email Processing] Composio Gmail API failed:', gmailError);
        throw new Error(`Failed to fetch emails from Gmail: ${gmailError instanceof Error ? gmailError.message : 'Unknown error'}`);
      }

      console.log(`[Email Processing] Found ${processedEmails.length} emails`);

      if (processedEmails.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No new emails found to process',
          emailsProcessed: 0,
          jobsCreated: []
        });
      }

      // Step 2: Send emails to filter worker for processing
      console.log('[Email Processing] Sending emails to filter worker...');
      console.log('[Email Processing] Filter worker URL: https://chars-email.shrinked.workers.dev/');
      console.log('[Email Processing] Request payload:', {
        emailCount: processedEmails.length,
        emailType: emailType,
        userId: userId,
        userApiKey: userApiKey ? `...${userApiKey.slice(-4)}` : 'none'
      });

      // Use the correct endpoint from the worker code
      const workerEndpoint = 'https://chars-email.shrinked.workers.dev/filter-emails';
      console.log(`[Email Processing] Using worker endpoint: ${workerEndpoint}`);

      const filterResponse = await fetch(workerEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': userApiKey
        },
        body: JSON.stringify({
          emails: processedEmails,
          filterPrompt: `Filter and classify ${emailType} emails for processing. Focus on investment-related content like funding rounds, valuations, term sheets, due diligence, and investor communications.`,
          existingCapsules: [],
          batchSize: 10
        })
      });

      console.log(`[Email Processing] Filter worker response status: ${filterResponse.status}`);

      console.log('[Email Processing] Filter worker response headers:', Object.fromEntries(filterResponse.headers.entries()));

      let filterResult;

      if (!filterResponse.ok) {
        const errorText = await filterResponse.text();
        console.error('[Email Processing] Filter worker error response:', errorText);

        // Use fallback instead of failing
        console.log('[Email Processing] Worker failed, using fallback processing');
        filterResult = {
          success: true,
          results: {
            create_new: processedEmails.map(email => ({ emails: [email] }))
          }
        };
      } else {
        filterResult = await filterResponse.json();
        console.log('[Email Processing] Filter worker full response:', JSON.stringify(filterResult, null, 2));
      }

      // Create jobs for filtered emails
      console.log('[Email Processing] Filter completed successfully');
      console.log('[Email Processing] Filter result structure:', {
        hasResults: !!filterResult.results,
        resultsKeys: filterResult.results ? Object.keys(filterResult.results) : [],
        createNewExists: !!filterResult.results?.create_new,
        createNewLength: filterResult.results?.create_new?.length || 0
      });

      const processableEmails = filterResult.results?.create_new || [];
      console.log(`[Email Processing] Found ${processableEmails.length} emails ready for processing`);

      const jobsCreated = [];

      if (processableEmails.length > 0) {
        console.log('[Email Processing] Creating jobs for filtered emails...');

        for (const emailData of processableEmails) {
          const email = emailData.email;
          const classification = emailData.classification;

          try {
            // Create job payload following the API spec
            const jobPayload = {
              jobName: `Email Processing - ${email.subject}`,
              scenario: 'TEXT_FILE_DEFAULT',
              email: userEmail,
              lang: 'en',
              isPublic: false,
              createPage: true,
              links: [`data:text/plain;base64,${Buffer.from(JSON.stringify({
                id: email.id,
                subject: email.subject,
                from: email.from,
                to: email.to,
                date: email.date,
                content: email.content,
                classification: classification
              })).toString('base64')}`]
            };

            console.log(`[Email Processing] Creating job for email: ${email.subject}`);

            // Create job via dev API for testing
            const jobResponse = await fetch(`${process.env.BACKEND_API_URL || 'https://dev-api.shrinked.ai'}/jobs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': userApiKey
              },
              body: JSON.stringify(jobPayload)
            });

            if (!jobResponse.ok) {
              const errorText = await jobResponse.text();
              console.error(`[Email Processing] Job creation failed for ${email.subject}:`, errorText);
              continue; // Skip this email and continue with others
            }

            const jobResult = await jobResponse.json();
            console.log(`[Email Processing] Job created successfully for ${email.subject}:`, jobResult._id);

            jobsCreated.push({
              emailId: email.id,
              emailSubject: email.subject,
              jobId: jobResult._id,
              jobName: jobResult.jobName,
              status: jobResult.status,
              priority: classification.priority,
              keywords: classification.keywords
            });

          } catch (jobError) {
            console.error(`[Email Processing] Failed to create job for email ${email.subject}:`, jobError);
          }
        }
      }

      console.log(`[Email Processing] Successfully created ${jobsCreated.length} jobs`);

      return NextResponse.json({
        success: true,
        message: `Successfully processed ${processedEmails.length} emails. Created ${jobsCreated.length} processing jobs.`,
        emailsFound: processedEmails.length,
        emailsFiltered: processableEmails.length,
        jobsCreated: jobsCreated.length,
        jobs: jobsCreated,
        filterResult: {
          summary: filterResult.summary,
          classifications: processableEmails.map((email: any) => ({
            subject: email.email?.subject,
            priority: email.classification?.priority,
            action: email.classification?.action,
            keywords: email.classification?.keywords
          }))
        }
      });

    } catch (composioError: any) {
      console.error('Email processing error:', composioError);
      return NextResponse.json({
        error: 'Email processing failed',
        message: composioError.message || 'Unknown error'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error in email processing route:', error);
    return NextResponse.json({
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}