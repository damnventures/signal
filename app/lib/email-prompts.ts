// Email Processing Prompts - User configurable in the frontend

export const DEFAULT_FILTER_PROMPT = `You are an intelligent email classifier for business professionals. Analyze each email and decide how it should be processed.

CLASSIFICATION CRITERIA:

**business_thread** (High Priority - Create/Update Structured Conversations):
- Client communications and project discussions
- Team collaborations and decision-making threads
- Important vendor/partner negotiations
- Strategic planning discussions
- Contains keywords: project, client, meeting, deadline, budget, proposal, contract

**important_single** (Medium Priority - Individual Capsules):
- Company announcements and policy changes
- Meeting notes and summaries sent via email
- Reports, research, and documentation
- Important decisions communicated via email
- Legal/compliance notifications

**bulk_archive** (Low Priority - Searchable Storage):
- Newsletters and industry updates
- System notifications and alerts
- Calendar invites and scheduling emails
- Internal company updates
- Educational content and resources

**spam_filter** (Ignore):
- Marketing and promotional emails
- Automated notifications from apps/services
- Social media notifications
- Subscription confirmations
- Obvious spam and phishing attempts

MATCHING LOGIC:
- Check if email belongs to existing conversation thread by:
  1. Subject line similarity (RE:, FWD:, similar topics)
  2. Participant overlap (same people involved)
  3. Topic/keyword matching with existing capsules
  4. Time proximity to related discussions

DECISION PRIORITY:
1. If matches existing thread → update_existing
2. If important business topic → create_new
3. If valuable but standalone → archive
4. If promotional/spam → ignore

Consider sender domain, subject keywords, content type, and recipient list to make accurate classifications.`;

export const DEFAULT_PROCESSING_PROMPT = `You are an expert at structuring email conversations into organized, searchable documents. Create a comprehensive structured document from this email thread.

DOCUMENT STRUCTURE REQUIREMENTS:

**Metadata Extraction:**
- Identify all unique participants and their roles
- Determine primary topic/subject of conversation
- Extract date range and key timeline information
- Count total emails and identify conversation patterns

**Content Organization:**
- Group related discussions by topic/theme
- Identify key decisions made during the conversation
- Extract specific action items and commitments
- Note any deadlines, next steps, or follow-up requirements
- Preserve important details and context

**Topic Analysis:**
- Break down conversation into logical topic sections
- For each topic, provide current status and key points
- Reference which specific emails (by index) discuss each topic
- Identify any unresolved issues or pending decisions

**Summary Creation:**
- Write a comprehensive summary capturing the full conversation
- Highlight major decisions and outcomes
- Note any changes in direction or important developments
- Include relevant background context for future reference

**Markdown Formatting:**
- Create well-structured markdown for easy reading
- Use headers, bullet points, and formatting appropriately
- Include timestamps for key developments
- Make the document scannable and searchable

Focus on creating a document that someone could read to quickly understand the entire conversation context, current status, and what needs to happen next.`;

export const DEFAULT_UPDATE_PROMPT = `You are updating an existing structured email conversation document with a new email. Preserve all previous context while seamlessly integrating the new information.

UPDATE REQUIREMENTS:

**Context Preservation:**
- Maintain all existing summary information and context
- Preserve the chronological flow of the conversation
- Keep all previous decisions, action items, and next steps
- Update date ranges and email counts accurately

**New Content Integration:**
- Analyze the new email for relevant information
- Determine which existing topics it relates to
- Add new topics if the email introduces different subjects
- Update status of existing topics if new information changes them

**Change Detection:**
- Identify what new information the email provides
- Note any new decisions made or action items created
- Flag any changes to previous plans or timelines
- Detect new participants or changes in roles

**Document Updates:**
- Update the summary to include new developments
- Merge new content into appropriate topic sections
- Add new action items or update existing ones
- Refresh next steps based on latest email
- Extend markdown context with new information

**Consistency Maintenance:**
- Keep the same document ID and structure
- Maintain consistent formatting and organization
- Ensure all cross-references remain accurate
- Update metadata fields appropriately

Focus on creating a seamless update that makes the document current while preserving all valuable historical context.`;

// Business Email Processing Configuration
export const BUSINESS_EMAIL_CONFIG = {
  timeframes: {
    last_7_days: "after:" + getDateString(-7),
    last_30_days: "after:" + getDateString(-30),
    last_90_days: "after:" + getDateString(-90),
    last_6_months: "after:" + getDateString(-180),
    last_year: "after:" + getDateString(-365)
  },

  businessKeywords: [
    "project", "client", "meeting", "deadline", "budget", "proposal", "contract",
    "team", "decision", "approval", "review", "feedback", "strategy", "planning",
    "vendor", "partner", "negotiation", "agreement", "timeline", "deliverable"
  ],

  investingKeywords: [
    "funding", "investment", "round", "valuation", "term sheet", "due diligence",
    "investor", "VC", "venture capital", "angel", "LP", "GP", "portfolio", "board",
    "pitch", "deck", "cap table", "equity", "shares", "dilution", "liquidation",
    "exit", "IPO", "acquisition", "merger", "memo", "research", "analysis",
    "performance", "returns", "IRR", "multiple", "NAV", "distribution", "carry"
  ],

  excludeKeywords: [
    "unsubscribe", "newsletter", "promotion", "marketing", "sale", "offer",
    "social", "notification", "alert", "reminder", "automated", "no-reply"
  ],

  batchSizes: {
    email_classification: 50,
    thread_processing: 10,
    capsule_updates: 20
  }
};

// Utility function to get date string for Gmail queries
function getDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAgo);
  return date.toISOString().split('T')[0].replace(/-/g, '/');
}

// Generate Gmail search query for business emails
export function generateBusinessEmailQuery(timeframe = "last_30_days", userDomains: string[] = []): string {
  const dateFilter = BUSINESS_EMAIL_CONFIG.timeframes[timeframe as keyof typeof BUSINESS_EMAIL_CONFIG.timeframes];
  const keywordFilter = BUSINESS_EMAIL_CONFIG.businessKeywords
    .map(keyword => `"${keyword}"`)
    .join(" OR ");

  const excludeFilter = BUSINESS_EMAIL_CONFIG.excludeKeywords
    .map(keyword => `-"${keyword}"`)
    .join(" ");

  // Build query components
  const queryParts = [
    dateFilter,
    `(${keywordFilter})`,
    excludeFilter,
    "-in:spam",
    "-in:trash"
  ];

  // Add user-specific domain filters if provided
  if (userDomains.length > 0) {
    const domainFilter = userDomains
      .map(domain => `from:${domain} OR to:${domain}`)
      .join(" OR ");
    queryParts.push(`(${domainFilter})`);
  }

  return queryParts.filter(Boolean).join(" ");
}

// Generate Gmail search query for investing/fundraising emails
export function generateInvestingEmailQuery(timeframe = "last_30_days", userDomains: string[] = []): string {
  const dateFilter = BUSINESS_EMAIL_CONFIG.timeframes[timeframe as keyof typeof BUSINESS_EMAIL_CONFIG.timeframes];
  const keywordFilter = BUSINESS_EMAIL_CONFIG.investingKeywords
    .map(keyword => `"${keyword}"`)
    .join(" OR ");

  const excludeFilter = BUSINESS_EMAIL_CONFIG.excludeKeywords
    .map(keyword => `-"${keyword}"`)
    .join(" ");

  // Build query components
  const queryParts = [
    dateFilter,
    `(${keywordFilter})`,
    excludeFilter,
    "-in:spam",
    "-in:trash"
  ];

  // Add VC/investor domain patterns
  const investorDomains = [
    "from:*vc.com OR to:*vc.com",
    "from:*ventures.com OR to:*ventures.com",
    "from:*capital.com OR to:*capital.com",
    "from:*partners.com OR to:*partners.com"
  ];
  queryParts.push(`(${investorDomains.join(" OR ")})`);

  // Add user-specific domain filters if provided
  if (userDomains.length > 0) {
    const domainFilter = userDomains
      .map(domain => `from:${domain} OR to:${domain}`)
      .join(" OR ");
    queryParts.push(`(${domainFilter})`);
  }

  return queryParts.filter(Boolean).join(" ");
}

// Prompt configuration types
export interface EmailPromptConfig {
  filterPrompt: string;
  processingPrompt: string;
  updatePrompt: string;
  batchSize: number;
  minThreadSize: number;
}

// Example usage configurations
export const EXAMPLE_CONFIGURATIONS: Record<string, EmailPromptConfig> = {
  // Conservative business filtering
  conservative: {
    filterPrompt: DEFAULT_FILTER_PROMPT,
    processingPrompt: DEFAULT_PROCESSING_PROMPT,
    updatePrompt: DEFAULT_UPDATE_PROMPT,
    batchSize: 25,
    minThreadSize: 3 // Only process threads with 3+ emails
  },

  // Aggressive capture of all business content
  aggressive: {
    filterPrompt: DEFAULT_FILTER_PROMPT.replace("important business topic", "any business-related topic"),
    processingPrompt: DEFAULT_PROCESSING_PROMPT,
    updatePrompt: DEFAULT_UPDATE_PROMPT,
    batchSize: 50,
    minThreadSize: 1 // Process even single important emails
  },

  // Focus on client communications only
  client_focused: {
    filterPrompt: DEFAULT_FILTER_PROMPT + "\n\nPRIORITIZE: Only process emails involving external clients, customers, or prospects. Internal team discussions should be archived unless they involve client decisions.",
    processingPrompt: DEFAULT_PROCESSING_PROMPT + "\n\nFOCUS: Pay special attention to client requests, commitments made to clients, and client feedback.",
    updatePrompt: DEFAULT_UPDATE_PROMPT,
    batchSize: 30,
    minThreadSize: 2
  },

  // Investing & Startup Fundraising Focus
  investing_fundraising: {
    filterPrompt: `You are an intelligent email classifier specialized in INVESTING and STARTUP FUNDRAISING. Analyze each email to identify investment-related communications.

CLASSIFICATION CRITERIA:

**business_thread** (High Priority - Investment Conversations):
- Investor communications and pitch discussions
- Due diligence processes and data room access
- Term sheet negotiations and funding discussions
- Board communications and investor updates
- LP/GP communications and fund updates
- Deal flow and investment opportunity sharing
- Portfolio company updates and communications
- Keywords: funding, investment, round, valuation, term sheet, due diligence, investor, VC, angel, LP, GP, portfolio, board, pitch, deck, cap table, equity, shares, dilution, liquidation, exit, IPO, acquisition, merger

**important_single** (Medium Priority - Individual Investment Items):
- Investment memos and research reports
- Market analysis and industry insights
- Legal documents and compliance notifications
- Fund performance reports and statements
- Tax documents and K-1 statements
- Investment committee decisions
- Keywords: memo, research, analysis, performance, returns, IRR, multiple, NAV, distribution, carry, management fee

**bulk_archive** (Low Priority - Industry Information):
- Industry newsletters and market updates
- Conference invitations and event announcements
- Regulatory updates and compliance news
- Research reports from banks/analysts
- Educational content about investing

**spam_filter** (Ignore):
- Generic financial services marketing
- Crypto/trading platform promotions
- Get-rich-quick schemes
- Automated investment app notifications
- Social trading platforms

FUNDRAISING-SPECIFIC MATCHING:
- Match emails by fund name, company name, or deal name
- Group by investor relationships and ongoing processes
- Connect follow-up emails to original pitch/intro emails
- Link due diligence requests to specific opportunities
- Associate board emails with portfolio companies

DECISION PRIORITY FOR FUNDRAISING:
1. If part of active fundraising process → update_existing
2. If new investor introduction or opportunity → create_new
3. If industry insight but not actionable → archive
4. If promotional/spam → ignore`,

    processingPrompt: `You are an expert at structuring INVESTMENT and FUNDRAISING email conversations. Create comprehensive structured documents focused on investment activities.

INVESTMENT DOCUMENT STRUCTURE:

**Investment Metadata:**
- Identify all participants (investors, founders, intermediaries, advisors)
- Determine investment stage (pre-seed, seed, Series A/B/C, growth, etc.)
- Extract company/fund names and sectors
- Note investment amounts, valuations, and key terms
- Track timeline of fundraising/investment process

**Deal Flow Organization:**
- Group discussions by specific investment opportunities
- Track progression from initial interest to term sheet to closing
- Identify key concerns, questions, and resolution status
- Extract due diligence requirements and completion status
- Note any competitive dynamics or time pressures

**Investment Analysis:**
- Break down key investment thesis points
- Identify risk factors and mitigation strategies
- Extract financial projections and assumptions
- Note market size and competitive positioning
- Track changes in valuation or terms over time

**Action Items & Next Steps:**
- Extract specific due diligence tasks and deadlines
- Note document requests and data room access
- Identify required signatures or approvals
- Track follow-up meetings and presentations
- Note regulatory or legal requirements

**Financial Terms Tracking:**
- Capture valuations (pre/post money)
- Note liquidation preferences and participation rights
- Track board composition and governance terms
- Extract anti-dilution and voting provisions
- Note any special rights or preferences

Focus on creating a document that captures the complete investment story, current deal status, outstanding issues, and what needs to happen to move forward.`,

    updatePrompt: DEFAULT_UPDATE_PROMPT + "\n\nINVESTMENT FOCUS: Pay special attention to changes in deal terms, new due diligence findings, shifts in investor sentiment, or updates to timeline/process.",
    batchSize: 30,
    minThreadSize: 2
  }
};

// Email processing result types
export interface EmailClassificationResult {
  action: 'create_new' | 'update_existing' | 'archive' | 'ignore';
  type: 'business_thread' | 'important_single' | 'bulk_archive' | 'spam_filter';
  priority: 'high' | 'medium' | 'low';
  matchingCapsuleId: string | null;
  keywords: string[];
  reasoning: string;
  confidence: number;
}

export interface EmailProcessingResult {
  success: boolean;
  processed: number;
  results: Record<string, any[]>;
  summary: {
    create_new: number;
    update_existing: number;
    archive: number;
    ignore: number;
  };
}