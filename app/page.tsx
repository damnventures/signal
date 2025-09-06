"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import DraggableWindow from './components/DraggableWindow';
import AnimatedHeader from './components/AnimatedHeader';
import Head from 'next/head';
import ArguePopup from './components/ArguePopup';
import ToolCore from './components/ToolCore';
import AuthRedirectHandler from './components/AuthRedirectHandler';
import { useAuth } from './contexts/AuthContext';
import CapsulesWindow, { Capsule } from './components/CapsulesWindow';
import { createAuthFetch } from './utils/authFetch';
import DemoWelcomeWindow from './components/DemoWelcomeWindow';
import WrapTool from './components/WrapTool';

interface Highlight {
  title: string;
  setup: string;
  quote: string;
  whyItMatters: string;
  isCapsuleSummary?: boolean;
}

const HomePage = () => {
  const { user, accessToken, apiKey, setUserData, isLoading, logout, refreshToken, refreshTokenIfNeeded } = useAuth();
  const authFetch = useMemo(() => createAuthFetch(refreshTokenIfNeeded), [refreshTokenIfNeeded]);
  const [capsuleContent, setCapsuleContent] = useState<string>("");
  const [highlightsData, setHighlightsData] = useState<Highlight[]>([]);
  const [cardZIndexes, setCardZIndexes] = useState<Record<string, number>>({});
  const [nextZIndex, setNextZIndex] = useState(1);
  const [fetchedOriginalLinks, setFetchedOriginalLinks] = useState<string[]>([]);
  const playerRefs = useRef<Record<string, YT.Player | null>>({});
  const [isClient, setIsClient] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [showCards, setShowCards] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [highlightCard, setHighlightCard] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<Record<string, boolean>>({});
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState<'signal' | 'insights' | 'idle'>('signal');
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showArguePopup, setShowArguePopup] = useState(false);
  const [argueQuestion, setArgueQuestion] = useState('');
  const [headerResponseMessage, setHeaderResponseMessage] = useState<string>('');
  const [authProcessed, setAuthProcessed] = useState(false);
  const [authInProgress, setAuthInProgress] = useState(false);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [showCapsulesWindow, setShowCapsulesWindow] = useState(false);
  const [selectedCapsuleId, setSelectedCapsuleId] = useState<string | null>(null);
  const [isFetchingCapsuleContent, setIsFetchingCapsuleContent] = useState(false);
  const [isFetchingCapsules, setIsFetchingCapsules] = useState(false);
  const [hasHeaderCompleted, setHasHeaderCompleted] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [showDemoWelcomeWindow, setShowDemoWelcomeWindow] = useState(false);
  const [wrapStateHash, setWrapStateHash] = useState<string>('');
  const [lastWrapSummary, setLastWrapSummary] = useState<string>('');
  const wrapCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startDemo = useCallback(() => {
    setShowDemo(true);
    const defaultCapsuleId = '6887e02fa01e2f4073d3bb51';
    setSelectedCapsuleId(defaultCapsuleId);
    setHasHeaderCompleted(false); // Reset header completed state
  }, []);

  const fetchWrapSummary = useCallback(async (userProfile: any, hasAuth: boolean = true): Promise<string> => {
    // For non-authenticated users, always return simple welcome
    if (!hasAuth || !userProfile || (!accessToken && !apiKey)) {
      return `Welcome ${userProfile?.email || userProfile?.username || 'User'}!`;
    }

    try {
      console.log('[HomePage] Fetching wrap summary for authenticated user...');
      const response = await fetch('/api/wrap-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          apiKey,
          lastStateHash: wrapStateHash
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.summary) {
          console.log('[HomePage] Wrap summary received:', result.summary);
          setWrapStateHash(result.stateHash);
          setLastWrapSummary(result.summary);
          return result.summary;
        }
      }
    } catch (error) {
      console.error('[HomePage] Error fetching wrap summary:', error);
    }

    // Fallback to welcome message for authenticated users too
    return `Welcome ${userProfile.email || userProfile.username}!`;
  }, [accessToken, apiKey, wrapStateHash]);

  // Periodic check for capsule state changes (every 5 minutes for authenticated users)
  useEffect(() => {
    if (!user || (!accessToken && !apiKey)) {
      // Clear any existing interval if user logs out
      if (wrapCheckIntervalRef.current) {
        clearInterval(wrapCheckIntervalRef.current);
        wrapCheckIntervalRef.current = null;
      }
      return;
    }

    // Set up periodic state check
    const checkForStateChanges = async () => {
      try {
        console.log('[HomePage] Checking for capsule state changes...');
        const response = await fetch('/api/wrap-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken,
            apiKey,
            lastStateHash: wrapStateHash
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.stateChanged && result.summary && result.summary !== lastWrapSummary) {
            console.log('[HomePage] Capsule state changed, updating summary');
            setStatusMessage(result.summary);
            setLastWrapSummary(result.summary);
            setWrapStateHash(result.stateHash);
          } else {
            console.log('[HomePage] No capsule state changes detected');
          }
        }
      } catch (error) {
        console.error('[HomePage] Error checking capsule state changes:', error);
      }
    };

    // Initial check after 30 seconds (to avoid immediate duplicate with auth flow)
    const initialTimeout = setTimeout(checkForStateChanges, 30000);
    
    // Then check every 5 minutes
    wrapCheckIntervalRef.current = setInterval(checkForStateChanges, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      if (wrapCheckIntervalRef.current) {
        clearInterval(wrapCheckIntervalRef.current);
        wrapCheckIntervalRef.current = null;
      }
    };
  }, [user, accessToken, apiKey, wrapStateHash, lastWrapSummary]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle auth flow: check if logged in, fetch/create token
  useEffect(() => {
    const handleAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const accessTokenFromUrl = urlParams.get('accessToken');
      const refreshToken = urlParams.get('refreshToken');
      const error = urlParams.get('error');

      // Set auth in progress IMMEDIATELY if we detect OAuth callback or stored token without user
      if (accessTokenFromUrl || (!user && accessToken && !isLoading && !authProcessed)) {
        setAuthInProgress(true);
      }

      // Handle authentication errors
      if (error) {
        console.error('[Auth] Authentication error:', error);
        setStatusMessage(`Authentication failed: ${error.replace(/_/g, ' ')}`);
        window.history.replaceState({}, document.title, window.location.pathname);
        setAuthInProgress(false);
        return;
      }

      // Handle OAuth callback
      if (accessTokenFromUrl && !user) {
        console.log('[Auth] Processing OAuth callback...');
        setStatusMessage('Completing authentication...');
        
        try {
          // Store refresh token immediately
          if (refreshToken) {
            localStorage.setItem('auth_refresh_token', refreshToken);
          }

          // Store access token immediately to prevent loss on refresh
          localStorage.setItem('auth_access_token', accessTokenFromUrl);

          // Get user profile and handle token
          const success = await handleUserAuth(accessTokenFromUrl);
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          if (!success) {
            setStatusMessage('Authentication failed: Unable to complete setup');
          }
          
        } catch (error) {
          console.error('[Auth] Error processing OAuth callback:', error);
          setStatusMessage('Authentication failed: Network error');
        } finally {
          setAuthInProgress(false);
        }
      }
      // If we have access token but no user (auth in progress after page reload)
      else if (!user && accessToken && !isLoading && !authProcessed) {
        console.log('[Auth] Found access token without user, completing auth...');
        setAuthProcessed(true);
        setAuthInProgress(true);
        try {
          const success = await handleUserAuth(accessToken);
          if (!success) {
            console.warn('[Auth] Failed to complete authentication from stored token');
            // Try to at least get user profile directly before clearing everything
            await tryDirectUserProfile(accessToken);
          }
        } finally {
          setAuthInProgress(false);
        }
      }
      // If user is already logged in, ensure they have a token (only once)
      else if (user && accessToken && !isLoading && !authProcessed && !apiKey) {
        console.log('[Auth] User logged in, checking/creating token...');
        setAuthProcessed(true);
        setAuthInProgress(true);
        try {
          const success = await handleUserAuth(accessToken);
          if (!success) {
            console.warn('[Auth] Failed to get/create API key for existing user');
          }
        } finally {
          setAuthInProgress(false);
        }
      }
    };

    const tryDirectUserProfile = async (token: string) => {
      try {
        console.log('[Auth] Attempting direct user profile fetch...');
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.shrinked.ai';
        const profileResponse = await fetch(`${API_BASE_URL}/users/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (profileResponse.ok) {
          const userProfile = await profileResponse.json();
          const userId = userProfile.userId || userProfile.id || userProfile._id;
          console.log('[Auth] Direct profile fetch successful:', userProfile.email, 'userId:', userId);
          setUserData(userProfile, token); // No API key, but we have user data
          const wrapMessage = await fetchWrapSummary(userProfile);
          setStatusMessage(wrapMessage);
        } else {
          console.warn('[Auth] Direct profile fetch also failed, clearing auth');
          logout();
        }
      } catch (error) {
        console.error('[Auth] Error in direct profile fetch:', error);
        logout();
      }
    };

    const handleUserAuth = async (token: string): Promise<boolean> => {
      try {
        // Use proxy API route to get/create API key (which also fetches user profile)
        const response = await fetch('/api/auth/api-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken: token,
            defaultName: 'Chars' // Create with name "Chars" if no token exists
          }),
        });

        if (response.ok) {
          const { apiKey: newApiKey, userProfile, existing } = await response.json();
          
          if (userProfile) {
            setUserData(userProfile, token, newApiKey);
            console.log('[Auth] Successfully authenticated user with API key');
            const wrapMessage = await fetchWrapSummary(userProfile);
            setStatusMessage(wrapMessage);
            return true;
          } else {
            console.warn('[Auth] No user profile returned from API');
            setStatusMessage('Authentication failed: No user data');
            return false;
          }
        } else {
          console.warn('[Auth] API key creation failed, checking for user profile in response');
          
          // Try to get user data even if API key creation failed
          try {
            const errorData = await response.json();
            const userProfile = errorData.userProfile;
            
            if (userProfile) {
              // We have user data but no API key - still authenticate the user
              setUserData(userProfile, token);
              const wrapMessage = await fetchWrapSummary(userProfile);
              setStatusMessage(wrapMessage);
              return true;
            }
          } catch (parseError) {
            console.warn('[Auth] Could not parse error response');
          }
          
          // If user is already stored locally, keep them logged in without API key
          if (user) {
            setUserData(user, token);
            const wrapMessage = await fetchWrapSummary(user);
            setStatusMessage(wrapMessage);
            return true; // User is still authenticated
          } else {
            setStatusMessage('Authentication failed: Unable to verify identity');
            return false;
          }
        }
      } catch (error) {
        console.error('[Auth] Error in handleUserAuth:', error);
        setStatusMessage('Authentication failed: Network error');
        return false;
      }
    };

    if (isClient) {
      handleAuth();
    }
  }, [isClient, user, accessToken, isLoading, authProcessed, apiKey, setUserData, logout, fetchWrapSummary]);

  const statusMessages = {
    signal: [
      "Fetching data sources and parsing context...",
      "Loading signal data from API endpoints...",
      "Retrieving file metadata and content links..."
    ],
    insights: [
      "Extracting highlights from markdown content...",
      "Processing text blocks and identifying key quotes...",
      "Structuring insights into presentable format..."
    ],
    thinking: [
      "Processing user request...",
      "Analyzing input and context...",
      "Generating response..."
    ],
    idle: [
      "System ready - All components loaded", 
      "Monitoring user interactions...",
      "Background processes: Caching optimized"
    ]
  };

  const updateStatusMessage = useCallback((phase: 'signal' | 'insights' | 'thinking' | 'idle') => {
    const messages = statusMessages[phase];
    let currentIndex = 0;
    
    // Set initial message immediately
    setStatusMessage(messages[currentIndex]);
    currentIndex = (currentIndex + 1) % messages.length;

    // Clear any existing interval
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
    }

    // For idle phase, show first message longer, then cycle through others
    if (phase === 'idle') {
      // Stay on "System ready" message for 10 seconds, then cycle
      setTimeout(() => {
        statusIntervalRef.current = setInterval(() => {
          setStatusMessage(messages[currentIndex]);
          currentIndex = (currentIndex + 1) % messages.length;
        }, 8000); // Slower rotation for idle messages
      }, 10000);
    } else if (phase === 'thinking') {
      // For thinking phase, cycle through messages faster to show activity
      statusIntervalRef.current = setInterval(() => {
        setStatusMessage(messages[currentIndex]);
        currentIndex = (currentIndex + 1) % messages.length;
      }, 2000); // Faster rotation for thinking messages
    } else {
      // Set up immediate interval for signal and insights phases
      statusIntervalRef.current = setInterval(() => {
        setStatusMessage(messages[currentIndex]);
        currentIndex = (currentIndex + 1) % messages.length;
      }, 3000);
    }
  }, []);

  useEffect(() => {
    // Start with signal phase
    updateStatusMessage('signal');
    
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [updateStatusMessage]);

  // Functions to control thinking state for ToolCore integration
  const startThinking = useCallback(() => {
    setLoadingPhase('insights'); // Change from idle to active state
    updateStatusMessage('thinking');
  }, [updateStatusMessage]);

  const stopThinking = useCallback(() => {
    setLoadingPhase('idle');
    updateStatusMessage('idle');
  }, [updateStatusMessage]);

  const initializePlayers = useCallback(() => {
    if (!fetchedOriginalLinks.length || !(window as any).YT) return;

    fetchedOriginalLinks.forEach((link, index) => {
      const videoId = getYouTubeVideoId(link);
      if (videoId && !playerRefs.current[videoId]) {
        const checkIframe = setInterval(() => {
          const iframe = document.getElementById(`youtube-player-${videoId}`);
          if (iframe) {
            clearInterval(checkIframe);
            try {
              playerRefs.current[videoId] = new (window as any).YT.Player(`youtube-player-${videoId}`, {
                events: {
                  'onReady': (event: any) => {
                    console.log(`[YouTube] Player ready for videoId: ${videoId}`);
                    if (index === 0) {
                      event.target.playVideo();
                      setIsPlaying(prev => ({ ...prev, [videoId]: true }));
                      setActiveVideoId(videoId);
                    }
                  },
                  'onStateChange': (event: any) => {
                    const newState = event.data === (window as any).YT.PlayerState.PLAYING;
                    setIsPlaying(prev => ({ ...prev, [videoId]: newState }));
                    if (newState) {
                      setActiveVideoId(videoId);
                    }
                  },
                  'onError': (event: any) => {
                    console.error(`[YouTube] Error for videoId: ${videoId}, code: ${event.data}`);
                  },
                },
              });
            } catch (error) {
              console.error(`[YouTube] Failed to initialize player for videoId: ${videoId}`, error);
            }
          }
        }, 100);

        setTimeout(() => clearInterval(checkIframe), 10000);
      }
    });
  }, [fetchedOriginalLinks]);

  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      console.log('[YouTube] API is ready');
      if (fetchedOriginalLinks.length > 0) {
        initializePlayers();
      }
    };

    return () => {
      delete (window as any).onYouTubeIframeAPIReady;
    };
  }, []);

  useEffect(() => {
    if (fetchedOriginalLinks.length > 0 && (window as any).YT && (window as any).YT.Player) {
      setTimeout(initializePlayers, 100);
    }
  }, [fetchedOriginalLinks, initializePlayers]);

  const parseHighlights = (text: string): Highlight[] => {
    console.log('[parseHighlights] Raw text to parse:', text);
    const highlights: Highlight[] = [];
    
    // First try the old highlight format with Title/Setup/Quote/Why it matters
    const highlightBlocks = text.split('---').filter(block => block.trim() !== '');
    console.log('[parseHighlights] Number of highlight blocks found:', highlightBlocks.length);

    let foundOldFormat = false;
    highlightBlocks.forEach((block, index) => {
      console.log(`[parseHighlights] Processing block ${index}:`, block);
      const subTitleMatch = block.match(/\*\*Title:\s*([\s\S]*?)\s*\*\*Setup:/);
      const setupMatch = block.match(/\*\*Setup:\s*([\s\S]*?)(?=\s*\*\*Quote:|$)/);
      const quoteMatch = block.match(/\*\*Quote:\s*([\s\S]*?)(?=\s*\*\*Why it matters:|$)/);
      const whyItMattersMatch = block.match(/\*\*Why it matters:\s*([\s\S]*?)(?=\s*---|$)/);

      if (subTitleMatch && setupMatch && quoteMatch && whyItMattersMatch) {
        foundOldFormat = true;
        const newHighlight = {
          title: subTitleMatch[1].trim().replace(/\*\*/g, ''),
          setup: setupMatch[1].trim().replace(/\*\*/g, ''),
          quote: quoteMatch[1].trim().replace(/\*\*/g, ''),
          whyItMatters: whyItMattersMatch[1].trim().replace(/\*\*/g, ''),
        };
        highlights.push(newHighlight);
        console.log(`[parseHighlights] Successfully parsed highlight ${index}:`, newHighlight);
      } else {
        console.warn(`[parseHighlights] Failed to parse block ${index} in old format.`);
      }
    });

    // If old format didn't work, try parsing as markdown sections
    if (!foundOldFormat && (text.includes('##') || text.includes('**'))) {
      console.log('[parseHighlights] Trying markdown section format...');
      
      let sections: string[] = [];
      
      // Try ## headers first
      if (text.includes('##')) {
        sections = text.split(/(?=^##?\s)/m).filter(section => section.trim() !== '');
        console.log(`[parseHighlights] Found ${sections.length} ## markdown sections`);
      }
      // Try ** bold headers if no ## headers found
      else if (text.includes('**') && sections.length === 0) {
        sections = text.split(/(?=^\*\*[^*]+\*\*)/m).filter(section => section.trim() !== '');
        console.log(`[parseHighlights] Found ${sections.length} ** bold header sections`);
      }
      
      sections.forEach((section, index) => {
        let titleMatch: RegExpMatchArray | null = null;
        let title = '';
        let content = '';
        
        // Try ## header format first
        titleMatch = section.match(/^##?\s*(.+?)(?:\n|$)/);
        if (titleMatch) {
          title = titleMatch[1].trim();
          content = section.replace(/^##?\s*.+?\n/, '').trim();
        }
        // Try ** bold header format
        else {
          titleMatch = section.match(/^\*\*([^*]+)\*\*/);
          if (titleMatch) {
            title = titleMatch[1].trim();
            content = section.replace(/^\*\*[^*]+\*\*\s*\n?/, '').trim();
          }
        }
        
        if (title && content.length > 0) {
          const newHighlight = {
            title: title,
            setup: '',
            quote: content,
            whyItMatters: '',
            isCapsuleSummary: true // Mark as summary to use different display
          };
          highlights.push(newHighlight);
          console.log(`[parseHighlights] Successfully parsed section ${index}:`, newHighlight.title);
        } else {
          console.warn(`[parseHighlights] Failed to parse section ${index}:`, section.substring(0, 100));
        }
      });
    }

    console.log('[parseHighlights] Final parsed highlights:', highlights);
    return highlights;
  };

  const fetchCapsuleContent = useCallback(async (key: string | null, capsuleId: string | null) => {
    console.log(`[HomePage] fetchCapsuleContent called with capsuleId: ${capsuleId}, key: ${key ? 'present' : 'null'}`);
    if (!capsuleId) return;
    if (isFetchingCapsuleContent) {
      console.log(`[HomePage] Already fetching capsule content, skipping...`);
      return;
    }
    
    setIsFetchingCapsuleContent(true);
    setHighlightsData([]);
    setFetchedOriginalLinks([]);
    setCapsuleContent("");
    try {
      const apiUrl = `/api/capsule-signal?capsuleId=${capsuleId}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (key) {
        headers['x-api-key'] = key;
        console.log(`[HomePage] Using user's API key for capsule fetch`);
      } else {
        console.log(`[HomePage] Using default API key for capsule fetch`);
      }

      console.log(`[HomePage] Attempting to fetch from: ${apiUrl}`);
      console.log(`[HomePage] Headers:`, headers);

      const response = await authFetch(apiUrl, {
        headers,
        cache: 'no-store',
        next: { revalidate: 0 },
      });

      console.log(`[HomePage] Response status: ${response.status}`);
      console.log(`[HomePage] Response URL: ${response.url}`);

      console.log(`[HomePage] Received response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HomePage] Failed to fetch capsule signal: ${response.status} ${response.statusText} - ${errorText}`);
        throw new Error(`Failed to fetch capsule signal: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const fetchedContent = data.highlights || data.signal || JSON.stringify(data, null, 2);
      setCapsuleContent(fetchedContent);

      if (data.highlights) {
        const parsed = parseHighlights(data.highlights);
        
        // If no highlights were parsed but we have content, treat it as a single summary
        if (parsed.length === 0 && data.highlights.trim()) {
          console.log('[HomePage] No structured highlights found, creating single summary card');
          const capsuleName = data.name || 'Capsule Summary';
          const summaryHighlight = {
            title: capsuleName,
            setup: '',
            quote: data.highlights.length > 800 ? 
              data.highlights.substring(0, 800) + '...\n\n[Click to view full analysis]'
              : 
              data.highlights,
            whyItMatters: '',
            isCapsuleSummary: true // Special flag for different display
          };
          setHighlightsData([summaryHighlight]);
          console.log('[HomePage] Created single capsule summary card for:', capsuleName);
        } else {
          setHighlightsData(parsed);
          console.log('[HomePage] Highlights data set:', parsed.length, 'sections');
        }
        const currentHighlights = parsed.length > 0 ? parsed : [{}]; // Use parsed or single summary
        const initialZIndexes: Record<string, number> = {};
        initialZIndexes['header'] = 1;
        initialZIndexes['original-links'] = 9999; // Video player always on top
        initialZIndexes['argue-popup'] = currentHighlights.length + 10; // Add argue popup with high z-index
        initialZIndexes['capsules-window'] = currentHighlights.length + 5; // Add capsules window to z-index tracking
        currentHighlights.forEach((_, index) => {
          initialZIndexes[`highlight-${index}`] = index + 2;
        });
        setCardZIndexes(initialZIndexes);
        setNextZIndex(currentHighlights.length + 11); // Update next z-index accordingly
      }

      if (data.fileIds && Array.isArray(data.fileIds)) {
        const DELAY_BETWEEN_REQUESTS = 2500; // Increased delay to further reduce rate limiting
        const processedFileIds = new Set<string>();
        console.log(`[HomePage] Processing ${data.fileIds.length} fileIds (${new Set(data.fileIds).size} unique):`, data.fileIds);

        for (const fileId of data.fileIds) {
          if (processedFileIds.has(fileId)) {
            console.log(`[HomePage] Skipping already processed fileId: ${fileId}`);
            continue;
          }
          processedFileIds.add(fileId);
          
          try {
            const jobDetailsUrl = `/api/job-details?fileId=${fileId}`;
            const jobDetailsHeaders: Record<string, string> = {};
            if (key) {
              jobDetailsHeaders['x-api-key'] = key;
            }
            console.log(`[HomePage] Fetching job details from: ${jobDetailsUrl}`);
            
            const jobDetailsResponse = await authFetch(jobDetailsUrl, {
              headers: jobDetailsHeaders,
              cache: 'no-store',
            });
            
            console.log(`[HomePage] Job details response status: ${jobDetailsResponse.status}`);
            
            if (jobDetailsResponse.ok) {
              const jobDetails = await jobDetailsResponse.json();
              console.log(`[HomePage] Job details response for ${fileId}:`, jobDetails);
              if (jobDetails.originalLink) {
                console.log(`[HomePage] Original link for fileId ${fileId}:`, jobDetails.originalLink);
                setFetchedOriginalLinks(prevLinks => {
                  const newLinks = [...prevLinks, jobDetails.originalLink];
                  console.log(`[HomePage] Updated fetchedOriginalLinks:`, newLinks);
                  return newLinks;
                });
              } else {
                console.warn(`[HomePage] No originalLink found for fileId ${fileId}. Response:`, jobDetails);
              }
            } else {
              console.log(`[HomePage] Job details request failed for ${fileId}, trying to parse error...`);
              console.log(`[HomePage] Failed request URL: ${jobDetailsUrl}`);
              console.log(`[HomePage] Response headers:`, [...jobDetailsResponse.headers.entries()]);
              
              try {
                const errorData = await jobDetailsResponse.json();
                console.error(`[HomePage] Failed to fetch job details for fileId ${fileId}: ${jobDetailsResponse.status}`, errorData);
                
                if (errorData.needsAuth && !user) {
                  setStatusMessage('Login required to access video content');
                } else {
                  setCapsuleContent(`Unable to load video content. Error: ${errorData.error || 'Backend service unavailable'}`);
                }
              } catch (e) {
                // Fallback for non-JSON error responses (like 502 HTML)
                try {
                  const errorText = await jobDetailsResponse.text();
                  console.error(`[HomePage] Failed to fetch job details for fileId ${fileId}: ${jobDetailsResponse.status} - ${errorText}`);
                } catch (readError) {
                  console.error(`[HomePage] Failed to fetch job details for fileId ${fileId}: ${jobDetailsResponse.status} - Could not read response body`);
                }
                
                if (jobDetailsResponse.status === 502) {
                  setCapsuleContent(`Unable to load video content. Backend service is temporarily unavailable (502).`);
                } else {
                  setCapsuleContent(`Unable to load video content. Error ${jobDetailsResponse.status}.`);
                }
              }
            }
          } catch (error: any) {
            console.error(`[HomePage] Error fetching job details for fileId ${fileId}:`, error.message);
            setCapsuleContent(`Unable to load video content. The backend service is currently unavailable.`);
          }

          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        }
      }

      console.log(`[HomePage] Successfully fetched capsule content.`);
    } catch (error: any) {
      console.error(`[HomePage] Error fetching capsule content:`, error.message);
      let errorMessage = 'Unable to load capsule content. Please try again later.';
      if (error.message.includes('{')) {
        try {
          // Extract the JSON part of the error message
          const jsonString = error.message.substring(error.message.indexOf('{'));
          const errorDetails = JSON.parse(jsonString);
          if (errorDetails.error) {
            errorMessage = `Error: ${errorDetails.error}.`;
            if (errorDetails.details) {
                try {
                    const details = JSON.parse(errorDetails.details);
                    errorMessage += ` Details: ${details.message || errorDetails.details}`;
                } catch (e) {
                    errorMessage += ` Details: ${errorDetails.details}`;
                }
            }
          }
        } catch (e) {
          // Ignore parsing error, use the generic message
        }
      }
      setCapsuleContent(errorMessage);
    } finally {
      setIsFetchingCapsuleContent(false);
    }
  }, [authFetch]); // Simplified dependencies to prevent loops

  const fetchCapsules = useCallback(async (key?: string | null) => {
    console.log('[HomePage] Fetching capsules...');
    setIsFetchingCapsules(true);
    console.log(`[HomePage] Available auth data - apiKey: ${key ? 'present' : 'null'}, accessToken: ${accessToken ? 'present' : 'null'}`);
    
    try {
      // For non-auth users, return hardcoded capsule list instead of real API lookup
      if (!key && !accessToken) {
        console.log('[HomePage] Non-auth user detected, returning hardcoded capsule list');
        const hardcodedCapsules = [
          {
            _id: '6887e02fa01e2f4073d3bb51',
            name: 'Demo Capsule',
            isPublic: true
          }
        ];
        
        console.log('[HomePage] Using hardcoded capsules:', hardcodedCapsules);
        setCapsules(hardcodedCapsules);
        setSelectedCapsuleId(hardcodedCapsules[0]._id);
        setShowCapsulesWindow(true);
        return;
      }
      
      // For authenticated users, make real API call
      const headers: Record<string, string> = {};
      
      if (key) {
        headers['x-api-key'] = key;
        console.log(`[HomePage] Adding API key to request`);
      }
      
      console.log(`[HomePage] Request headers prepared:`, Object.keys(headers));
      console.log(`[HomePage] Making fetch request to /api/capsules...`);
      
      const response = await authFetch('/api/capsules', {
        headers,
      });
      
      console.log(`[HomePage] Fetch completed, response received`);
      console.log(`[HomePage] Response status: ${response.status}`);
      console.log(`[HomePage] Response ok: ${response.ok}`);

      console.log(`[HomePage] Capsules response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log('[HomePage] Fetched capsules data:', data);
        setCapsules(data);
        if (data.length > 0) {
          setSelectedCapsuleId(data[0]._id);
          // For authenticated users, ensure video rendering is enabled
          setTimeout(() => {
            setShowVideo(true);
          }, 500);
        }
        setShowCapsulesWindow(true);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch capsules:', errorText);
      }
    } catch (error) {
      console.error('Error fetching capsules:', error);
    } finally {
      setIsFetchingCapsules(false);
    }
  }, [authFetch, accessToken]); // Added accessToken dependency

  useEffect(() => {
    // Load capsule content when selectedCapsuleId changes (both for demo and authenticated users)
    if (!isLoading && !authInProgress && selectedCapsuleId) {
      // For non-auth users in demo mode, wait for capsules fetch to complete to prevent concurrent requests
      if (!apiKey && !accessToken && !user && showDemo && isFetchingCapsules) {
        console.log(`[HomePage] Non-auth user - waiting for capsules fetch to complete before fetching capsule content`);
        return;
      }
      
      // Prevent fetching demo capsule with user API key (race condition fix)
      if (apiKey && selectedCapsuleId === '6887e02fa01e2f4073d3bb51') {
        console.log(`[HomePage] Skipping demo capsule fetch with user API key - will be cleared by auth useEffect`);
        return;
      }
      
      console.log(`[HomePage] useEffect triggered - Fetching capsule content for capsuleId: ${selectedCapsuleId}, apiKey: ${apiKey ? 'present' : 'null'}, user: ${user ? 'present' : 'null'}`);
      fetchCapsuleContent(apiKey, selectedCapsuleId);
    }
  }, [selectedCapsuleId, isFetchingCapsules, apiKey, accessToken, isLoading, authInProgress, showDemo, user, fetchCapsuleContent]);

  // Handle capsule selection based on auth state
  useEffect(() => {
    if (!isLoading && !authInProgress) {
      if (user) {
        // User is authenticated - show their content automatically
        console.log(`[HomePage] User authenticated, showing user content`);
        if (!showDemo) {
          setShowDemo(true);
          setShowHeader(true);
          console.log(`[HomePage] Starting demo for authenticated user`);
          // Trigger header completion automatically for authenticated users
          setTimeout(() => {
            if (!hasHeaderCompleted) {
              console.log(`[HomePage] Auto-completing header for authenticated user`);
              setHasHeaderCompleted(true);
              setLoadingPhase('insights');
              updateStatusMessage('insights');
              setShowCards(true);
              
              // Fetch user's capsules immediately
              console.log(`[HomePage] Fetching user capsules immediately`);
              fetchCapsules(apiKey);
              
              setTimeout(() => {
                setIsPageLoading(false);
                setLoadingPhase('idle');
                updateStatusMessage('idle');
                
                // Fetch wrap summary after status is set to idle
                if (user) {
                  console.log(`[HomePage] Fetching wrap summary for authenticated user after idle`);
                  setTimeout(() => {
                    fetchWrapSummary(user).then((summary) => {
                      setStatusMessage(summary);
                    }).catch(error => {
                      console.error('[HomePage] Error fetching initial wrap summary:', error);
                    });
                  }, 2000); // Wait 2 more seconds after idle state
                }
              }, 1000);
            }
          }, 100);
        }
        // Clear default capsule only, let fetchCapsules load user capsules
        if (selectedCapsuleId === '6887e02fa01e2f4073d3bb51') {
          console.log(`[HomePage] Clearing demo capsule for authenticated user`);
          setSelectedCapsuleId(null);
          setHighlightsData([]);
          setCapsuleContent("");
        }
      } else if (!selectedCapsuleId && !showDemo) {
        // No user and no capsule selected, and not in demo mode - do nothing.
      }
    }
  }, [isLoading, user, authInProgress, selectedCapsuleId, showDemo]);

  const handleHeaderLoadingComplete = useCallback(() => {
    if (hasHeaderCompleted) {
      console.log('[HomePage] Header already completed, skipping...');
      return;
    }
    
    console.log('[HomePage] Setting header as completed');
    setHasHeaderCompleted(true);
    setLoadingPhase('insights');
    updateStatusMessage('insights');
    
    if (showDemo) {
        setShowCards(true);
        setHighlightCard(0);
        
        console.log(`[HomePage] handleHeaderLoadingComplete called, apiKey: ${apiKey ? 'present' : 'null'}, accessToken: ${accessToken ? 'present' : 'null'}`);
        if (apiKey || accessToken) {
          console.log(`[HomePage] About to call fetchCapsules with apiKey: ${apiKey ? '...' + apiKey.slice(-4) : 'none'}, accessToken: ${accessToken ? 'present' : 'none'}`);
          fetchCapsules(apiKey);
        } else {
          console.log(`[HomePage] No user API key available, calling fetchCapsules with null (will use default API key)`);
          fetchCapsules(null);
        }

        setTimeout(() => setHighlightCard(null), 300);
        setTimeout(() => {
          setShowVideo(true);
          setIsPageLoading(false);
          setLoadingPhase('idle');
          updateStatusMessage('idle');
          
          // Set up idle timeout for extended messages
          idleTimeoutRef.current = setTimeout(() => {
            updateStatusMessage('idle');
          }, 10000);
        }, highlightsData.length * 300);
    } else {
        setIsPageLoading(false);
        setLoadingPhase('idle');
        updateStatusMessage('idle');
    }
  }, [hasHeaderCompleted, highlightsData.length, updateStatusMessage, apiKey, accessToken, fetchCapsules, showDemo]);

  useEffect(() => {
    if (showDemo && highlightsData.length > 0) {
        handleHeaderLoadingComplete();
    }
  }, [showDemo, highlightsData, handleHeaderLoadingComplete]);

  const handleBringToFront = useCallback((id: string) => {
    setCardZIndexes(prevZIndexes => ({
      ...prevZIndexes,
      [id]: nextZIndex,
    }));
    setNextZIndex(prev => prev + 1);
  }, [nextZIndex]);

  const calculateInitialPosition = useCallback((index: number) => {
    const offset = index * 15;
    const isDesktop = window.innerWidth >= 768;
    const headerHeight = 100;

    if (isDesktop) {
      return { x: 100 + offset, y: 100 + headerHeight + offset };
    } else {
      const cardWidth = 320;
      const centerX = (window.innerWidth - cardWidth) / 2;
      return { x: centerX + offset, y: 80 + headerHeight + offset };
    }
  }, []);

  const calculateVideoPosition = useCallback(() => {
    const isDesktop = window.innerWidth >= 768;
    
    if (isDesktop) {
      const leftAreaWidth = window.innerWidth * 0.62;
      return { x: leftAreaWidth, y: 150 }; // Moved down from 100 to 150
    } else {
      const cardWidth = 320;
      const centerX = (window.innerWidth - cardWidth) / 2;
      const cardsHeight = highlightsData.length * 50 + 100;
      return { x: centerX, y: cardsHeight + 20 };
    }
  }, [highlightsData.length]);

  const calculateCapsulesWindowPosition = useCallback(() => {
    const isDesktop = window.innerWidth >= 768;
    
    if (isDesktop) {
      // Position capsules window right above the bottom-right menu buttons
      // Menu buttons: bottom: 20px, right: 20px, height: 30px, total width: ~110px
      const menuButtonsWidth = 110; // 3 buttons * 30px + 2 gaps * 10px
      const menuButtonsHeight = 30;
      const menuBottomMargin = 20;
      const capsuleWindowWidth = 320; // Approximate capsules window width
      const capsuleWindowHeight = 200; // Approximate capsules window height
      const gap = 10; // Gap above the menu buttons
      
      return { 
        x: window.innerWidth - 20 - Math.max(menuButtonsWidth, capsuleWindowWidth), // Align right edge with buttons
        y: window.innerHeight - menuBottomMargin - menuButtonsHeight - gap - capsuleWindowHeight 
      };
    } else {
      // On mobile, place it at the bottom center, above the buttons
      const capsuleWindowWidth = 320;
      const capsuleWindowHeight = 200;
      const menuButtonsHeight = 30;
      const menuBottomMargin = 20;
      const gap = 10;
      const centerX = (window.innerWidth - capsuleWindowWidth) / 2;
      
      return { 
        x: centerX, 
        y: window.innerHeight - menuBottomMargin - menuButtonsHeight - gap - capsuleWindowHeight
      };
    }
  }, []);

  const calculateHeaderPosition = useCallback(() => {
    const isDesktop = window.innerWidth >= 768;

    if (isDesktop) {
      return { x: 16, y: 16 };
    } else {
      const cardWidth = 320;
      const centerX = (window.innerWidth - cardWidth) / 2;
      return { x: centerX, y: 16 };
    }
  }, []);

  const calculateStatusWindowPosition = useCallback(() => {
    // Position it right next to the buttons (left of them) with proper spacing
    // Buttons are at right: 20px, so we need to account for button width + gap
    // 2 buttons * 30px width + 2 * 2px borders each + 10px gap between buttons = 74px total button width
    // Add 10px gap between status window and buttons
    return { x: window.innerWidth - 20 - 74 - 10, y: window.innerHeight - 60 };
  }, []);

  const renderMarkdown = useCallback((text: string) => {
    let processedText = text.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
    processedText = processedText.replace(/### (.*)/g, '<h3>$1</h3>');
    return <span dangerouslySetInnerHTML={{ __html: processedText }} />;
  }, []);

  const getYouTubeVideoId = (url: string): string | null => {
    const regExp = /^(?:https?:\/\/(?:www\.)?youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?$/;
    const match = url.match(regExp);
    return (match && match[1].length === 11) ? match[1] : null;
  };

  const getYouTubeEmbedUrl = (videoId: string) => {
    const params = new URLSearchParams({
      enablejsapi: '1',
      controls: '0',
      modestbranding: '1',
      rel: '0',
      disablekb: '1',
      iv_load_policy: '3',
      fs: '0',
      playsinline: '1',
      showinfo: '0',
      autohide: '1',
      wmode: 'transparent',
      origin: window.location.origin,
    });
    
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  };

  const handlePlayPause = () => {
    if (activeVideoId && playerRefs.current[activeVideoId]) {
      try {
        const player = playerRefs.current[activeVideoId];
        if (isPlaying[activeVideoId]) {
          player.pauseVideo();
        } else {
          player.playVideo();
        }
      } catch (error) {
        console.error('Error controlling playback:', error);
      }
    }
  };

  const handleSeek = (seconds: number) => {
    if (activeVideoId && playerRefs.current[activeVideoId]) {
      try {
        const player = playerRefs.current[activeVideoId];
        const currentTime = player.getCurrentTime();
        player.seekTo(currentTime + seconds, true);
      } catch (error) {
        console.error('Error seeking video:', error);
      }
    }
  };

  const handleRestart = () => {
    if (activeVideoId && playerRefs.current[activeVideoId]) {
      try {
        playerRefs.current[activeVideoId].seekTo(0, true);
      } catch (error) {
        console.error('Error restarting video:', error);
      }
    }
  };

  const handleSeekToEnd = () => {
    if (activeVideoId && playerRefs.current[activeVideoId]) {
      try {
        const player = playerRefs.current[activeVideoId];
        player.seekTo(player.getDuration(), true);
      } catch (error) {
        console.error('Error seeking to end:', error);
      }
    }
  };

  return (
    <>
      <Head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta name="msapplication-TileColor" content="#c0c0c0" />
        <meta name="theme-color" content="#c0c0c0" />
      </Head>
      <AuthRedirectHandler />
      <main className="main-container">
        {isClient && (
          <>
            {showHeader && (
              <AnimatedHeader
                id="header"
                onBringToFront={handleBringToFront}
                initialZIndex={cardZIndexes['header'] || 1}
                initialPosition={calculateHeaderPosition()}
                onLoadingComplete={handleHeaderLoadingComplete}
                className="animated-header-window"
                responseMessage={headerResponseMessage}
                onResponseComplete={() => {
                  // Don't auto-clear responses - let them persist until next action
                  console.log('[HomePage] Response animation completed, keeping message visible');
                }}
              />
            )}

            {(showDemo || user) && showCards && highlightsData.length === 0 && !capsuleContent.startsWith('Unable') && !isLoading && !authInProgress && !isFetchingCapsuleContent && (
              <DraggableWindow
                id="no-content-card"
                onBringToFront={handleBringToFront}
                initialZIndex={cardZIndexes['no-content-card'] || 2}
                initialPosition={calculateInitialPosition(1)}
              >
                <div className="window-content">
                  <h2 className="main-heading">No Content</h2>
                  <p className="main-text">No highlights are available to display for this content.</p>
                </div>
              </DraggableWindow>
            )}

            {(showDemo || user) && showCards && highlightsData.map((highlight, index) => (
              <DraggableWindow
                key={`highlight-${index}`}
                id={`highlight-${index}`}
                onBringToFront={handleBringToFront}
                initialZIndex={cardZIndexes[`highlight-${index}`] || index + 2}
                initialPosition={calculateInitialPosition(index + 1)}
                style={{
                  animation: `fadeInCard 0.3s ease-out ${index * 0.1}s forwards`,
                  opacity: 0,
                  ...(highlightCard === index && { animation: 'highlightCard 0.3s ease-out' }),
                }}
              >
                {highlight.isCapsuleSummary ? (
                  <div className="window-content">
                    <div className="main-text">{renderMarkdown(highlight.quote)}</div>
                  </div>
                ) : (
                  <div className="window-content">
                    <h2 className="main-heading">{highlight.title}</h2>
                    <p className="main-text"><strong><i>Highlight:</i></strong> {renderMarkdown(highlight.setup)}</p>
                    <p className="main-text"><strong><i>Quote:</i></strong> {renderMarkdown(highlight.quote)}</p>
                    <p className="main-text"><strong><i>Why it matters:</i></strong> {renderMarkdown(highlight.whyItMatters)}</p>
                  </div>
                )}
              </DraggableWindow>
            ))}

            {(() => {
              console.log(`[HomePage] Video render check: showVideo=${showVideo}, fetchedOriginalLinks.length=${fetchedOriginalLinks.length}, links:`, fetchedOriginalLinks);
              return (showDemo || user) && showVideo && fetchedOriginalLinks.length > 0;
            })() && (
              <DraggableWindow
                id="original-links"
                onBringToFront={handleBringToFront}
                initialZIndex={cardZIndexes['original-links'] || 9999}
                initialPosition={calculateVideoPosition()}
                style={{ animation: 'fadeInVideo 0.5s ease-out forwards', opacity: 0 }}
                className="tv-player-window"
              >
                <div className="tv-bezel">
                  <div className="tv-screen">
                    <div className="window-content video-window-content">
                      <div className="video-embed-container">
                        {fetchedOriginalLinks.map((link, index) => {
                          const videoId = getYouTubeVideoId(link);
                          if (videoId) {
                            return (
                              <div key={index} className="youtube-video-wrapper">
                                <iframe
                                  id={`youtube-player-${videoId}`}
                                  width="100%"
                                  height="315"
                                  src={getYouTubeEmbedUrl(videoId)}
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  title={`YouTube video ${index}`}
                                ></iframe>
                              </div>
                            );
                          } else {
                            return (
                              <p key={index} className="main-text">
                                <a href={link} target="_blank" rel="noopener noreferrer">{link}</a>
                              </p>
                            );
                          }
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="tv-controls">
                    <div className="tv-speaker-grill">
                      {Array.from({ length: 10 }).map((_, i) => <span key={i}></span>)}
                    </div>
                    <div className="retro-controls">
                      <div className="control-button" onClick={handleRestart}>
                        <span className="icon">&#9664;&#9664;</span>
                      </div>
                      <div className="control-button" onClick={() => handleSeek(-10)}>
                        <span className="icon">&#9664;</span>
                      </div>
                      <div
                        className={`control-button play-pause ${isPlaying[activeVideoId || ''] ? 'pressed' : ''}`}
                        onClick={handlePlayPause}
                      >
                        <span className="icon">{isPlaying[activeVideoId || ''] ? '❚❚' : '▶'}</span>
                      </div>
                      <div className="control-button" onClick={() => handleSeek(10)}>
                        <span className="icon">&#9654;</span>
                      </div>
                      <div className="control-button" onClick={handleSeekToEnd}>
                        <span className="icon">&#9654;&#9654;</span>
                      </div>
                    </div>
                    <div className="tv-speaker-grill">
                      {Array.from({ length: 10 }).map((_, i) => <span key={i}></span>)}
                    </div>
                  </div>
                </div>
              </DraggableWindow>
            )}

            {showCapsulesWindow && (
              <CapsulesWindow
                id="capsules-window"
                capsules={capsules}
                onSelectCapsule={(capsuleId) => {
                  setSelectedCapsuleId(capsuleId);
                }}
                selectedCapsuleId={selectedCapsuleId}
                initialPosition={calculateCapsulesWindowPosition()}
                onBringToFront={handleBringToFront}
                initialZIndex={cardZIndexes['capsules-window'] || nextZIndex}
              />
            )}

            <div style={{
              position: 'fixed',
              bottom: '20px',
              left: '20px',
              right: '20px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '10px',
              zIndex: 1000
            }}>
              <div style={{ flex: '1 1 40%' }}>
                {/* Tool Core - Always active, handles its own UI */}
                <ToolCore
                  capsuleId={selectedCapsuleId || ''}
                  capsuleName={capsules.find(c => c._id === selectedCapsuleId)?.name}
                  onArgueRequest={(question: string) => {
                    setArgueQuestion(question);
                    setShowArguePopup(true);
                  }}
                  onBringToFront={handleBringToFront}
                  initialZIndex={nextZIndex + 200}
                  onRefreshCapsule={() => {
                    if (selectedCapsuleId) {
                      console.log('[HomePage] Refreshing capsule content after job completion');
                      fetchCapsuleContent(apiKey, selectedCapsuleId);
                    }
                  }}
                  onShowResponse={(message: string) => {
                    console.log('[HomePage] Showing response in header:', message);
                    setHeaderResponseMessage(message);
                  }}
                  onStartThinking={startThinking}
                  onStopThinking={stopThinking}
                  onStartDemo={startDemo}
                  onShowDemoWelcomeCard={() => setShowDemoWelcomeWindow(true)}
                />
              </div>

              <div style={{ flex: '1 1 30%' }}></div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                <DraggableWindow
                  id="status-window"
                  onBringToFront={handleBringToFront}
                  initialZIndex={cardZIndexes['status-window'] || nextZIndex + 1}
                  isDraggable={false}
                  className="status-window"
                  initialPosition={{ x: 0, y: 0 }}
                >
                  <div className="window-content">
                    <p className="main-text status-message-text">{statusMessage}</p>
                  </div>
                </DraggableWindow>

                <div className="fixed-buttons-container" style={{position: 'relative', bottom: 'auto', right: 'auto'}}>
                  <button
                    className={`action-button ${isPageLoading ? 'blinking' : ''}`}
                    onClick={() => window.location.reload()}
                  >
                    <img src="/signal.png" alt="Refresh" />
                  </button>
                  
                  {/* New Argue button */}
                  <button 
                    className="action-button argue-button" 
                    onClick={() => setShowArguePopup(true)}
                    title="Open Argue Tool"
                  >
                    <span>🎯</span>
                  </button>
                  
                  {/* Wrap button - for authenticated users only */}
                  {user && (
                    <WrapTool
                      showAsButton={true}
                      className="action-button wrap-button"
                      onSummaryUpdate={(summary) => {
                        setStatusMessage(summary);
                        setLastWrapSummary(summary);
                      }}
                      onStateHashUpdate={setWrapStateHash}
                      lastStateHash={wrapStateHash}
                    />
                  )}
                  
                  {/* Tool Core button */}
                  <button 
                    className="action-button tools-button" 
                    title="Smart Tools - Drop links, ask questions, or chat"
                  >
                    <span>🛠️</span>
                  </button>
                  
                  <button className="action-button" onClick={() => window.open('https://shrinked.ai', '_blank')}>
                    <img src="/shrinked.png" alt="Shrinked AI" />
                  </button>
                </div>
              </div>
            </div>

            <ArguePopup 
              isOpen={showArguePopup}
              onClose={() => {
                setShowArguePopup(false);
                setArgueQuestion(''); // Clear question when closing
              }}
              capsuleId={selectedCapsuleId || ''}
              onBringToFront={handleBringToFront}
              initialZIndex={cardZIndexes['argue-popup'] || nextZIndex + 100}
              initialQuestion={argueQuestion}
            />

            {showDemoWelcomeWindow && (
              <DemoWelcomeWindow
                id="demo-welcome-window"
                onBringToFront={handleBringToFront}
                initialZIndex={nextZIndex + 300}
                initialPosition={{ x: 50, y: 50 }} // Adjust position as needed
                onClose={() => setShowDemoWelcomeWindow(false)}
              />
            )}
          </>
        )}
      </main>
    </>
  );
};

export default HomePage;