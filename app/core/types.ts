export interface ToolExecution {
  id: string;
  toolId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  input: any;
  result?: any;
  error?: string;
  progress?: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface ToolConfirmation {
  id: string;
  toolId: string;
  action: string;
  data: any;
  requiresConfirmation: boolean;
  onConfirm: (confirmed: boolean, modifiedData?: any) => Promise<void>;
}

export interface WorkerResponse {
  intent: 'tool' | 'argue' | 'communicate' | 'login' | 'demo';
  action: string;
  confidence: number;
  data: any;
  requiresConfirmation: boolean;
  launchMessage?: string;
}

export interface MediaCollectionData {
  urls: string[];
  platforms: string[];
  suggestedFormat: 'mp3' | 'mp4';
  capsuleId: string;
  jobName?: string;
}

export interface BouncerState {
  stage: 1 | 2 | 3 | 4 | 5;
  attempts: number;
  userResponses: string[];
  bouncerPersonality: 'sassy' | 'impressed' | 'annoyed' | 'warming' | 'victory';
  email: string;
  isActive: boolean;
}

export enum IntentType {
  COLLECT = 'tool',
  ARGUE = 'argue', 
  COMMUNICATE = 'communicate',
  LOGIN = 'login'
}