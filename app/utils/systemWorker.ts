import { WorkerResponse, MediaCollectionData } from '../core/types';

// Use Next.js API proxy to avoid CORS issues
const PROXY_URL = '/api/tools';

export async function classifyIntent(input: string, capsuleId: string, context?: any): Promise<WorkerResponse> {
  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'classify', input, capsuleId, context })
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
  console.log('📍 Using API proxy:', PROXY_URL);
  console.log('🔗 URL to process:', url);
  console.log('📦 Capsule ID:', capsuleId);
  console.log('📝 Job Name:', jobName);
  console.log('🔑 API Key:', userApiKey ? `...${userApiKey.slice(-4)}` : 'No API key provided');
  
  const requestBody = { url, capsuleId, jobName, userApiKey };
  console.log('📤 Request body:', requestBody);
  
  try {
    console.log('📡 Making request via proxy...');
    console.log('🌐 Proxy URL:', PROXY_URL);
    const proxyBody = { action: 'process-media', ...requestBody };
    console.log('📤 Proxy request body:', proxyBody);
    
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proxyBody)
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
    
    // Include the job name in the result for polling purposes
    return {
      ...result,
      jobName: jobName, // Add the job name to the result for ToolProgress polling
      originalParams: { url, capsuleId, jobName, userApiKey } // Include original params as backup
    };
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
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'communicate', message, capsuleId, context })
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
  
  // Check for login intent
  const loginWords = ['login', 'signin', 'sign in', 'log in', 'authenticate', 'auth', 'invite', 'invitation', 'access', 'get in'];
  if (loginWords.some(word => input.toLowerCase().includes(word))) {
    return {
      intent: 'login',
      action: 'show_login',
      confidence: 0.8,
      data: { message: input },
      requiresConfirmation: false
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