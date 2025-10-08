// Gmail Service - Frontend service for fetching Gmail data via Composio

const GMAIL_WORKER_URL = 'https://gmail-fetcher.shrinked.workers.dev'; // Update with actual worker URL

export interface GmailConnectionConfig {
  userConnectionId: string;
}

export interface EmailSearchQuery {
  searchQuery: string;
  timeframe?: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'last_6_months' | 'last_year';
  includeThreads?: boolean;
  maxResults?: number;
}

export interface GmailEmail {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body: { data?: string; size: number };
    parts?: any[];
  };
}

export interface GmailThread {
  id: string;
  historyId: string;
  messages: GmailEmail[];
}

export interface EmailFetchResult {
  success: boolean;
  emails: GmailEmail[];
  nextPageToken?: string;
  totalResults?: number;
  query: string;
  timestamp: string;
}

export interface ThreadFetchResult {
  success: boolean;
  threads: GmailThread[];
  nextPageToken?: string;
  totalResults?: number;
  query: string;
  timestamp: string;
}

export interface ThreadMessagesResult {
  success: boolean;
  threadId: string;
  messages: GmailEmail[];
  messageCount: number;
  timestamp: string;
}

export class GmailService {
  private workerUrl: string;
  private config: GmailConnectionConfig | null = null;

  constructor(workerUrl = GMAIL_WORKER_URL) {
    this.workerUrl = workerUrl;
  }

  // Set Gmail connection configuration
  setConnectionConfig(config: GmailConnectionConfig) {
    this.config = config;
  }

  // Test connection to Composio Gmail
  async testConnection(): Promise<any> {
    if (!this.config) {
      throw new Error('Gmail connection not configured. Call setConnectionConfig() first.');
    }

    try {
      const response = await fetch(`${this.workerUrl}/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userConnectionId: this.config.userConnectionId
        })
      });

      if (!response.ok) {
        throw new Error(`Connection test failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Gmail connection test error:', error);
      throw new Error(`Failed to test Gmail connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fetch emails with optional search query
  async fetchEmails(
    query = '',
    maxResults = 50,
    pageToken?: string
  ): Promise<EmailFetchResult> {
    if (!this.config) {
      throw new Error('Gmail connection not configured. Call setConnectionConfig() first.');
    }

    try {
      const response = await fetch(`${this.workerUrl}/fetch-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userConnectionId: this.config.userConnectionId,
          query,
          maxResults,
          pageToken
        })
      });

      if (!response.ok) {
        throw new Error(`Email fetch failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Gmail email fetch error:', error);
      throw new Error(`Failed to fetch emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fetch email threads
  async fetchThreads(
    query = '',
    maxResults = 25,
    pageToken?: string
  ): Promise<ThreadFetchResult> {
    if (!this.config) {
      throw new Error('Gmail connection not configured. Call setConnectionConfig() first.');
    }

    try {
      const response = await fetch(`${this.workerUrl}/fetch-threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userConnectionId: this.config.userConnectionId,
          query,
          maxResults,
          pageToken
        })
      });

      if (!response.ok) {
        throw new Error(`Thread fetch failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Gmail thread fetch error:', error);
      throw new Error(`Failed to fetch threads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fetch messages from a specific thread
  async fetchThreadMessages(threadId: string): Promise<ThreadMessagesResult> {
    if (!this.config) {
      throw new Error('Gmail connection not configured. Call setConnectionConfig() first.');
    }

    try {
      const response = await fetch(`${this.workerUrl}/fetch-thread-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userConnectionId: this.config.userConnectionId,
          threadId
        })
      });

      if (!response.ok) {
        throw new Error(`Thread messages fetch failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Gmail thread messages fetch error:', error);
      throw new Error(`Failed to fetch thread messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Advanced email search
  async searchEmails(searchConfig: EmailSearchQuery): Promise<any> {
    if (!this.config) {
      throw new Error('Gmail connection not configured. Call setConnectionConfig() first.');
    }

    try {
      const response = await fetch(`${this.workerUrl}/search-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userConnectionId: this.config.userConnectionId,
          searchQuery: searchConfig.searchQuery,
          timeframe: searchConfig.timeframe || 'last_30_days',
          includeThreads: searchConfig.includeThreads !== false,
          maxResults: searchConfig.maxResults || 50
        })
      });

      if (!response.ok) {
        throw new Error(`Email search failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Gmail search error:', error);
      throw new Error(`Failed to search emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fetch business emails for the last month
  async fetchBusinessEmails(timeframe = 'last_30_days'): Promise<any> {
    const businessQuery = {
      searchQuery: '(project OR client OR meeting OR deadline OR budget OR proposal OR contract) -in:spam -in:trash',
      timeframe: timeframe as any,
      includeThreads: true,
      maxResults: 100
    };

    return await this.searchEmails(businessQuery);
  }

  // Fetch investing/fundraising emails
  async fetchInvestingEmails(timeframe = 'last_30_days'): Promise<any> {
    const investingQuery = {
      searchQuery: '(funding OR investment OR round OR valuation OR "term sheet" OR "due diligence" OR investor OR VC OR "venture capital" OR angel OR LP OR GP OR portfolio OR board OR pitch OR deck OR "cap table" OR equity OR shares OR dilution OR liquidation OR exit OR IPO OR acquisition OR merger) -in:spam -in:trash',
      timeframe: timeframe as any,
      includeThreads: true,
      maxResults: 200
    };

    return await this.searchEmails(investingQuery);
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

// Utility functions for processing Gmail data

export function extractEmailHeaders(email: GmailEmail): Record<string, string> {
  const headers: Record<string, string> = {};
  if (email.payload?.headers) {
    for (const header of email.payload.headers) {
      headers[header.name.toLowerCase()] = header.value;
    }
  }
  return headers;
}

export function getEmailSubject(email: GmailEmail): string {
  const headers = extractEmailHeaders(email);
  return headers.subject || '(no subject)';
}

export function getEmailSender(email: GmailEmail): string {
  const headers = extractEmailHeaders(email);
  return headers.from || '(unknown sender)';
}

export function getEmailRecipients(email: GmailEmail): string {
  const headers = extractEmailHeaders(email);
  return headers.to || '(unknown recipients)';
}

export function getEmailDate(email: GmailEmail): Date {
  if (email.internalDate) {
    return new Date(parseInt(email.internalDate));
  }
  const headers = extractEmailHeaders(email);
  if (headers.date) {
    return new Date(headers.date);
  }
  return new Date();
}

export function decodeEmailBody(email: GmailEmail): string {
  try {
    // Simple base64 decode - Gmail API returns base64url encoded content
    if (email.payload?.body?.data) {
      // Replace URL-safe base64 characters
      const base64 = email.payload.body.data
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      // Add padding if needed
      const padded = base64 + '==='.slice(0, (4 - base64.length % 4) % 4);

      // Decode and return
      return atob(padded);
    }

    // Check for parts (multipart emails)
    if (email.payload?.parts) {
      for (const part of email.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          const base64 = part.body.data
            .replace(/-/g, '+')
            .replace(/_/g, '/');
          const padded = base64 + '==='.slice(0, (4 - base64.length % 4) % 4);
          return atob(padded);
        }
      }
    }

    return email.snippet || '';
  } catch (error) {
    console.error('Failed to decode email body:', error);
    return email.snippet || '';
  }
}

export function formatEmailForProcessing(email: GmailEmail) {
  return {
    id: email.id,
    threadId: email.threadId,
    subject: getEmailSubject(email),
    from: getEmailSender(email),
    to: getEmailRecipients(email),
    date: getEmailDate(email).toISOString(),
    content: decodeEmailBody(email),
    snippet: email.snippet,
    labels: email.labelIds || []
  };
}

export function formatThreadForProcessing(thread: GmailThread) {
  const messages = thread.messages.map(formatEmailForProcessing);

  // Sort messages chronologically
  messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    id: thread.id,
    messageCount: messages.length,
    messages: messages,
    subject: messages[0]?.subject || '(no subject)',
    participants: [...new Set([
      ...messages.map(m => m.from),
      ...messages.map(m => m.to)
    ])],
    dateRange: {
      start: messages[0]?.date,
      end: messages[messages.length - 1]?.date
    }
  };
}

// Default Gmail service instance
export const gmailService = new GmailService();