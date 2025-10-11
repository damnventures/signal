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

      let allProcessedEmails: any[] = [];
      let allInvestmentEmails: any[] = []; // Store investment emails found across batches
      let totalInvestmentEmails = 0;
      const targetInvestmentEmails = 10; // Target number of investment-relevant emails
      const maxBatches = 5; // Maximum number of batches to prevent infinite loops
      const batchSize = 50; // Emails per batch
      let currentBatch = 0;
      let nextPageToken: string | undefined;

      try {
        console.log('[Email Processing] Using Composio Gmail API via connected account');

        // Get the connected account first
        const connectedAccount = await composio.connectedAccounts.get(connectionId);
        console.log('[Email Processing] Connected account status:', connectedAccount.status);

        if (connectedAccount.status !== 'ACTIVE') {
          throw new Error(`Gmail connection not active. Status: ${connectedAccount.status}`);
        }

        console.log(`[Email Processing] Starting batch processing. Target: ${targetInvestmentEmails} investment emails, Max batches: ${maxBatches}`);

        // Process emails in batches until we reach our target or max batches
        while (currentBatch < maxBatches && totalInvestmentEmails < targetInvestmentEmails) {
          currentBatch++;
          console.log(`[Email Processing] Processing batch ${currentBatch}/${maxBatches}`);

          // Prepare request arguments
          const requestArgs: any = {
            query: gmailQuery,
            max_results: batchSize,
            include_payload: true
          };

          // Add page token for subsequent batches
          if (nextPageToken) {
            requestArgs.page_token = nextPageToken;
          }

          // Fetch emails from Gmail
          const response = await fetch(`https://backend.composio.dev/api/v3/tools/execute/GMAIL_FETCH_EMAILS`, {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.COMPOSIO_API_KEY!,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user_id: userId,
              connected_account_id: connectionId,
              arguments: requestArgs
            })
          });

          console.log(`[Email Processing] Batch ${currentBatch} - Composio API response status:`, response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Email Processing] Batch ${currentBatch} - API error:`, errorText);
            throw new Error(`Composio API failed for batch ${currentBatch}: ${response.status} - ${errorText}`);
          }

          const emailsResponse = await response.json();
          console.log(`[Email Processing] Batch ${currentBatch} - Received ${emailsResponse.data?.messages?.length || 0} emails`);

          // Update next page token for subsequent batches
          nextPageToken = emailsResponse.data?.nextPageToken;

          // Transform emails
          const emails = emailsResponse.data?.messages || [];
          const transformedEmails = emails.map((email: any) => {
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

          // Add to all processed emails
          allProcessedEmails.push(...transformedEmails);

          // Quick filter check to see how many investment emails we have in this batch
          console.log(`[Email Processing] Batch ${currentBatch} - Sending ${transformedEmails.length} emails to filter worker for quick assessment`);

          const quickFilterResponse = await fetch('https://chars-email.shrinked.workers.dev/filter-emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': userApiKey
            },
            body: JSON.stringify({
              emails: transformedEmails,
              filterPrompt: `Filter and classify ${emailType} emails for processing. Focus on investment-related content like funding rounds, valuations, term sheets, due diligence, and investor communications.`,
              existingCapsules: [],
              batchSize: 10
            })
          });

          if (quickFilterResponse.ok) {
            const quickFilterResult = await quickFilterResponse.json();
            const batchInvestmentEmailsData = quickFilterResult.results?.create_new || [];
            const batchInvestmentEmails = batchInvestmentEmailsData.length;
            totalInvestmentEmails += batchInvestmentEmails;

            // Store the investment emails for later job creation
            allInvestmentEmails.push(...batchInvestmentEmailsData);

            console.log(`[Email Processing] Batch ${currentBatch} - Found ${batchInvestmentEmails} investment emails (Total: ${totalInvestmentEmails}/${targetInvestmentEmails})`);
          } else {
            console.warn(`[Email Processing] Batch ${currentBatch} - Filter worker failed, continuing with next batch`);
          }

          // Check if we have no more emails or reached our target
          if (!nextPageToken || emails.length === 0) {
            console.log(`[Email Processing] No more emails available after batch ${currentBatch}`);
            break;
          }

          if (totalInvestmentEmails >= targetInvestmentEmails) {
            console.log(`[Email Processing] Reached target of ${targetInvestmentEmails} investment emails after batch ${currentBatch}`);
            break;
          }
        }

        console.log(`[Email Processing] Completed ${currentBatch} batches. Total emails: ${allProcessedEmails.length}, Investment emails found: ${totalInvestmentEmails}`);

      } catch (gmailError) {
        console.error('[Email Processing] Composio Gmail API failed:', gmailError);
        throw new Error(`Failed to fetch emails from Gmail: ${gmailError instanceof Error ? gmailError.message : 'Unknown error'}`);
      }

      // Set processed emails to all collected emails
      const processedEmails = allProcessedEmails;

      console.log(`[Email Processing] Found ${processedEmails.length} emails`);

      if (processedEmails.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No new emails found to process',
          emailsProcessed: 0,
          jobsCreated: []
        });
      }

      // Use the investment emails we already found during batching
      console.log('[Email Processing] Using investment emails found during batch filtering');
      console.log(`[Email Processing] Total investment emails found: ${allInvestmentEmails.length}`);

      const processableEmails = allInvestmentEmails;
      console.log(`[Email Processing] Found ${processableEmails.length} emails ready for processing`);

      const jobsCreated = [];

      if (processableEmails.length > 0) {
        console.log('[Email Processing] Creating jobs for filtered emails...');

        for (const emailData of processableEmails) {
          const email = emailData.email;
          const classification = emailData.classification;

          try {
            // Create job payload following the API spec
            // Create a simple text content for the email
            const emailContent = `Subject: ${email.subject}\nFrom: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\n\nContent: ${email.content}\n\nClassification: ${JSON.stringify(classification, null, 2)}`;

            const jobPayload = {
              jobName: `Email Processing - ${email.subject.substring(0, 50)}...`,
              scenario: 'TEXT_FILE_DEFAULT',
              email: userEmail,
              lang: 'en',
              isPublic: false,
              createPage: true,
              links: [`data:text/plain;charset=utf-8,${encodeURIComponent(emailContent)}`]
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
        message: `Successfully processed ${processedEmails.length} emails via ${currentBatch} batches. Created ${jobsCreated.length} processing jobs.`,
        emailsFound: processedEmails.length,
        emailsFiltered: processableEmails.length,
        jobsCreated: jobsCreated.length,
        jobs: jobsCreated,
        batchInfo: {
          batchesProcessed: currentBatch,
          targetReached: totalInvestmentEmails >= targetInvestmentEmails,
          investmentEmailsFound: totalInvestmentEmails
        },
        filterResult: {
          summary: {
            create_new: processableEmails.length,
            total_processed: processedEmails.length
          },
          classifications: processableEmails.map((emailData: any) => ({
            subject: emailData.email?.subject,
            priority: emailData.classification?.priority,
            action: emailData.classification?.action,
            keywords: emailData.classification?.keywords
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