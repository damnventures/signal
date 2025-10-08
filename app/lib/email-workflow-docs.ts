// Email-to-Capsule Workflow Documentation
// Complete integration guide for Gmail → Filtering → Processing → Capsule creation

/**
 * COMPLETE EMAIL PROCESSING WORKFLOW
 * ==================================
 *
 * This document outlines the complete email-to-capsule processing pipeline
 * that integrates Gmail fetching via Composio with AI-powered filtering and
 * structured document creation.
 *
 * ARCHITECTURE OVERVIEW:
 * =====================
 *
 * 1. Frontend (Signal App): /Users/vanya/WORK/REPS/signal/
 *    - User configuration and prompts
 *    - Workflow orchestration
 *    - Results display and management
 *
 * 2. Workers (Processing Layer): /Users/vanya/WORK/REPS/workers/
 *    - gmail-fetcher.js: Gmail data retrieval via Composio
 *    - email-processor.js: AI-powered filtering and processing
 *    - argue-worker.js: Craig AI assistant (separate system)
 *
 * 3. External APIs:
 *    - Composio API: Gmail authentication and data access
 *    - Cloudflare AI: Email classification and processing
 *    - Capsule API: Document storage and management
 */

export interface WorkflowSteps {
  step1_authentication: {
    description: "User authenticates Gmail via Composio";
    components: ["Frontend OAuth flow", "Composio userConnectionId"];
    result: "userConnectionId available for API calls";
  };

  step2_configuration: {
    description: "User configures processing prompts";
    components: ["EmailProcessingConfig.tsx", "email-prompts.ts"];
    customizable: ["filterPrompt", "processingPrompt", "updatePrompt"];
  };

  step3_fetching: {
    description: "Fetch Gmail data via Composio";
    worker: "gmail-fetcher.js";
    endpoints: ["/test-connection", "/fetch-emails", "/fetch-threads", "/search-emails"];
    authentication: "env.COMPOSIO_API_KEY + userConnectionId";
  };

  step4_filtering: {
    description: "AI-powered email classification";
    worker: "email-processor.js";
    endpoint: "/filter-emails";
    actions: ["create_new", "update_existing", "archive", "ignore"];
  };

  step5_processing: {
    description: "Convert email threads to structured documents";
    worker: "email-processor.js";
    endpoint: "/process-thread";
    output: "Structured document with metadata, topics, decisions, actions";
  };

  step6_capsule_creation: {
    description: "Create or update capsules with processed documents";
    integration: "Capsule API (to be implemented)";
    operations: ["createCapsuleViaAPI", "updateCapsuleDocumentViaAPI"];
  };
}

/**
 * WORKFLOW IMPLEMENTATION EXAMPLE
 * ===============================
 */
export const workflowExample = {
  // 1. User Setup
  userConfig: {
    userConnectionId: "conn_user123_gmail",
    emailConfig: {
      filterPrompt: "Classify business emails for project management...",
      processingPrompt: "Extract key decisions and action items...",
      updatePrompt: "Integrate new email while preserving context...",
      minThreadSize: 2,
      batchSize: 50
    },
    timeframe: "last_30_days"
  },

  // 2. Gmail Data Fetch
  gmailFetch: {
    endpoint: "https://gmail-fetcher.shrinked.workers.dev/search-emails",
    request: {
      userConnectionId: "conn_user123_gmail",
      searchQuery: "(project OR client OR meeting) -in:spam -in:trash",
      timeframe: "last_30_days",
      includeThreads: true,
      maxResults: 100
    },
    response: {
      success: true,
      emails: "GmailEmail[]",
      threads: "GmailThread[]",
      totalResults: 85
    }
  },

  // 3. Email Classification
  emailFiltering: {
    endpoint: "https://chars-email.shrinked.workers.dev/filter-emails",
    request: {
      emails: "FormattedEmail[]",
      filterPrompt: "User's custom filtering logic...",
      existingCapsules: "ExistingCapsule[]",
      batchSize: 50
    },
    response: {
      results: {
        create_new: "EmailResult[]",      // New business threads
        update_existing: "EmailResult[]", // Add to existing capsules
        archive: "EmailResult[]",         // Archive without processing
        ignore: "EmailResult[]"           // Spam/irrelevant
      }
    }
  },

  // 4. Thread Processing
  threadProcessing: {
    endpoint: "https://chars-email.shrinked.workers.dev/process-thread",
    request: {
      threadEmails: "SortedEmailMessage[]",
      processingPrompt: "Extract structured information...",
      capsuleId: null,
      documentId: null
    },
    response: {
      document: {
        id: "doc_project_alpha_Q1",
        type: "email_conversation_thread",
        metadata: {
          participants: ["client@company.com", "pm@mycompany.com"],
          dateRange: { start: "2025-01-01", end: "2025-01-15" },
          primaryTopic: "Project Alpha Q1 Planning",
          emailCount: 12
        },
        structuredContent: {
          summary: "Comprehensive project planning discussion...",
          keyTopics: [
            {
              topic: "Budget Approval",
              status: "Pending client review",
              keyPoints: ["$50K initial budget", "Q1 timeline"],
              relatedEmailIndexes: [3, 7, 11]
            }
          ],
          decisions: ["Weekly status meetings", "Agile methodology"],
          actionItems: ["Draft SOW by Jan 20", "Setup project tools"],
          nextSteps: ["Client approval", "Team onboarding"]
        }
      }
    }
  },

  // 5. Capsule Creation
  capsuleIntegration: {
    operation: "createCapsuleViaAPI",
    input: "processedDocument",
    result: {
      id: "capsule_proj_alpha_2025",
      document: "structuredDocument",
      created: "2025-01-15T10:30:00Z"
    }
  }
};

/**
 * AUTHENTICATION FLOW
 * ===================
 */
export const authenticationFlow = {
  step1: {
    description: "User initiates Gmail connection",
    location: "Frontend (GmailIntegrationTest.tsx)",
    action: "User clicks 'Connect Gmail' button"
  },

  step2: {
    description: "Redirect to Composio OAuth",
    location: "Composio OAuth flow",
    result: "userConnectionId generated"
  },

  step3: {
    description: "Test connection",
    location: "gmail-fetcher.js /test-connection",
    authentication: "env.COMPOSIO_API_KEY + userConnectionId",
    verification: "Gmail API access confirmed"
  },

  step4: {
    description: "Save connection",
    location: "Frontend localStorage",
    data: "userConnectionId for future requests"
  }
};

/**
 * ERROR HANDLING & RECOVERY
 * =========================
 */
export const errorHandling = {
  connectionFailures: {
    cause: "Invalid userConnectionId or expired OAuth token",
    recovery: "Re-authenticate user through Composio OAuth",
    fallback: "Graceful degradation with manual email upload"
  },

  processingFailures: {
    cause: "AI model errors or malformed email data",
    recovery: "Retry with simplified prompts or skip problematic emails",
    fallback: "Archive emails for manual review"
  },

  capsuleCreationFailures: {
    cause: "Capsule API unavailable or document format issues",
    recovery: "Queue documents for later processing",
    fallback: "Export as JSON for manual import"
  }
};

/**
 * DEPLOYMENT CHECKLIST
 * ====================
 */
export const deploymentSteps = [
  {
    step: "Deploy Workers",
    actions: [
      "Deploy gmail-fetcher.js to Cloudflare Workers",
      "Deploy email-processor.js to Cloudflare Workers",
      "Update worker URLs in frontend services"
    ]
  },
  {
    step: "Environment Variables",
    actions: [
      "Add COMPOSIO_API_KEY to Cloudflare Workers environment",
      "Add worker URLs to Vercel environment variables",
      "Configure CORS settings for cross-origin requests"
    ]
  },
  {
    step: "Frontend Integration",
    actions: [
      "Update worker URLs in gmail-service.ts and email-service.ts",
      "Test complete workflow with EmailToCapsuleWorkflow.tsx",
      "Configure user authentication flow"
    ]
  },
  {
    step: "Capsule API Integration",
    actions: [
      "Implement actual capsule creation API calls",
      "Replace placeholder methods in email-to-capsule-workflow.ts",
      "Test document creation and updates"
    ]
  }
];

/**
 * SCALING CONSIDERATIONS
 * =====================
 */
export const scalingNotes = {
  volume: "Designed for processing thousands of emails per user",
  batching: "Configurable batch sizes for AI processing limits",
  caching: "Email data cached temporarily for reprocessing",
  rateLimit: "Respects Gmail API and Composio rate limits",
  parallel: "Thread processing can be parallelized by user"
};