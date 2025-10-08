// Complete Email-to-Capsule Processing Workflow

import { GmailService, formatEmailForProcessing, formatThreadForProcessing } from './gmail-service';
import { EmailService, EmailWorkflow } from './email-service';
import {
  BUSINESS_EMAIL_CONFIG,
  generateBusinessEmailQuery,
  type EmailPromptConfig
} from './email-prompts';

export interface EmailToCapsuleConfig {
  userConnectionId: string;
  emailConfig: EmailPromptConfig;
  timeframe: string;
  userDomains?: string[];
}

export interface ProcessingResult {
  success: boolean;
  emailsFetched: number;
  threadsProcessed: number;
  capsulesCreated: number;
  capsulesUpdated: number;
  emailsArchived: number;
  emailsIgnored: number;
  processingTime: number;
  errors: string[];
}

export class EmailToCapsuleWorkflow {
  private gmailService: GmailService;
  private emailService: EmailService;
  private emailWorkflow: EmailWorkflow;

  constructor() {
    this.gmailService = new GmailService();
    this.emailService = new EmailService();
    this.emailWorkflow = new EmailWorkflow(this.emailService);
  }

  /**
   * Complete workflow: Fetch emails → Filter → Process → Create Capsules
   */
  async processEmailsToCapsules(
    config: EmailToCapsuleConfig,
    existingCapsules: any[] = []
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const result: ProcessingResult = {
      success: false,
      emailsFetched: 0,
      threadsProcessed: 0,
      capsulesCreated: 0,
      capsulesUpdated: 0,
      emailsArchived: 0,
      emailsIgnored: 0,
      processingTime: 0,
      errors: []
    };

    try {
      console.log('Starting email-to-capsule workflow...');

      // Step 1: Set up Gmail connection
      this.gmailService.setConnectionConfig({
        userConnectionId: config.userConnectionId
      });

      // Step 2: Fetch business emails and threads
      console.log('Fetching business emails...');
      const businessEmailsResult = await this.gmailService.fetchBusinessEmails(config.timeframe);

      if (!businessEmailsResult.success) {
        throw new Error('Failed to fetch business emails');
      }

      const { results } = businessEmailsResult;
      result.emailsFetched = (results.emails?.length || 0) +
                           (results.threads?.reduce((sum: number, thread: any) => sum + (thread.messages?.length || 0), 0) || 0);

      console.log(`Fetched ${result.emailsFetched} emails across ${results.threads?.length || 0} threads`);

      // Step 3: Process threads first (higher priority)
      if (results.threads && results.threads.length > 0) {
        console.log('Processing email threads...');
        await this.processEmailThreads(results.threads, config, result, existingCapsules);
      }

      // Step 4: Process individual emails
      if (results.emails && results.emails.length > 0) {
        console.log('Processing individual emails...');
        await this.processIndividualEmails(results.emails, config, result, existingCapsules);
      }

      result.processingTime = Date.now() - startTime;
      result.success = true;

      console.log('Email-to-capsule workflow completed:', result);
      return result;

    } catch (error) {
      console.error('Email-to-capsule workflow failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Process email threads into structured capsules
   */
  private async processEmailThreads(
    threads: any[],
    config: EmailToCapsuleConfig,
    result: ProcessingResult,
    existingCapsules: any[]
  ) {
    for (const thread of threads) {
      try {
        // Format thread for processing
        const formattedThread = formatThreadForProcessing(thread);

        if (formattedThread.messageCount < config.emailConfig.minThreadSize) {
          console.log(`Skipping thread ${thread.id} - too few messages (${formattedThread.messageCount})`);
          continue;
        }

        // Check if thread already exists in capsules
        const existingCapsule = this.findMatchingCapsule(formattedThread, existingCapsules);

        if (existingCapsule) {
          // Update existing capsule
          console.log(`Updating existing capsule for thread ${thread.id}`);
          await this.updateExistingCapsule(existingCapsule, formattedThread, config);
          result.capsulesUpdated++;
        } else {
          // Create new capsule
          console.log(`Creating new capsule for thread ${thread.id}`);
          await this.createNewCapsule(formattedThread, config);
          result.capsulesCreated++;
        }

        result.threadsProcessed++;

      } catch (error) {
        console.error(`Failed to process thread ${thread.id}:`, error);
        result.errors.push(`Thread ${thread.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Process individual emails
   */
  private async processIndividualEmails(
    emails: any[],
    config: EmailToCapsuleConfig,
    result: ProcessingResult,
    existingCapsules: any[]
  ) {
    // Format emails for filtering
    const formattedEmails = emails.map(formatEmailForProcessing);

    // Filter emails using the email service
    const filterResult = await this.emailService.filterEmails(
      formattedEmails,
      config.emailConfig.filterPrompt,
      existingCapsules,
      config.emailConfig.batchSize
    );

    // Process filtered results
    const { results: groupedEmails } = filterResult;

    // Handle each action category
    if (groupedEmails.create_new) {
      for (const emailResult of groupedEmails.create_new) {
        try {
          await this.createCapsuleFromEmail(emailResult.email, config);
          result.capsulesCreated++;
        } catch (error) {
          result.errors.push(`Create email ${emailResult.email.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    if (groupedEmails.update_existing) {
      for (const emailResult of groupedEmails.update_existing) {
        try {
          await this.updateCapsuleWithEmail(emailResult, config);
          result.capsulesUpdated++;
        } catch (error) {
          result.errors.push(`Update email ${emailResult.email.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    result.emailsArchived += groupedEmails.archive?.length || 0;
    result.emailsIgnored += groupedEmails.ignore?.length || 0;
  }

  /**
   * Find matching capsule for a thread/email
   */
  private findMatchingCapsule(thread: any, existingCapsules: any[]): any | null {
    // Simple matching logic - can be enhanced
    for (const capsule of existingCapsules) {
      // Match by participants and subject similarity
      const participantOverlap = thread.participants.some((p: string) =>
        capsule.participants?.some((cp: string) => p.includes(cp) || cp.includes(p))
      );

      const subjectSimilarity = capsule.primaryTopic &&
        thread.subject.toLowerCase().includes(capsule.primaryTopic.toLowerCase());

      if (participantOverlap || subjectSimilarity) {
        return capsule;
      }
    }
    return null;
  }

  /**
   * Create new capsule from thread
   */
  private async createNewCapsule(thread: any, config: EmailToCapsuleConfig): Promise<any> {
    // Process thread into structured document
    const processedThread = await this.emailService.processEmailThread(
      thread.messages,
      config.emailConfig.processingPrompt
    );

    // TODO: Integrate with your actual capsule creation API
    const capsule = await this.createCapsuleViaAPI(processedThread.document);

    console.log(`Created capsule ${capsule.id} for thread ${thread.id}`);
    return capsule;
  }

  /**
   * Update existing capsule with new thread data
   */
  private async updateExistingCapsule(
    existingCapsule: any,
    thread: any,
    config: EmailToCapsuleConfig
  ): Promise<any> {
    // Get latest message from thread
    const latestMessage = thread.messages[thread.messages.length - 1];

    // Update capsule document with new message
    const updatedResult = await this.emailService.updateCapsuleDocument(
      existingCapsule.id,
      latestMessage,
      existingCapsule.document,
      config.emailConfig.updatePrompt
    );

    // Replace document in capsule
    const updatedCapsule = await this.replaceCapsuleDocumentViaAPI(
      existingCapsule.id,
      updatedResult.updatedDocument
    );

    console.log(`Updated capsule ${existingCapsule.id} with thread ${thread.id}`);
    return updatedCapsule;
  }

  /**
   * Create capsule from individual email
   */
  private async createCapsuleFromEmail(email: any, config: EmailToCapsuleConfig): Promise<any> {
    // Process single email as a thread
    const processedEmail = await this.emailService.processEmailThread(
      [email],
      config.emailConfig.processingPrompt
    );

    const capsule = await this.createCapsuleViaAPI(processedEmail.document);
    console.log(`Created capsule ${capsule.id} for email ${email.id}`);
    return capsule;
  }

  /**
   * Update capsule with individual email
   */
  private async updateCapsuleWithEmail(emailResult: any, config: EmailToCapsuleConfig): Promise<any> {
    const { email, classification } = emailResult;
    const capsuleId = classification.matchingCapsuleId;

    // Get existing document
    const existingDocument = await this.getCapsuleDocumentViaAPI(capsuleId);

    // Update document
    const updatedResult = await this.emailService.updateCapsuleDocument(
      capsuleId,
      email,
      existingDocument,
      config.emailConfig.updatePrompt
    );

    // Replace document
    const updatedCapsule = await this.replaceCapsuleDocumentViaAPI(
      capsuleId,
      updatedResult.updatedDocument
    );

    console.log(`Updated capsule ${capsuleId} with email ${email.id}`);
    return updatedCapsule;
  }

  /**
   * Placeholder methods for capsule API integration
   * TODO: Replace with actual capsule API calls
   */
  private async createCapsuleViaAPI(document: any): Promise<any> {
    // TODO: Implement actual capsule creation
    console.log('Creating capsule via API:', document.id);
    return {
      id: `capsule_${Date.now()}`,
      document,
      created: new Date().toISOString()
    };
  }

  private async getCapsuleDocumentViaAPI(capsuleId: string): Promise<any> {
    // TODO: Implement actual capsule document retrieval
    console.log('Getting capsule document:', capsuleId);
    return {};
  }

  private async replaceCapsuleDocumentViaAPI(capsuleId: string, newDocument: any): Promise<any> {
    // TODO: Implement actual capsule document replacement
    console.log('Replacing capsule document:', capsuleId);
    return {
      id: capsuleId,
      document: newDocument,
      updated: new Date().toISOString()
    };
  }
}

// Convenience function for quick business email processing
export async function processBusinessEmailsLastMonth(
  userConnectionId: string,
  emailConfig: EmailPromptConfig,
  existingCapsules: any[] = []
): Promise<ProcessingResult> {
  const workflow = new EmailToCapsuleWorkflow();

  return await workflow.processEmailsToCapsules({
    userConnectionId,
    emailConfig,
    timeframe: 'last_30_days',
    userDomains: []
  }, existingCapsules);
}

// Export default workflow instance
export const emailToCapsuleWorkflow = new EmailToCapsuleWorkflow();