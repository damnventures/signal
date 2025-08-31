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
  intent: 'tool' | 'argue' | 'communicate';
  action: string;
  confidence: number;
  data: any;
  requiresConfirmation: boolean;
}

export interface MediaCollectionData {
  urls: string[];
  platforms: string[];
  suggestedFormat: 'mp3' | 'mp4';
  capsuleId: string;
  jobName?: string;
}

export enum IntentType {
  COLLECT = 'tool',
  ARGUE = 'argue', 
  COMMUNICATE = 'communicate'
}