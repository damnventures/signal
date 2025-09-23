 'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToolState, generateToolId } from '../core/toolState';
import { classifyIntent } from '../utils/systemWorker';
import { ToolExecution, ToolConfirmation, MediaCollectionData } from '../core/types';
import { getCommunicatePrompt } from './CommunicatePrompt';
import { BouncerState } from '../core/types';
// MediaCollectorConfirmation removed - auto-processing enabled
import ToolProgress from './ToolProgress';

interface ToolCoreProps {
  capsuleId: string;
  capsuleName?: string;
  onArgueRequest: (question: string) => void;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  onRefreshCapsule?: () => void;
  onRefreshWrap?: () => void;
  onShowResponse?: (message: string) => void;
  onStartThinking?: () => void;
  onStopThinking?: () => void;
  onStartDemo?: () => void;
  onShowDemoWelcomeCard?: () => void;
  onDemoRequest?: (message: string) => void;
}

const ToolCore: React.FC<ToolCoreProps> = ({
  capsuleId,
  capsuleName,
  onArgueRequest,
  onBringToFront,
  initialZIndex,
  onRefreshCapsule,
  onRefreshWrap,
  onShowResponse,
  onStartThinking,
  onStopThinking,
  onStartDemo,
  onShowDemoWelcomeCard,
  onDemoRequest
}) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bouncerState, setBouncerState] = useState<BouncerState | null>(null);
  const [awaitingEmail, setAwaitingEmail] = useState(false);
  const { apiKey, user } = useAuth();
  
  const {
    pendingConfirmations,
    executions,
    addConfirmation,
    removeConfirmation,
    addExecution,
    updateExecution,
    getActiveExecutions
  } = useToolState();

  // Helper function to create contextual communication messages
  const createContextualMessage = useCallback((intent: string, action: string, originalInput: string, data: any) => {
    const capsuleRef = capsuleName ? `"${capsuleName}"` : 'selected capsule';
    
    switch (intent) {
      case 'tool':
        if (action === 'collect_media') {
          const urlCount = data.urls?.length || 0;
          const platforms = data.platforms?.join(', ') || 'media';
          return `Processing ${urlCount} ${platforms} ${urlCount === 1 ? 'link' : 'links'} into ${capsuleRef}. ${originalInput}`;
        }
        break;
      case 'argue':
        return `Starting argument session with ${capsuleRef} content. ${originalInput}`;
      case 'login':
        return originalInput; // Keep login messages as-is
      default:
        return originalInput;
    }
    return originalInput;
  }, [capsuleName]);

  const handleUserInput = useCallback(async (userInput: string) => {
    if (!userInput.trim()) return;

    
    
    setIsProcessing(true);
    
    // Start thinking state in status line
    if (onStartThinking) {
      onStartThinking();
    }
    
    // Show loading animation in header immediately
    if (onShowResponse) {
      // Start with basic loading message, the dots will be animated via CSS
      onShowResponse('<span style="opacity: 0.7; font-style: italic;" class="thinking-indicator">thinking<span class="loading-dots">...</span></span>');
    }
    
    try {
      // Check if we're in a special state first
      if (awaitingEmail) {
        // User is providing their email
        const potentialEmail = userInput.trim().replace(/\s/g, '');
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
        
        if (emailRegex.test(potentialEmail)) {
          handleEmailCheck(potentialEmail);
        } else {
          if (onShowResponse) {
            onShowResponse?.("That doesn't look like an email address. Try again with your email (e.g., user@example.com).");
          }
        }
        return;
      }
  
      if (bouncerState && bouncerState.isActive) {
        // User is in bouncer conversation
        handleBouncerConversation(userInput);
        return;
      }
  
      // MAIN CLASSIFICATION FLOW - this is where tools + communication happen
      console.log('[ToolCore] Starting classification for:', userInput);
      const classification = await classifyIntent(userInput, capsuleId);
      console.log('[ToolCore] Classification result:', classification);
      
      const contextualMessage = createContextualMessage(
        classification.intent, 
        classification.action, 
        userInput, 
        classification.data
      );
      
      // CRITICAL: Handle each intent type properly
      switch (classification.intent) {
        case 'tool':
          if (classification.action === 'collect_media') {
            console.log('[ToolCore] Media collection intent detected');
            
            // 1. Show launch message (communication response)
            if (onShowResponse && classification.launchMessage) {
              console.log('[ToolCore] Showing launch message:', classification.launchMessage);
              onShowResponse(classification.launchMessage);
            }
            
            // 2. Launch the media collection tool (tool execution)
            console.log('[ToolCore] Starting media collection tool');
            await handleMediaCollection(classification.data, userInput);
          }
          break;
          
        case 'argue':
          console.log('[ToolCore] Argue intent detected');

          if (!user && !apiKey) {
            console.log('[ToolCore] Non-authenticated user, starting demo for argue');
            if (onStartDemo) {
              onStartDemo();
            }
          }
          
          // 1. Show launch message (communication response)
          if (onShowResponse && classification.launchMessage) {
            console.log('[ToolCore] Showing argue launch message:', classification.launchMessage);
            onShowResponse(classification.launchMessage);
          }
          
          // 2. Launch the argue popup (tool execution)
          console.log('[ToolCore] Opening argue popup');
          onArgueRequest(classification.data.question);
          break;
          
        case 'login':
          console.log('[ToolCore] Login intent detected');
          
          // 1. Show launch message (communication response)
          if (onShowResponse) {
            const message = classification.launchMessage || 
              (user ? "You're already authenticated. Let me refresh your session anyway." :
               "Time to get you logged in. Let me check your email and see if you're worthy of Craig access.");
            console.log('[ToolCore] Showing login launch message:', message);
            onShowResponse(message);
          }
          
          // 2. Handle login process (tool execution)
          console.log('[ToolCore] Starting login process');
          await handleLogin();
          break;
          
        case 'demo':
          console.log('[ToolCore] Demo intent detected');

          // Check if user is authenticated - they shouldn't need a demo
          if (user || apiKey) {
            console.log('[ToolCore] Authenticated user requesting demo - showing sassy rejection');
            const sassyMessages = [
              "Demo? Really? You're already logged in and have access to everything. Maybe try actually using it instead of asking for a preview?",
              "You want a demo when you literally have the full version? That's like asking for a trailer when you already own the movie.",
              "Demo mode is for peasants. You have full access - use it like the power user you pretend to be.",
              "Seriously? You're authenticated and asking for a demo? Just dive in and use your actual capsules instead of playing tourist.",
              "Demo? Nah. You've got the real deal. Stop window shopping and start actually working with your content."
            ];
            const randomMessage = sassyMessages[Math.floor(Math.random() * sassyMessages.length)];
            if (onShowResponse) {
              onShowResponse(randomMessage);
            }
            break;
          }

          // 1. Start the demo FIRST to set capsule ID (tool execution - loads demo content)
          console.log('[ToolCore] Starting demo');
          if (onStartDemo) {
            onStartDemo();
          }

          // 2. Show demo message in header window (same flow as other intents)
          if (onShowResponse && classification.launchMessage) {
            console.log('[ToolCore] Showing demo launch message in header:', classification.launchMessage);
            onShowResponse(classification.launchMessage);
          }

          // 3. Show demo welcome window with Vanya's context
          if (onShowDemoWelcomeCard) {
            console.log('[ToolCore] Showing demo welcome window for context');
            onShowDemoWelcomeCard();
          }
          break;
          
        case 'communicate':
          console.log('[ToolCore] Communication intent detected');
          
          // This is PURE communication - no tool launch, just AI response
          await handleCommunication(classification.data.message);
          break;
          
        default:
          console.warn('[ToolCore] Unknown intent:', classification.intent);
          // Fallback to communication
          await handleCommunication(userInput);
          break;
      }
      
    } catch (error) {
      console.error('[ToolCore] Failed to process input:', error);
      if (onShowResponse) {
        onShowResponse?.("Something went wrong processing that. Try again or be more specific.");
      }
    } finally {
      setIsProcessing(false);
      setInput('');
      
      // Stop thinking state in status line
      if (onStopThinking) {
        onStopThinking();
      }
    }
  }, [capsuleId, onArgueRequest, createContextualMessage, awaitingEmail, bouncerState, user, onStartDemo]);
  
  // This function should handle PURE communication (no tool launch)
  const handleCommunication = useCallback(async (message: string) => {
    try {
      console.log('[ToolCore] Handling pure communication:', message);
      
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
        
        if (onShowResponse && 'response' in result) {
          let cleanResponse = result.response;
          if (typeof cleanResponse === 'string') {
            // Remove <think>...</think> blocks but preserve other content (improved cleaning)
            const originalLength = cleanResponse.length;
            
            // Handle complete <think>...</think> blocks
            const completeThinkRegex = /<think>[\s\S]*?<\/think>/gi;
            cleanResponse = cleanResponse.replace(completeThinkRegex, '').trim();
            
            // Handle unclosed <think> tags (remove everything from <think> to end)
            const openThinkRegex = /<think>[\s\S]*$/gi;
            cleanResponse = cleanResponse.replace(openThinkRegex, '').trim();
            
            // Handle orphaned </think> tags
            cleanResponse = cleanResponse.replace(/<\/think>/gi, '').trim();
            
            console.log(`[ToolCore] Cleaned communication response: ${originalLength} -> ${cleanResponse.length} chars:`, cleanResponse.substring(0, 100));
          }
          
          if (cleanResponse && cleanResponse.length > 0) {
            onShowResponse(cleanResponse);
          } else {
            console.warn('[ToolCore] Communication response became empty after cleaning');
            // Try to extract content before <think> tags
            const beforeThink = result.response.split('<think>')[0].trim();
            if (beforeThink && beforeThink.length > 10) {
              onShowResponse(beforeThink);
            } else {
              // More sassy responses when AI gives unusable output
              const sassyFallbacks = [
                "I started overthinking that response. Can you rephrase your question?",
                "The AI just gave me complete garbage. Try being more specific about what you actually want.",
                "Something broke in my brain processing that. Want to try again with clearer language?",
                "That question made my circuits short out. Mind rephrasing it so I don't have an aneurysm?"
              ];
              const randomResponse = sassyFallbacks[Math.floor(Math.random() * sassyFallbacks.length)];
              onShowResponse?.(randomResponse);
            }
          }
        }
      } else {
        console.error('[ToolCore] Communication failed:', response.status);
        onShowResponse?.("I'm having trouble responding right now. Please try again.");
      }
    } catch (error) {
      console.error('[ToolCore] Communication error:', error);
      onShowResponse?.("I encountered an error. Please try again.");
    }
  }, [capsuleId, apiKey, onShowResponse]);

  const handleEmailCheck = useCallback(async (email: string) => {
    try {
      console.log('[ToolCore] Checking email in database:', email);
      
      const response = await fetch('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error(`Email check failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('[ToolCore] Email check result:', result);

      if (result.found) {
        // Email found in DB - proceed with normal login
        await handleDirectLogin();
      } else {
        // Email NOT found - activate bouncer mode
        await activateBouncer(email);
      }
    } catch (error) {
      console.error('[ToolCore] Email check error:', error);
      if (onShowResponse) {
        onShowResponse?.("Something went wrong checking your email. Please try again.");
      }
    }
  }, [onShowResponse]);

  const activateBouncer = useCallback(async (email: string) => {
    const initialBouncerState: BouncerState = {
      stage: 1,
      attempts: 0,
      userResponses: [],
      bouncerPersonality: 'sassy',
      email,
      isActive: true
    };

    setBouncerState(initialBouncerState);
    setAwaitingEmail(false);

    // Generate varied initial messages based on email or random selection
    const initialMessages = [
      "Oh great, another one who thinks they deserve Craig access. What makes YOU special, exactly?",
      "Let me guess... you're 'different' and 'really need access', right? Prove it.",
      "Another hopeful soul at my digital doorstep. You're going to have to do better than just showing up.",
      "Well, well, well... what do we have here? Another wannabe Craig user. Impress me.",
      "You want in? This isn't some open house. Tell me why you're worth my time.",
      "Here we go again... another person who thinks they deserve VIP access. Make your case."
    ];
    
    const randomMessage = initialMessages[Math.floor(Math.random() * initialMessages.length)];

    if (onShowResponse) {
      onShowResponse(randomMessage);
    }
  }, [onShowResponse]);

  const handleBouncerConversation = useCallback(async (message: string) => {
    if (!bouncerState) return;

    try {
      console.log('[ToolCore] Handling bouncer conversation:', message);
      
      // Add user message to bouncer state history
      const updatedBouncerState = {
        ...bouncerState,
        attempts: bouncerState.attempts + 1,
        userResponses: [...bouncerState.userResponses, message]
      };
      
      const response = await fetch('/api/bouncer', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(apiKey && { 'x-api-key': apiKey })
        },
        body: JSON.stringify({ 
          message,
          bouncerState: updatedBouncerState,
          capsuleName: capsuleName || 'selected capsule',
          userApiKey: apiKey
        })
      });

      if (!response.ok) {
        throw new Error(`Bouncer conversation failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('[ToolCore] Bouncer response:', result);

      // Update bouncer state
      if (result.newBouncerState) {
        setBouncerState(result.newBouncerState);
      }

      // Show bouncer response
      if (onShowResponse && result.bouncerResponse) {
        onShowResponse(result.bouncerResponse);
      }

      // Check if login should proceed
      if (result.shouldLogin) {
        console.log('[ToolCore] Bouncer approved login!');
        setBouncerState(null); // Clear bouncer state
        setTimeout(() => {
          handleDirectLogin();
        }, 2000); // Give user time to read victory message
      }

    } catch (error) {
      console.error('[ToolCore] Bouncer conversation error:', error);
      if (onShowResponse) {
        onShowResponse?.("The bouncer seems to have lost their voice. Try again.");
      }
    }
  }, [bouncerState, capsuleName, apiKey, onShowResponse]);

  const handleDirectLogin = useCallback(async () => {
    try {
      console.log('[ToolCore] Handling direct login');
      
      // Use the same login logic as AuthContext
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.shrinked.ai';
      const redirectUrl = `${window.location.origin}/api/auth/callback`;
      const state = encodeURIComponent(window.location.origin);
      const loginUrl = `${baseUrl}/auth/google?redirect_uri=${encodeURIComponent(redirectUrl)}&state=${state}`;
      
      if (onShowResponse) {
        onShowResponse(`Ready to login! <a href="${loginUrl}" style="color: #007AFF; text-decoration: underline;">Click here to sign in with Google</a> or I'll open it for you in 2 seconds.`);
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
        onShowResponse?.("Something went wrong with login setup. Try the login button in the top-right corner.");
      }
    }
  }, [onShowResponse]);

  const handleLogin = useCallback(async () => {
    // If user is authenticated, just proceed with login
    if (user) {
      await handleDirectLogin();
      return;
    }

    // For non-authenticated users, ask for their email to start the bouncer/login flow.
    setAwaitingEmail(true);
    if (onShowResponse) {
      onShowResponse?.("What's your email address? I'll check if you have access.");
    }
  }, [user, handleDirectLogin, onShowResponse]);

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
      >
        <form onSubmit={handleSubmit}>
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
          onRefreshWrap={onRefreshWrap}
          capsuleName={capsuleName}
        />
      ))}
    </>
  );
};

export default ToolCore;