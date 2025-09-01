'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToolState, generateToolId } from '../core/toolState';
import { classifyIntent } from '../utils/systemWorker';
import { ToolExecution, ToolConfirmation, MediaCollectionData } from '../core/types';
import { getCommunicatePrompt } from './CommunicatePrompt';
// MediaCollectorConfirmation removed - auto-processing enabled
import ToolProgress from './ToolProgress';

interface ToolCoreProps {
  capsuleId: string;
  onArgueRequest: (question: string) => void;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  onRefreshCapsule?: () => void;
  onShowResponse?: (message: string) => void;
}

const ToolCore: React.FC<ToolCoreProps> = ({ 
  capsuleId, 
  onArgueRequest, 
  onBringToFront, 
  initialZIndex,
  onRefreshCapsule,
  onShowResponse
}) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { apiKey } = useAuth();
  
  const {
    pendingConfirmations,
    executions,
    addConfirmation,
    removeConfirmation,
    addExecution,
    updateExecution,
    getActiveExecutions
  } = useToolState();

  const handleUserInput = useCallback(async (userInput: string) => {
    if (!userInput.trim()) return;
    
    setIsProcessing(true);
    
    try {
      const classification = await classifyIntent(userInput, capsuleId);
      
      switch (classification.intent) {
        case 'tool':
          if (classification.action === 'collect_media') {
            await handleMediaCollection(classification.data, userInput);
          }
          break;
          
        case 'argue':
          onArgueRequest(classification.data.question);
          break;
          
        case 'communicate':
          // Handle general communication with Cloudflare worker
          await handleCommunication(classification.data.message);
          break;
          
        case 'login':
          // Handle login intent
          await handleLogin();
          break;
      }
    } catch (error) {
      console.error('Failed to process input:', error);
    } finally {
      setIsProcessing(false);
      setInput('');
    }
  }, [capsuleId, onArgueRequest]);

  const handleCommunication = useCallback(async (message: string) => {
    try {
      console.log('[ToolCore] Handling communication:', message);
      
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(apiKey && { 'x-api-key': apiKey })
        },
        body: JSON.stringify({ 
          action: 'communicate', 
          message,
          capsuleId,
          systemPrompt: getCommunicatePrompt()
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[ToolCore] Communication response:', result);
        
        if (onShowResponse && result.response) {
          onShowResponse(result.response);
        }
      } else {
        console.error('[ToolCore] Communication failed:', response.status);
        if (onShowResponse) {
          onShowResponse("I'm having trouble responding right now. Please try again.");
        }
      }
    } catch (error) {
      console.error('[ToolCore] Communication error:', error);
      if (onShowResponse) {
        onShowResponse("I encountered an error. Please try again.");
      }
    }
  }, [capsuleId, apiKey, onShowResponse]);

  const handleLogin = useCallback(async () => {
    try {
      console.log('[ToolCore] Handling login intent');
      
      // Use the same login logic as AuthContext
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.shrinked.ai';
      const redirectUrl = `${window.location.origin}/api/auth/callback`;
      const state = encodeURIComponent(window.location.origin);
      const loginUrl = `${baseUrl}/auth/google?redirect_uri=${encodeURIComponent(redirectUrl)}&state=${state}`;
      
      if (onShowResponse) {
        onShowResponse(`👋 Ready to login! <a href="${loginUrl}" style="color: #007AFF; text-decoration: underline;">Click here to sign in with Google</a> or I'll open it for you in 2 seconds.`);
      }
      
      // Store origin for proper redirect handling
      try {
        document.cookie = `auth_redirect_origin=${encodeURIComponent(window.location.origin)}; domain=.shrinked.ai; path=/; max-age=600; SameSite=Lax`;
      } catch (e) {
        console.warn('Failed to set cross-domain cookie:', e);
      }
      localStorage.setItem('auth_redirect_origin', window.location.origin);
      
      // Open login after showing message
      setTimeout(() => {
        window.open(loginUrl, '_blank');
      }, 2000);
      
    } catch (error) {
      console.error('[ToolCore] Login error:', error);
      if (onShowResponse) {
        onShowResponse("Something went wrong with login setup. Try the login button in the top-right corner.");
      }
    }
  }, [onShowResponse]);

  const generateJobTitle = useCallback((urls: string[], originalInput: string) => {
    // Extract domain and clean up the title
    if (urls.length === 1) {
      const url = urls[0];
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const match = url.match(/[?&]v=([^&]*)|youtu\.be\/([^?&]*)/);
        if (match) {
          return `YouTube_${match[1] || match[2]}_${Date.now()}`;
        }
        return `YouTube_Video_${Date.now()}`;
      } else if (url.includes('tiktok.com')) {
        return `TikTok_Video_${Date.now()}`;
      } else if (url.includes('twitter.com') || url.includes('x.com')) {
        return `Twitter_Post_${Date.now()}`;
      }
    }
    
    // Multiple URLs or generic
    const platform = urls[0]?.includes('youtube') ? 'YouTube' : 
                    urls[0]?.includes('tiktok') ? 'TikTok' : 
                    urls[0]?.includes('twitter') || urls[0]?.includes('x.com') ? 'Twitter' : 'Media';
    
    return `${platform}_Collection_${Date.now()}`;
  }, []);

  const handleMediaCollection = useCallback(async (data: MediaCollectionData, originalInput: string) => {
    console.log('🎬 Media Collection Started:', data);
    
    // Generate a clean job title
    const jobTitle = generateJobTitle(data.urls, originalInput);
    console.log('📝 Generated Job Title:', jobTitle);
    
    // Auto-process with default settings - no confirmation needed
    const executionId = generateToolId();
    const processData = {
      ...data,
      capsuleId,
      jobName: jobTitle,
      outputFormat: 'mp3', // Default to audio
      originalInput
    };
    
    const execution: ToolExecution = {
      id: executionId,
      toolId: 'media-collector',
      status: 'pending',
      input: processData,
      createdAt: new Date()
    };
    
    console.log('🚀 Starting media processing with data:', processData);
    addExecution(execution);
    await executeMediaCollection(executionId, processData);
  }, [capsuleId, addExecution, generateJobTitle]);

  const executeMediaCollection = useCallback(async (executionId: string, data: any) => {
    updateExecution(executionId, { status: 'processing', progress: 0 });
    console.log('🔄 Starting media collection execution for:', executionId);
    
    try {
      const { processMediaWithWorker } = await import('../utils/systemWorker');
      const processedJobs = [];
      
      for (let i = 0; i < data.urls.length; i++) {
        const url = data.urls[i];
        const currentJobName = data.urls.length > 1 ? `${data.jobName}_Part${i + 1}` : data.jobName;
        
        console.log(`📤 Processing URL ${i + 1}/${data.urls.length}:`, url);
        console.log(`📝 Job Name:`, currentJobName);
        console.log(`🎯 Capsule ID:`, data.capsuleId);
        console.log(`🔑 API Key:`, apiKey ? `...${apiKey.slice(-4)}` : 'No API key');
        
        updateExecution(executionId, { 
          progress: (i / data.urls.length) * 90, // Leave 10% for completion
          result: { currentUrl: url, currentJobName }
        });
        
        const result = await processMediaWithWorker(
          url,
          data.capsuleId,
          currentJobName,
          apiKey || ''
        );
        
        console.log(`📥 Response for ${url}:`, result);
        
        if (result.error) {
          console.error(`❌ Error processing ${url}:`, result.error);
          throw new Error(`Failed to process ${url}: ${result.error}`);
        }
        
        processedJobs.push({
          url,
          jobName: currentJobName,
          result
        });
        
        console.log(`✅ Successfully processed ${url}`);
      }
      
      console.log('🎉 All media files processed successfully:', processedJobs);
      
      updateExecution(executionId, {
        status: 'completed',
        progress: 100,
        result: { 
          message: `Successfully processed ${data.urls.length} media files`,
          jobs: processedJobs
        },
        completedAt: new Date()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Media collection failed:', errorMessage);
      
      updateExecution(executionId, {
        status: 'error',
        error: errorMessage,
        completedAt: new Date()
      });
    }
  }, [apiKey, updateExecution]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUserInput(input);
  };

  const activeExecutions = getActiveExecutions();

  return (
    <>
      {/* Bottom Left Search Bar */}
      <div 
        className="tool-core-search-bar"
        style={{
          position: 'fixed',
          bottom: '25px', // Slightly higher to align center with right menu buttons (30px height)
          left: '20px',
          width: '66.67%', // 2/3 of screen width
          zIndex: 1000,
        }}
      >
        <form onSubmit={handleSubmit} style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Drop a link, ask a question, or just chat..."
              style={{
                flex: 1,
                padding: '4px',
                border: '2px inset #c0c0c0',
                background: 'white',
                fontSize: '12px',
                fontFamily: 'Geneva, sans-serif',
                color: 'black',
              }}
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={isProcessing || !input.trim()}
              style={{
                padding: '4px 8px',
                background: isProcessing || !input.trim() ? '#d0d0d0' : '#c0c0c0',
                border: '2px solid #000000',
                boxShadow: '2px 2px 0px #808080, 4px 4px 0px #404040',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: isProcessing || !input.trim() ? 'default' : 'pointer',
                color: isProcessing || !input.trim() ? '#808080' : 'black',
                fontFamily: 'Geneva, sans-serif',
              }}
            >
              {isProcessing ? 'Processing...' : 'Send'}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmations removed - auto-processing enabled */}

      {/* Active Executions */}
      {activeExecutions.map(execution => (
        <ToolProgress
          key={execution.id}
          execution={execution}
          onBringToFront={onBringToFront}
          initialZIndex={initialZIndex + 200}
          onRefreshCapsule={onRefreshCapsule}
        />
      ))}
    </>
  );
};

export default ToolCore;