import { WorkerResponse, MediaCollectionData } from '../core/types';

const WORKER_URL = process.env.NEXT_PUBLIC_SYSTEM_WORKER_URL || 'https://chars-intent-core.shrinked.workers.dev';

export async function classifyIntent(input: string, capsuleId: string, context?: any): Promise<WorkerResponse> {
  try {
    const response = await fetch(`${WORKER_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, capsuleId, context })
    });
    
    if (!response.ok) {
      throw new Error(`Worker classification failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Intent classification error:', error);
    // Fallback to local classification
    return fallbackClassification(input);
  }
}

export async function processMediaWithWorker(
  url: string, 
  capsuleId: string, 
  jobName: string, 
  userApiKey: string
) {
  console.log('🚀 SystemWorker: Starting media processing');
  console.log('📍 Worker URL:', WORKER_URL);
  console.log('🔗 URL to process:', url);
  console.log('📦 Capsule ID:', capsuleId);
  console.log('📝 Job Name:', jobName);
  console.log('🔑 API Key:', userApiKey ? `...${userApiKey.slice(-4)}` : 'No API key provided');
  
  const requestBody = { url, capsuleId, jobName, userApiKey };
  console.log('📤 Request body:', requestBody);
  
  try {
    console.log('📡 Making request to worker...');
    const response = await fetch(`${WORKER_URL}/process-media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    console.log('📥 Worker response status:', response.status);
    console.log('📥 Worker response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Worker error response:', errorText);
      throw new Error(`Media processing failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Worker success response:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Media processing error:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

export async function communicateWithWorker(message: string, capsuleId: string, context?: any) {
  try {
    const response = await fetch(`${WORKER_URL}/communicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, capsuleId, context })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Communication error:', error);
    return { response: 'Sorry, I couldn\'t process that request.' };
  }
}

// Fallback classification for when worker is unavailable
function fallbackClassification(input: string): WorkerResponse {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = input.match(urlRegex) || [];
  
  if (urls.length > 0) {
    return {
      intent: 'tool',
      action: 'collect_media',
      confidence: 0.7,
      data: { urls, platforms: ['Unknown'], suggestedFormat: 'mp3' },
      requiresConfirmation: true
    };
  }
  
  const questionWords = ['what', 'why', 'how', 'argue', 'think'];
  if (questionWords.some(word => input.toLowerCase().includes(word))) {
    return {
      intent: 'argue',
      action: 'open_argue_popup',
      confidence: 0.6,
      data: { question: input },
      requiresConfirmation: false
    };
  }
  
  return {
    intent: 'communicate',
    action: 'general_response',
    confidence: 0.5,
    data: { message: input },
    requiresConfirmation: false
  };
}