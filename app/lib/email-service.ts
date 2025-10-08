// Email Service - Frontend service for email processing

import {
  DEFAULT_FILTER_PROMPT,
  DEFAULT_PROCESSING_PROMPT,
  DEFAULT_UPDATE_PROMPT,
  generateBusinessEmailQuery,
  BUSINESS_EMAIL_CONFIG,
  type EmailPromptConfig,
  type EmailClassificationResult,
  type EmailProcessingResult
} from './email-prompts';

// Email processing service configuration
const EMAIL_WORKER_URL = 'https://chars-email.shrinked.workers.dev';

export class EmailService {
  private workerUrl: string;

  constructor(workerUrl = EMAIL_WORKER_URL) {
    this.workerUrl = workerUrl;
  }

  // Filter emails using user-provided prompts
  async filterEmails(
    emails: any[],
    filterPrompt: string = DEFAULT_FILTER_PROMPT,
    existingCapsules: any[] = [],
    batchSize: number = BUSINESS_EMAIL_CONFIG.batchSizes.email_classification
  ): Promise<EmailProcessingResult> {
    try {
      const response = await fetch(`${this.workerUrl}/filter-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails,
          filterPrompt,
          existingCapsules,
          batchSize
        })
      });

      if (!response.ok) {
        throw new Error(`Email filtering failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Email filtering error:', error);
      throw new Error(`Failed to filter emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Process email thread into structured document
  async processEmailThread(
    threadEmails: any[],
    processingPrompt: string = DEFAULT_PROCESSING_PROMPT,
    capsuleId?: string,
    documentId?: string
  ): Promise<any> {
    try {
      const response = await fetch(`${this.workerUrl}/process-thread`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadEmails,
          processingPrompt,
          capsuleId,
          documentId
        })
      });

      if (!response.ok) {
        throw new Error(`Thread processing failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Thread processing error:', error);
      throw new Error(`Failed to process email thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Update existing capsule document with new email
  async updateCapsuleDocument(
    capsuleId: string,
    newEmail: any,
    existingDocument: any,
    updatePrompt: string = DEFAULT_UPDATE_PROMPT
  ): Promise<any> {
    try {
      const response = await fetch(`${this.workerUrl}/update-capsule-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          capsuleId,
          newEmail,
          existingDocument,
          updatePrompt
        })
      });

      if (!response.ok) {
        throw new Error(`Document update failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Document update error:', error);
      throw new Error(`Failed to update capsule document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Process business emails for a specific timeframe
  async processBusinessEmails(
    userConnectionId: string,
    config: EmailPromptConfig,
    timeframe: string = 'last_30_days',
    userDomains: string[] = []
  ): Promise<any> {
    try {
      const response = await fetch(`${this.workerUrl}/process-business-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userConnectionId,
          filterPrompt: config.filterPrompt,
          processingPrompt: config.processingPrompt,
          timeframe,
          userDomains
        })
      });

      if (!response.ok) {
        throw new Error(`Business email processing failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Business email processing error:', error);
      throw new Error(`Failed to process business emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate Gmail search query for business emails
  generateBusinessQuery(timeframe: string = 'last_30_days', userDomains: string[] = []): string {
    return generateBusinessEmailQuery(timeframe, userDomains);
  }

  // Get worker status
  async getWorkerStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.workerUrl}/status`);
      return await response.json();
    } catch (error) {
      console.error('Worker status check failed:', error);
      throw new Error(`Failed to check worker status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Email integration workflow helpers
export class EmailWorkflow {
  private emailService: EmailService;

  constructor(emailService: EmailService) {
    this.emailService = emailService;
  }

  // Complete workflow: Fetch -> Filter -> Process -> Create Capsules
  async processEmailsToCapules(
    emails: any[],
    config: EmailPromptConfig,
    existingCapsules: any[] = []
  ): Promise<{
    newCapsules: any[];
    updatedCapsules: any[];
    archivedEmails: any[];
    ignoredEmails: any[];
  }> {
    // Step 1: Filter emails
    const filterResult = await this.emailService.filterEmails(
      emails,
      config.filterPrompt,
      existingCapsules,
      config.batchSize
    );

    const results = {
      newCapsules: [] as any[],
      updatedCapsules: [] as any[],
      archivedEmails: [] as any[],
      ignoredEmails: [] as any[]
    };

    // Step 2: Process filtered results
    const { results: groupedEmails } = filterResult;

    // Create new capsules for new business threads
    if (groupedEmails.create_new) {
      for (const emailResult of groupedEmails.create_new) {
        if (emailResult.classification.type === 'business_thread') {
          // Group emails into threads first
          const threadEmails = this.groupEmailsIntoThreads([emailResult.email]);

          for (const thread of threadEmails) {
            if (thread.length >= config.minThreadSize) {
              const processedThread = await this.emailService.processEmailThread(
                thread,
                config.processingPrompt
              );

              // This would create a new capsule via your existing capsule API
              const newCapsule = await this.createCapsuleFromDocument(processedThread.document);
              results.newCapsules.push(newCapsule);
            }
          }
        }
      }
    }

    // Update existing capsules
    if (groupedEmails.update_existing) {
      for (const emailResult of groupedEmails.update_existing) {
        const { email, classification } = emailResult;
        const capsuleId = classification.matchingCapsuleId;

        if (capsuleId) {
          // Get existing document from capsule
          const existingDocument = await this.getCapsuleDocument(capsuleId);

          // Update document with new email
          const updatedResult = await this.emailService.updateCapsuleDocument(
            capsuleId,
            email,
            existingDocument,
            config.updatePrompt
          );

          // Replace document in capsule
          const updatedCapsule = await this.replaceCapsuleDocument(
            capsuleId,
            updatedResult.updatedDocument
          );
          results.updatedCapsules.push(updatedCapsule);
        }
      }
    }

    // Handle archived and ignored emails
    if (groupedEmails.archive) {
      results.archivedEmails = groupedEmails.archive.map(er => er.email);
    }

    if (groupedEmails.ignore) {
      results.ignoredEmails = groupedEmails.ignore.map(er => er.email);
    }

    return results;
  }

  // Group emails into conversation threads
  private groupEmailsIntoThreads(emails: any[]): any[][] {
    // Simple threading logic - can be enhanced
    const threads: Record<string, any[]> = {};

    for (const email of emails) {
      // Extract thread identifier from subject
      const threadKey = this.extractThreadKey(email.subject);

      if (!threads[threadKey]) {
        threads[threadKey] = [];
      }
      threads[threadKey].push(email);
    }

    return Object.values(threads).filter(thread => thread.length > 0);
  }

  // Extract thread key from email subject
  private extractThreadKey(subject: string): string {
    // Remove RE:, FWD:, etc. and normalize
    return subject
      .replace(/^(RE:|FWD?:|Fwd:)\s*/i, '')
      .toLowerCase()
      .trim();
  }

  // Placeholder methods for capsule operations (implement with your capsule API)
  private async createCapsuleFromDocument(document: any): Promise<any> {
    // Implementation would call your existing capsule creation API
    console.log('Creating capsule from document:', document.id);
    return { id: 'new-capsule-id', document };
  }

  private async getCapsuleDocument(capsuleId: string): Promise<any> {
    // Implementation would fetch document from existing capsule
    console.log('Getting document from capsule:', capsuleId);
    return {};
  }

  private async replaceCapsuleDocument(capsuleId: string, newDocument: any): Promise<any> {
    // Implementation would replace the document in the capsule
    console.log('Replacing document in capsule:', capsuleId);
    return { id: capsuleId, document: newDocument };
  }
}

// Default email service instance
export const emailService = new EmailService();