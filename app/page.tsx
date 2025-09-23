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
import HeaderMessageWindow from './components/HeaderMessageWindow';
import WrapTool, { WrapToolRef } from './components/WrapTool';
import Store from './components/Store';
import { executeWrapRequest, retryOn3040 } from './utils/requestManager';

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
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
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
  const [loadingPhase, setLoadingPhase] = useState<'signal' | 'insights' | 'thinking' | 'wrapping' | 'idle'>('signal');
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
  const [lastFetchedCapsuleId, setLastFetchedCapsuleId] = useState<string | null>(null);
  const [isFetchingCapsules, setIsFetchingCapsules] = useState(false);
  const [hasHeaderCompleted, setHasHeaderCompleted] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [showDemoWelcomeWindow, setShowDemoWelcomeWindow] = useState(false);
  const [showHeaderMessageWindow, setShowHeaderMessageWindow] = useState(false);
  const [wrapStateHash, setWrapStateHash] = useState<string>('');
  const [lastWrapSummary, setLastWrapSummary] = useState<string>('');
  const [isWrapFetching, setIsWrapFetching] = useState<boolean>(false);
  
  // Global wrap request tracker to prevent overlaps from any component
  const globalWrapRequestRef = useRef<boolean>(false);
  const wrapCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track when argue is in progress to prevent wrap interference
  const argueInProgressRef = useRef<boolean>(false);
  const lastArgueTimeRef = useRef<number>(0);
  const [showStore, setShowStore] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [accessibleShrinkedCapsules, setAccessibleShrinkedCapsules] = useState<string[]>([]);
  const [wrapSummaryShown, setWrapSummaryShown] = useState(false);
  const wrapToolRef = useRef<WrapToolRef>(null);
  const wrapStateHashRef = useRef<string>('');
  const [recent3040Error, setRecent3040Error] = useState<boolean>(false);

  const startDemo = useCallback(() => {
    setShowDemo(true);
    const defaultCapsuleId = '6887e02fa01e2f4073d3bb51'; // Reducto AI demo capsule
    setSelectedCapsuleId(defaultCapsuleId);
    setHasHeaderCompleted(false); // Reset header completed state
    // Force immediate fetch of demo capsule content to prevent timing issues
    setLastFetchedCapsuleId(null); // Reset to allow fresh fetch
    setTimeout(() => {
      fetchCapsuleContent(null, defaultCapsuleId); // Fetch with null API key for demo
    }, 100); // Small delay to ensure state updates
  }, [fetchCapsuleContent]);

  const handleDemoRequest = useCallback((message: string) => {
    console.log('[HomePage] Setting demo message:', message);
    setDemoMessage(message);
    setShowDemoWelcomeWindow(true);
  }, []);

  const fetchWrapSummary = useCallback(async (userProfile: any, hasAuth: boolean = true): Promise<string> => {
    // For non-authenticated users, always return simple welcome
    if (!hasAuth || !userProfile || (!accessToken && !apiKey)) {
      return `Welcome ${userProfile?.email || userProfile?.username || 'User'}!`;
    }

    // Prevent multiple concurrent requests (local and global)
    if (isWrapFetching || globalWrapRequestRef.current) {
      console.log('[HomePage] Wrap request already in progress, skipping...', {
        isWrapFetching,
        globalInProgress: globalWrapRequestRef.current,
        currentStack: new Error().stack?.split('\n')[2]
      });
      return lastWrapSummary || `Welcome ${userProfile.email || userProfile.username}!`;
    }

    try {
      setIsWrapFetching(true);
      globalWrapRequestRef.current = true;
      console.log('[HomePage] Fetching wrap summary for authenticated user...', {
        userProfile: userProfile?.email,
        hasAuth,
        timestamp: new Date().toISOString()
      });
      const response = await fetch('/api/wrap-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          apiKey,
          lastStateHash: wrapStateHash,
          username: user?.email?.split('@')[0] || user?.username || 'user'
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
      // Check if it's an SSL certificate error and return a sassy message
      if (error instanceof Error && (
        error.message.includes('certificate') ||
        error.message.includes('SSL') ||
        error.message.includes('CERT') ||
        error.message.includes('fetch failed')
      )) {
        return "Oops! Our servers are having a spa day 💅 We're updating our certificates and will be back shortly. Very exclusive maintenance, you understand.";
      }
      // For other errors, return a fallback message instead of undefined
      return `Welcome ${userProfile.email || userProfile.username}! Unable to fetch latest updates right now, but we're working on it.`;
    } finally {
      setIsWrapFetching(false);
      globalWrapRequestRef.current = false;
    }

    // Fallback to welcome message for authenticated users too
    return `Welcome ${userProfile.email || userProfile.username}!`;
  }, [accessToken, apiKey, wrapStateHash, isWrapFetching, lastWrapSummary]);

  // Animate status message with typewriter effect (like Argue tool)
  const animateStatusMessage = useCallback((fullMessage: string) => {
    // Safety check - ensure we have a valid message
    if (!fullMessage || typeof fullMessage !== 'string') {
      console.warn('[HomePage] animateStatusMessage called with invalid message:', fullMessage);
      return;
    }

    // Clear any existing intervals
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }

    const words = fullMessage.split(' ');
    let currentIndex = 0;
    
    // Show message in chunks of 3-4 words for better flow
    const animateChunk = () => {
      if (currentIndex >= words.length) return;
      
      const chunkSize = Math.random() > 0.5 ? 3 : 4; // Vary chunk size 3-4 words
      const chunk = words.slice(0, currentIndex + chunkSize).join(' ');
      setStatusMessage(chunk);
      
      currentIndex += chunkSize;
      
      if (currentIndex < words.length) {
        // Continue with next chunk after a brief delay
        setTimeout(animateChunk, 200 + Math.random() * 100); // 200-300ms between chunks
      }
    };
    
    // Start animation
    animateChunk();
  }, []);

  const showWrapSummaryOnce = useCallback(async (userProfile: any) => {
    if (wrapSummaryShown) {
      console.log('[HomePage] Wrap summary already shown, skipping duplicate');
      return;
    }

    // Additional check - if we already have a wrap summary displayed, don't fetch another
    if (lastWrapSummary && lastWrapSummary.trim() !== '') {
      console.log('[HomePage] Wrap summary already exists, skipping duplicate fetch');
      return;
    }

    console.log('[HomePage] Showing wrap summary for first time');
    setWrapSummaryShown(true);
    const wrapMessage = await fetchWrapSummary(userProfile);
    animateStatusMessage(wrapMessage);
  }, [wrapSummaryShown, fetchWrapSummary, animateStatusMessage, lastWrapSummary]);

  // Periodic check for capsule state changes (every 5 minutes for authenticated users)
  useEffect(() => {
    console.log('[HomePage] Periodic check useEffect triggered', {
      hasUser: !!user,
      hasAuth: !!(accessToken || apiKey),
      timestamp: new Date().toISOString()
    });
    
    if (!user || (!accessToken && !apiKey)) {
      // Clear any existing interval if user logs out
      if (wrapCheckIntervalRef.current) {
        console.log('[HomePage] Clearing existing interval due to no auth');
        clearInterval(wrapCheckIntervalRef.current);
        wrapCheckIntervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval before creating a new one
    if (wrapCheckIntervalRef.current) {
      console.log('[HomePage] Clearing existing interval before creating new one');
      clearInterval(wrapCheckIntervalRef.current);
      wrapCheckIntervalRef.current = null;
    }

    // Set up periodic state check
    const checkForStateChanges = async () => {
      // Access current values without dependencies
      const currentWrapStateHash = wrapStateHashRef.current;
      const currentIsWrapFetching = isWrapFetching;
      
      // Skip if already fetching wrap summary (local or global)
      if (currentIsWrapFetching || globalWrapRequestRef.current) {
        console.log('[HomePage] Skipping periodic check - wrap request already in progress', {
          localFetching: currentIsWrapFetching,
          globalInProgress: globalWrapRequestRef.current
        });
        return;
      }

      // Skip if argue operation is in progress or recently completed (within 10 seconds)
      const timeSinceLastArgue = Date.now() - lastArgueTimeRef.current;
      if (argueInProgressRef.current || timeSinceLastArgue < 10000) {
        console.log('[HomePage] Skipping periodic check - argue operation in progress or recent', {
          argueInProgress: argueInProgressRef.current,
          timeSinceLastArgue: timeSinceLastArgue
        });
        return;
      }
      
      try {
        console.log('[HomePage] Periodic check: Checking for capsule state changes...', {
          timestamp: new Date().toISOString(),
          lastStateHash: currentWrapStateHash
        });

        // Use simple request deduplication for periodic checks
        const result = await executeWrapRequest(async () => {
          return await retryOn3040(async () => {
            const response = await fetch('/api/wrap-summary', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                accessToken,
                apiKey,
                lastStateHash: currentWrapStateHash,
                username: user?.email?.split('@')[0] || user?.username || 'user'
              }),
            });

            if (!response.ok) {
              throw new Error(`Periodic wrap check failed: ${response.status}`);
            }

            return await response.json();
          });
        }, 'periodic-check', 10000);

        if (result.stateChanged) {
          if (result.summary && result.summary !== lastWrapSummary) {
            console.log('[HomePage] Capsule state changed, updating summary');
            // Clear status intervals when periodic check updates summary
            if (statusIntervalRef.current) {
              clearInterval(statusIntervalRef.current);
              statusIntervalRef.current = null;
            }
            setLastWrapSummary(result.summary);
            console.log('[HomePage] Periodic check updated status and cleared intervals');
          } else {
            console.log('[HomePage] Capsule state changed, but summary is the same.');
          }
          setWrapStateHash(result.stateHash); // Update the hash regardless of summary change
        } else {
          console.log('[HomePage] No capsule state changes detected');
        }
      } catch (error) {
        console.error('[HomePage] Error checking capsule state changes:', error);
        // For periodic checks, handle gracefully - don't interrupt user experience
        if (error instanceof Error) {
          if (error.message.includes('already in progress')) {
            console.log('[HomePage] Periodic check: Wrap request already active, skipping');
          } else if (error.message.includes('Rate limited')) {
            console.log('[HomePage] Periodic check: Rate limited, skipping');
          } else {
            console.error('[HomePage] Periodic wrap check failed:', error.message);
            // Track 3040 errors
            if (error.message.includes('3040') || error.message.includes('temporarily overloaded')) {
              setRecent3040Error(true);
              setTimeout(() => setRecent3040Error(false), 5 * 60 * 1000);
            }
          }
        }
      }
    };

    // Initial check after 30 seconds (to avoid immediate duplicate with auth flow)
    console.log('[HomePage] Setting up periodic wrap checks - initial timeout in 30s, then every 5 minutes');
    const initialTimeout = setTimeout(checkForStateChanges, 30000);
    
    // Then check every 5 minutes
    wrapCheckIntervalRef.current = setInterval(checkForStateChanges, 5 * 60 * 1000);
    console.log('[HomePage] Periodic interval created:', wrapCheckIntervalRef.current);

    return () => {
      clearTimeout(initialTimeout);
      if (wrapCheckIntervalRef.current) {
        clearInterval(wrapCheckIntervalRef.current);
        wrapCheckIntervalRef.current = null;
      }
    };
  }, [user, accessToken, apiKey]); // Removed wrapStateHash, lastWrapSummary, isWrapFetching to prevent cycles

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Keep wrapStateHashRef in sync with wrapStateHash state
  useEffect(() => {
    wrapStateHashRef.current = wrapStateHash;
  }, [wrapStateHash]);

  // Hide header for authenticated users (they get DemoWelcomeWindow instead)
  useEffect(() => {
    if (user && isClient) {
      console.log('[HomePage] Hiding header for authenticated user');
      setShowHeader(false);
    } else if (!user && isClient) {
      console.log('[HomePage] Showing header for non-authenticated user');
      setShowHeader(true);
    }
  }, [user, isClient]);

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
          await showWrapSummaryOnce(userProfile);
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
            await showWrapSummaryOnce(userProfile);
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
              await showWrapSummaryOnce(userProfile);
              return true;
            }
          } catch (parseError) {
            console.warn('[Auth] Could not parse error response');
          }
          
          // If user is already stored locally, keep them logged in without API key
          if (user) {
            setUserData(user, token);
            await showWrapSummaryOnce(user);
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
  }, [isClient, user, accessToken, isLoading, authProcessed, apiKey]);

  const statusMessages = {
    signal: user ? [
      "Loading your capsules...",
      "Fetching personal content collection...",
      "Organizing your knowledge base..."
    ] : [
      "Fetching data sources and parsing context...",
      "Loading signal data from API endpoints...",
      "Retrieving file metadata and content links..."
    ],
    insights: user ? [
      "Extracting highlights from your capsules...",
      "Processing your personal insights...",
      "Preparing your content for analysis..."
    ] : [
      "Extracting highlights from markdown content...",
      "Processing text blocks and identifying key quotes...",
      "Structuring insights into presentable format..."
    ],
    thinking: [
      "Processing user request...",
      "Analyzing input and context...",
      "Generating response..."
    ],
    wrapping: [
      "Generating wrap summary...",
      "Analyzing capsule changes...",
      "Building contextual insights..."
    ],
    idle: [
      "System ready - All components loaded", 
      "Monitoring user interactions...",
      "Background processes: Caching optimized"
    ]
  };

  const updateStatusMessage = useCallback((phase: 'signal' | 'insights' | 'thinking' | 'wrapping' | 'idle') => {
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
    } else if (phase === 'thinking' || phase === 'wrapping') {
      // For thinking and wrapping phases, cycle through messages faster to show activity
      statusIntervalRef.current = setInterval(() => {
        setStatusMessage(messages[currentIndex]);
        currentIndex = (currentIndex + 1) % messages.length;
      }, 2000); // Faster rotation for active operation messages
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

    const currentLink = fetchedOriginalLinks[currentVideoIndex];
    if (!currentLink) return;
    
    const videoId = getYouTubeVideoId(currentLink);
    if (!videoId) return;

    // Check if player already exists for current video
    if (playerRefs.current[videoId]) {
      console.log(`[YouTube] Player already exists for videoId: ${videoId}, skipping initialization`);
      setActiveVideoId(videoId);
      return;
    }

    // Clean up players for videos that are no longer current
    Object.entries(playerRefs.current).forEach(([existingVideoId, player]) => {
      if (existingVideoId !== videoId && player) {
        try {
          console.log(`[YouTube] Cleaning up old player for videoId: ${existingVideoId}`);
          if (typeof (player as any).destroy === 'function') {
            (player as any).destroy();
          }
          delete playerRefs.current[existingVideoId];
        } catch (error) {
          console.warn(`[YouTube] Error destroying player for videoId: ${existingVideoId}`, error);
        }
      }
    });

    console.log(`[YouTube] Initializing player for current video: ${videoId}`);
    const checkIframe = setInterval(() => {
      const iframe = document.getElementById(`youtube-player-${videoId}`);
      if (iframe) {
        clearInterval(checkIframe);
        try {
          playerRefs.current[videoId] = new (window as any).YT.Player(`youtube-player-${videoId}`, {
            events: {
              'onReady': (event: any) => {
                console.log(`[YouTube] Player ready for videoId: ${videoId}`);
                setActiveVideoId(videoId);
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
  }, [fetchedOriginalLinks, currentVideoIndex]);

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
      // Only initialize when currentVideoIndex changes or when we have the first video
      setTimeout(initializePlayers, 100);
    }
  }, [currentVideoIndex, initializePlayers]);

  // Separate effect for when first video is added
  useEffect(() => {
    if (fetchedOriginalLinks.length === 1 && (window as any).YT && (window as any).YT.Player) {
      setTimeout(initializePlayers, 100);
    }
  }, [fetchedOriginalLinks.length === 1, initializePlayers]);

  const parseHighlights = (text: string): Highlight[] => {
    const highlights: Highlight[] = [];

    // Safety check for empty or invalid text
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return highlights;
    }

    // First try the old highlight format with Title/Setup/Quote/Why it matters
    const highlightBlocks = text.split('---').filter(block => block.trim() !== '');

    let foundOldFormat = false;
    highlightBlocks.forEach((block, index) => {
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
      }
    });

    // If old format didn't work, try parsing as markdown sections
    if (!foundOldFormat && (text.includes('##') || text.includes('**'))) {
      let sections: string[] = [];

      // Try ## headers first
      if (text.includes('##')) {
        sections = text.split(/(?=^##?\s)/m).filter(section => section.trim() !== '');
      }
      // Try ** bold headers if no ## headers found
      else if (text.includes('**')) {
        sections = text.split(/(?=^\*\*[^*]+\*\*)/m).filter(section => section.trim() !== '');
      }

      // Safety limit to prevent infinite loops
      const maxSections = Math.min(sections.length, 20);
      
      for (let index = 0; index < maxSections; index++) {
        const section = sections[index];

        let title = '';
        let content = '';

        // Try ## header format first
        const hashHeaderMatch = section.match(/^##?\s*(.+?)(?:\n|$)/);
        if (hashHeaderMatch) {
          title = hashHeaderMatch[1].trim();
          content = section.replace(/^##?\s*.+?\n/, '').trim();
        }
        // Try ** bold header format
        else {
          const boldHeaderMatch = section.match(/^\*\*([^*]+)\*\*/);
          if (boldHeaderMatch) {
            title = boldHeaderMatch[1].trim();

            // Check if this is a section header that needs special handling
            if (title.match(/^(Section \d+:|Opening Hook:|Conclusion:|Synthesis)/)) {
              
              // Look for nested ** headers within this section
              const lines = section.split('\n');
              let actualTitle = '';
              let contentStartIndex = -1;

              // Limit search to prevent infinite loops
              const maxLines = Math.min(lines.length, 50);
              for (let i = 1; i < maxLines; i++) {
                const line = lines[i].trim();
                const nestedMatch = line.match(/^\*\*([^*]+)\*\*/);
                if (nestedMatch) {
                  const nestedTitle = nestedMatch[1].trim();
                  // Make sure it's not another section header
                  if (!nestedTitle.match(/^(Section \d+:|Opening Hook:|Conclusion:|Synthesis)/)) {
                    actualTitle = nestedTitle;
                    contentStartIndex = i + 1;
                    break;
                  }
                }
              }

              if (actualTitle && contentStartIndex > 0 && contentStartIndex < lines.length) {
                title = actualTitle;
                content = lines.slice(contentStartIndex, contentStartIndex + 30).join('\n').trim(); // Limit content length
              } else {
                // If no nested title found, use content after section header
                const contentLines = section.split('\n').slice(1, 31); // Limit to 30 lines
                content = contentLines.join('\n').trim();
              }
            } else {
              // Regular bold header - extract content after it
              content = section.replace(/^\*\*[^*]+\*\*\s*\n?/, '').trim();
              if (content.length > 1000) {
                content = content.substring(0, 1000) + '...'; // Limit content length
              }
            }
          } else {
            continue;
          }
        }
        
        // Ensure we have meaningful content
        if (title && title.length > 0 && content.length > 10) {
          const newHighlight = {
            title: title,
            setup: '',
            quote: content,
            whyItMatters: '',
            isCapsuleSummary: true // Mark as summary to use different display
          };
          highlights.push(newHighlight);
        }
      }
    }

    return highlights;
  };

  const fetchCapsuleContent = useCallback(async (key: string | null, capsuleId: string | null) => {
    console.log(`[HomePage] fetchCapsuleContent called with capsuleId: ${capsuleId}, key: ${key ? 'present' : 'null'}`);
    if (!capsuleId) return;
    if (isFetchingCapsuleContent) {
      console.log(`[HomePage] Already fetching capsule content, skipping...`);
      return;
    }

    // Check if this is a known shared system capsule
    const shrinkedCapsuleIds = [
      '68cdc3cf77fc9e53736d117e', // Cooking Preview
      '68c32cf3735fb4ac0ef3ccbf', // LastWeekTonight Preview
      '6887e02fa01e2f4073d3bb52', // AI Research Papers
      '6887e02fa01e2f4073d3bb53', // Startup Insights
      '6887e02fa01e2f4073d3bb54'  // Tech Podcasts
    ];
    const isSharedSystemCapsule = shrinkedCapsuleIds.includes(capsuleId);

    setIsFetchingCapsuleContent(true);
    // Clear UI state immediately for the selected capsule to give instant feedback
    setHighlightsData([]);
    setFetchedOriginalLinks([]);
    setCurrentVideoIndex(0);
    setCapsuleContent("");

    // Prevent cross-capsule video contamination by checking selectedCapsuleId
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
          initialZIndexes[`highlight-${index}`] = currentHighlights.length - index + 1;
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
            
            // For shared capsules, prefer to use default API key instead of user key
            
            // For shared system capsules, don't send user API key to allow fallback to default
            if (key && !isSharedSystemCapsule) {
              jobDetailsHeaders['x-api-key'] = key;
              console.log(`[HomePage] Using user API key for user-owned capsule`);
            } else {
              console.log(`[HomePage] Not sending user API key - allowing default API key fallback for shared capsule`);
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

                // Only add videos if this fetch is still for the current capsule
                if (selectedCapsuleId === capsuleId) {
                  setFetchedOriginalLinks(prevLinks => {
                    // Check if this link already exists to prevent duplicates
                    if (prevLinks.includes(jobDetails.originalLink)) {
                      console.log(`[HomePage] Skipping duplicate video link:`, jobDetails.originalLink);
                      return prevLinks;
                    }
                    const newLinks = [...prevLinks, jobDetails.originalLink];
                    console.log(`[HomePage] Added unique video link. Total: ${newLinks.length}`);
                    // Keep current video index at 0 (first video) instead of jumping to last
                    return newLinks;
                  });
                } else {
                  console.log(`[HomePage] Skipping video from previous capsule: ${fileId} (current: ${selectedCapsuleId}, fetch: ${capsuleId})`);
                }
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
      // Only set lastFetchedCapsuleId after successful completion
      setLastFetchedCapsuleId(capsuleId);
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

  const fetchCapsules = useCallback(async (key?: string | null, options?: { selectNew?: boolean }) => {
    console.log('[HomePage] === FETCHCAPSULES CALLED ===', { key: key ? '...' + key.slice(-4) : 'null', options });
    setIsFetchingCapsules(true);
    console.log(`[HomePage] Available auth data - apiKey: ${key ? 'present' : 'null'}, accessToken: ${accessToken ? 'present' : 'null'}`);
    
    // Store Shrinked capsules data for cross-reference
    const storeShrinkedCapsules = [
      { id: '68cdc3cf77fc9e53736d117e', name: 'Cooking Preview' },
      { id: '68c32cf3735fb4ac0ef3ccbf', name: 'LastWeekTonight Preview' },
      { id: '6887e02fa01e2f4073d3bb52', name: 'AI Research Papers' },
      { id: '6887e02fa01e2f4073d3bb53', name: 'Startup Insights' },
      { id: '6887e02fa01e2f4073d3bb54', name: 'Tech Podcasts' },
    ];
    
    try {
      // For non-auth users, return hardcoded capsule list instead of real API lookup
      if (!key && !accessToken) {
        console.log('[HomePage] Non-auth user detected, returning hardcoded capsule list');
        const hardcodedCapsules = [
          {
            _id: '6887e02fa01e2f4073d3bb51',
            name: 'Demo Capsule',
            isPublic: true
          },
          {
            _id: '68c32cf3735fb4ac0ef3ccbf',
            name: 'LastWeekTonight Preview',
            isPublic: true,
            isShared: true
          }
        ];
        
        console.log('[HomePage] Using hardcoded capsules:', hardcodedCapsules);
        setCapsules(hardcodedCapsules);
        setSelectedCapsuleId(hardcodedCapsules[0]._id);
        setShowCapsulesWindow(true);
        
        // Store access check for non-auth users
        const nonAuthAccessible = hardcodedCapsules.map(c => c._id);
        console.log('[HomePage] Store check - Non-auth user has demo access to:', hardcodedCapsules.map(c => c.name));
        console.log('[HomePage] Store check - Non-auth accessible IDs:', nonAuthAccessible);
        setAccessibleShrinkedCapsules(nonAuthAccessible);
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
        
        // Also fetch shared capsules if user has API key
        let allCapsules = data;
        if (key) {
          try {
            console.log('[HomePage] Fetching shared capsules...');
            console.log('[HomePage] Using API key (last 4 chars):', key.slice(-4));
            const sharedResponse = await authFetch('/api/capsules/shared', {
              headers: {
                'x-api-key': key
              },
            });
            
            console.log('[HomePage] Shared capsules response status:', sharedResponse.status);
            if (sharedResponse.ok) {
              const sharedData = await sharedResponse.json();
              console.log('[HomePage] Fetched shared capsules:', sharedData);
              console.log('[HomePage] Shared capsules count:', Array.isArray(sharedData) ? sharedData.length : 'not array');
              console.log('[HomePage] Shared capsule IDs:', Array.isArray(sharedData) ? sharedData.map((c: any) => c._id) : 'not array');
              
              // Merge shared capsules with owned capsules, avoiding duplicates
              if (Array.isArray(sharedData)) {
                const ownedIds = new Set(data.map((c: any) => c._id));
                console.log('[HomePage] Owned capsule IDs:', Array.from(ownedIds));
                const newSharedCapsules = sharedData.filter((c: any) => !ownedIds.has(c._id));
                console.log('[HomePage] New shared capsules to add:', newSharedCapsules);
                allCapsules = [...data, ...newSharedCapsules.map((c: any) => ({ ...c, isShared: true }))];
                console.log('[HomePage] Final merged capsules:', allCapsules.map((c: any) => ({id: c._id, name: c.name, isShared: c.isShared })));
              }
            } else {
              const errorText = await sharedResponse.text();
              console.warn('[HomePage] Failed to fetch shared capsules:', sharedResponse.status, errorText);
            }
          } catch (sharedError) {
            console.error('[HomePage] Error fetching shared capsules:', sharedError);
            // Continue with just the owned capsules
          }
        } else {
          console.log('[HomePage] No API key available, skipping shared capsules fetch');
        }
        
        const oldCapsuleIds = new Set(capsules.map(c => c._id));
        const newCapsules = allCapsules.filter((c: any) => !oldCapsuleIds.has(c._id));

        setCapsules(allCapsules);

        if (allCapsules.length > 0) {
          if (options?.selectNew && newCapsules.length > 0) {
            setSelectedCapsuleId(newCapsules[0]._id);
            console.log('[HomePage] New capsule detected, auto-selecting it:', newCapsules[0]._id);
          } else if (!selectedCapsuleId) {
            setSelectedCapsuleId(allCapsules[0]._id);
            console.log('[HomePage] No capsule selected, auto-selecting first user capsule:', allCapsules[0]._id);
          } else {
            const currentCapsuleExists = allCapsules.some((c: any) => c._id === selectedCapsuleId);
            if (currentCapsuleExists) {
              console.log('[HomePage] User already has capsule selected and it exists, keeping it:', selectedCapsuleId);
            } else {
              console.log('[HomePage] Currently selected capsule no longer exists, selecting first available:', allCapsules[0]._id);
              setSelectedCapsuleId(allCapsules[0]._id);
            }
          }
          // For authenticated users, ensure video rendering is enabled
          setTimeout(() => {
            setShowVideo(true);
          }, 500);
        }
        setShowCapsulesWindow(true);
        
        // Store access check - cross-reference user's capsules with Shrinked capsules in store
        const userCapsuleIds = allCapsules.map((c: any) => c._id);
        const ownedShrinked = storeShrinkedCapsules.filter(storeCapsule =>
          userCapsuleIds.includes(storeCapsule.id)
        );
        // Find capsules user has access to via sharing or ACL
        const accessibleShrinked = storeShrinkedCapsules.filter(storeCapsule => {
          const capsule = allCapsules.find((c: any) => c._id === storeCapsule.id);
          if (!capsule) return false;

          // User has access if:
          // 1. It's a shared capsule (from shared API), OR
          // 2. User is in the ACL (for private capsules)
          const isSharedCapsule = capsule.shared || capsule.isShared;
          const userInACL = capsule.acl && capsule.acl.some((entry: any) => entry.userId === (user?.id || (user as any)?._id));

          return isSharedCapsule || userInACL;
        });

        // Check for private store capsules that might have ACL access
        const privateStoreCapsulesWithAccess = storeShrinkedCapsules.filter(storeCapsule => {
          // Only check capsules not already in allCapsules (private ones)
          const capsuleInAllCapsules = allCapsules.find((c: any) => c._id === storeCapsule.id);
          return !capsuleInAllCapsules;
        });

        // Debug logs (reduced)
        console.log('[HomePage] DEBUG: user ID:', user?.id || (user as any)?._id);
        console.log('[HomePage] DEBUG: Private capsules to check:', privateStoreCapsulesWithAccess.length);

        // Check cooking capsule specifically
        const cookingCapsule = allCapsules.find((c: any) => c._id === '68cdc3cf77fc9e53736d117e');
        if (cookingCapsule) {
          console.log('[HomePage] DEBUG: Found cooking capsule in allCapsules:', {
            id: cookingCapsule._id,
            shared: cookingCapsule.shared,
            isShared: cookingCapsule.isShared,
            acl: cookingCapsule.acl,
            userInACL: cookingCapsule.acl && cookingCapsule.acl.some((entry: any) => entry.userId === (user?.id || (user as any)?._id))
          });
        } else {
          console.log('[HomePage] DEBUG: Cooking capsule NOT found in allCapsules');
        }

        // Combine owned and accessible capsule IDs
        const totalAccessible = [...new Set([
          ...ownedShrinked.map(c => c.id),
          ...accessibleShrinked.map(c => c.id)
        ])];
        
        console.log('[HomePage] Store check - Total accessible capsules:', totalAccessible.length);
        
        // Update state to pass to Store component
        setAccessibleShrinkedCapsules(totalAccessible);
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

  // Memoize the refresh function to prevent unnecessary re-renders
  const onRefreshCapsules = useCallback(() => {
    fetchCapsules(apiKey);
  }, [fetchCapsules, apiKey]);

  useEffect(() => {
    // Load capsule content when selectedCapsuleId changes (both for demo and authenticated users)
    if (!isLoading && !authInProgress && selectedCapsuleId) {
      // For non-auth users in demo mode, wait for capsules fetch to complete to prevent concurrent requests
      if (!apiKey && !accessToken && !user && showDemo && isFetchingCapsules) {
        console.log(`[HomePage] Non-auth user - waiting for capsules fetch to complete before fetching capsule content`);
        return;
      }

      // Prevent fetching cooking capsule with user API key unless user has access to it
      if (apiKey && selectedCapsuleId === '68cdc3cf77fc9e53736d117e' && !accessibleShrinkedCapsules.includes('68cdc3cf77fc9e53736d117e')) {
        console.log(`[HomePage] Skipping cooking capsule fetch - user doesn't have access and will be cleared by auth useEffect`);
        return;
      }

      // Don't refetch if we already have content for this capsule
      if (lastFetchedCapsuleId === selectedCapsuleId) {
        console.log(`[HomePage] Content already loaded for capsuleId: ${selectedCapsuleId}, skipping fetch`);
        return;
      }

      console.log(`[HomePage] useEffect triggered - Fetching capsule content for capsuleId: ${selectedCapsuleId}, apiKey: ${apiKey ? 'present' : 'null'}, user: ${user ? 'present' : 'null'}`);
      fetchCapsuleContent(apiKey, selectedCapsuleId);
    }
  }, [selectedCapsuleId, apiKey, user, accessibleShrinkedCapsules]); // Added accessibleShrinkedCapsules since we use it in the condition

  // Handle capsule selection based on auth state
  useEffect(() => {
    if (!isLoading && !authInProgress) {
      if (user) {
        // User is authenticated - show their content automatically
        console.log(`[HomePage] User authenticated, showing user content`);
        if (!showDemo) {
          setShowDemo(true);
          setShowHeader(false); // Don't show AnimatedHeader for authenticated users
          console.log(`[HomePage] Starting demo for authenticated user`);
          // Start proper loading sequence for authenticated users
          console.log(`[HomePage] Starting loading sequence for authenticated user`);
          
          // Phase 1: Signal phase - show welcome window + load capsules
          setLoadingPhase('signal');
          updateStatusMessage('signal');
          
          // Show wrap welcome window immediately (only if not triggered by demo intent and not already shown)
          if (user && !demoMessage && !showDemoWelcomeWindow && !hasHeaderCompleted) {
            console.log(`[HomePage] Showing wrap welcome window for authenticated user`);
            setShowDemoWelcomeWindow(true);

            // Wrap summary is already fetched and animated in auth flow
            console.log('[HomePage] Wrap summary already handled by auth flow');
          } else if (demoMessage) {
            console.log(`[HomePage] Skipping auto welcome window - demo message already set:`, demoMessage);
          } else {
            console.log(`[HomePage] Skipping welcome window - already shown or completed:`, {
              showDemoWelcomeWindow,
              hasHeaderCompleted,
              user: !!user,
              demoMessage: !!demoMessage
            });
          }
          
          // Phase 2: After 3 seconds, move to insights phase + show capsules + fetch data
          setTimeout(() => {
            console.log(`[HomePage] Moving to insights phase - showing capsules`);
            setHasHeaderCompleted(true);
            setLoadingPhase('insights');
            updateStatusMessage('insights');
            setShowCards(true);
            
            // Fetch user's capsules
            console.log(`[HomePage] Fetching user capsules`);
            fetchCapsules(apiKey);
            
            // Phase 3: After 4 more seconds, show highlights + video + move to idle
            setTimeout(() => {
              console.log(`[HomePage] Moving to idle phase - showing highlights and video`);
              setIsPageLoading(false);
              setLoadingPhase('idle');
              updateStatusMessage('idle');
            }, 4000); // Give time for highlights to load
          }, 3000); // Wait for welcome window to be seen
        }
        // Clear default capsule only, let fetchCapsules load user capsules
        if (selectedCapsuleId === '68cdc3cf77fc9e53736d117e') {
          console.log(`[HomePage] Clearing demo capsule for authenticated user`);
          setSelectedCapsuleId(null);
          setHighlightsData([]);
          setCapsuleContent("");
        }
      } else if (!selectedCapsuleId && !showDemo) {
        // No user and no capsule selected, and not in demo mode - do nothing.
      }
    }
  }, [isLoading, user, authInProgress, showDemo]);

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

  useEffect(() => {
    if (showDemoWelcomeWindow) {
      setCardZIndexes(prev => ({
        ...prev,
        'demo-welcome': nextZIndex,
        'demo-welcome-overflow': nextZIndex - 1,
      }));
      setNextZIndex(prev => prev + 2);
    }
  }, [showDemoWelcomeWindow]);

  const handleBringToFront = useCallback((id: string) => {
    setCardZIndexes(prevZIndexes => ({
      ...prevZIndexes,
      [id]: nextZIndex,
    }));
    setNextZIndex(prev => prev + 1);
  }, [nextZIndex]);

  const calculateInitialPosition = useCallback((index: number) => {
    const offset = index * 15;
    const headerHeight = 100;

    // Default position for SSR
    if (typeof window === 'undefined') {
      return { x: 100 + offset, y: 170 + headerHeight + offset };
    }

    const isDesktop = window.innerWidth >= 768;

    if (isDesktop) {
      return { x: 100 + offset, y: 170 + headerHeight + offset }; // Moved down 70px to avoid welcome window overlap
    } else {
      const cardWidth = 320;
      const centerX = (window.innerWidth - cardWidth) / 2;
      return { x: centerX + offset, y: 150 + headerHeight + offset }; // Moved down 70px to avoid welcome window overlap
    }
  }, []);

  const calculateVideoPosition = useCallback(() => {
    // Default position for SSR
    if (typeof window === 'undefined') {
      return { x: 100, y: 150 };
    }

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
    // Default position for SSR
    if (typeof window === 'undefined') {
      return { x: 320, y: 300 };
    }

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
    // Default position for SSR
    if (typeof window === 'undefined') {
      return { x: 16, y: 16 };
    }

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
    // Default position for SSR
    if (typeof window === 'undefined') {
      return { x: 200, y: 500 };
    }

    // Position it right next to the buttons (left of them) with proper spacing
    // Buttons are at right: 20px, so we need to account for button width + gap
    // 2 buttons * 30px width + 2 * 2px borders each + 10px gap between buttons = 74px total button width
    // Add 10px gap between status window and buttons
    return { x: window.innerWidth - 20 - 74 - 10, y: window.innerHeight - 60 };
  }, []);

  const renderMarkdown = useCallback((text: string) => {
    let processedText = text.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
    processedText = processedText.replace(/### (.*)/g, '<h3>$1</h3>');

    // Wrap references like [28, 29, 40-43] in styled spans with passive #666 color
    processedText = processedText.replace(/(\[[\d\s,\-]+\])/g, '<span style="color: #666; font-size: 0.9em;">$1</span>');

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

  const handleArgueRequest = useCallback((question: string) => {
    console.log('[HomePage] Argue request started - setting argue tracking');
    console.log('[HomePage] Current state - showDemoWelcomeWindow:', showDemoWelcomeWindow, 'question:', question);
    argueInProgressRef.current = true;
    lastArgueTimeRef.current = Date.now();
    setArgueQuestion(question);
    setShowArguePopup(true);
    console.log('[HomePage] DEBUG: ArguePopup should open with question:', question);
    // Keep welcome window open - new argue response will spawn as separate header window
  }, [showDemoWelcomeWindow]);

  const arguePopupPosition = useMemo(() => calculateInitialPosition(highlightsData.length + 1), [highlightsData.length, calculateInitialPosition]);

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
                responseMessage={showHeaderMessageWindow ? '' : headerResponseMessage}
                onResponseComplete={() => {
                  // Don't auto-clear responses - let them persist until next action
                  console.log('[HomePage] Response animation completed, keeping message visible');
                }}
                isAuthenticated={!!user}
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
                initialZIndex={cardZIndexes[`highlight-${index}`] || (highlightsData.length - index + 1)}
                initialPosition={calculateInitialPosition(index)}
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

            {(showDemo || user) && showVideo && fetchedOriginalLinks.length > 0 && (
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
                        {(() => {
                          const currentLink = fetchedOriginalLinks[currentVideoIndex];
                          if (!currentLink) return null;
                          
                          const videoId = getYouTubeVideoId(currentLink);
                          if (videoId) {
                            return (
                              <div key={currentVideoIndex} className="youtube-video-wrapper">
                                <iframe
                                  id={`youtube-player-${videoId}`}
                                  width="100%"
                                  height="315"
                                  src={getYouTubeEmbedUrl(videoId)}
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  title={`YouTube video ${currentVideoIndex + 1} of ${fetchedOriginalLinks.length}`}
                                ></iframe>
                              </div>
                            );
                          } else {
                            return (
                              <p key={currentVideoIndex} className="main-text">
                                <a href={currentLink} target="_blank" rel="noopener noreferrer">{currentLink}</a>
                              </p>
                            );
                          }
                        })()}
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
                currentUser={user}
                onSelectCapsule={async (capsuleId) => {
                  console.log(`[HomePage] User selected capsule: ${capsuleId}`);
                  console.log(`[HomePage] Current capsules in window:`, capsules.map((c: any) => ({id: c._id, name: c.name})));

                  // If switching to a different capsule, reset lastFetchedCapsuleId to allow fresh fetch
                  if (selectedCapsuleId !== capsuleId) {
                    console.log(`[HomePage] Switching from ${selectedCapsuleId} to ${capsuleId}, resetting lastFetchedCapsuleId`);
                    setLastFetchedCapsuleId(null);
                  }

                  setSelectedCapsuleId(capsuleId);
                  
                  // Auto-share LastWeekTonight Preview capsule when authenticated user selects it
                  if (capsuleId === '68c32cf3735fb4ac0ef3ccbf' && user && user.email) {
                    console.log(`[HomePage] Auto-sharing LastWeekTonight Preview capsule with ${user.email}`);
                    try {
                      const shareResponse = await fetch(`/api/capsules/${capsuleId}/share`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          email: user.email,
                          role: 'viewer'
                        }),
                      });
                      
                      if (shareResponse.ok) {
                        console.log(`[HomePage] Successfully shared capsule with ${user.email}`);
                        // Now accept the invite
                        const acceptResponse = await fetch(`/api/capsules/${capsuleId}/accept-invite`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': apiKey || ''
                          },
                          body: JSON.stringify({
                            email: user.email
                          }),
                        });
                        
                        if (acceptResponse.ok) {
                          console.log(`[HomePage] Successfully accepted invite for ${user.email}`);
                          // Skip the refresh since auto-sharing only happens for already accessible capsules
                          // The capsule is already loaded and this prevents the re-render cascade
                          console.log(`[HomePage] Skipping capsule list refresh to prevent duplicate loading`);
                        } else {
                          console.error('[HomePage] Failed to accept invite:', await acceptResponse.text());
                        }
                      } else {
                        console.error('[HomePage] Failed to share capsule:', await shareResponse.text());
                      }
                    } catch (error) {
                      console.error('[HomePage] Error in auto-sharing:', error);
                    }
                  }
                }}
                selectedCapsuleId={selectedCapsuleId}
                initialPosition={calculateCapsulesWindowPosition()}
                onBringToFront={handleBringToFront}
                initialZIndex={cardZIndexes['capsules-window'] || nextZIndex}
              />
            )}

            {/* Video Navigation Controls - Top Right Corner */}
            {fetchedOriginalLinks.length > 1 && (
              <div style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <DraggableWindow
                  id="video-nav"
                  onBringToFront={handleBringToFront}
                  initialZIndex={nextZIndex + 500}
                  isDraggable={false}
                  className="status-window"
                  initialPosition={{ x: 0, y: 0 }}
                >
                  <div className="window-content" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '4px 8px',
                    minHeight: 'auto'
                  }}>
                    <button
                      onClick={() => setCurrentVideoIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentVideoIndex === 0}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '12px',
                        cursor: currentVideoIndex === 0 ? 'default' : 'pointer',
                        color: currentVideoIndex === 0 ? '#808080' : '#000000',
                        padding: '2px 4px'
                      }}
                    >
                      &lt;
                    </button>
                    <span className="main-text" style={{ fontSize: '10px', margin: 0 }}>
                      {currentVideoIndex + 1}/{fetchedOriginalLinks.length}
                    </span>
                    <button
                      onClick={() => setCurrentVideoIndex(prev => Math.min(fetchedOriginalLinks.length - 1, prev + 1))}
                      disabled={currentVideoIndex === fetchedOriginalLinks.length - 1}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '12px',
                        cursor: currentVideoIndex === fetchedOriginalLinks.length - 1 ? 'default' : 'pointer',
                        color: currentVideoIndex === fetchedOriginalLinks.length - 1 ? '#808080' : '#000000',
                        padding: '2px 4px'
                      }}
                    >
                      &gt;
                    </button>
                  </div>
                </DraggableWindow>
              </div>
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
                  onArgueRequest={handleArgueRequest}
                  onBringToFront={handleBringToFront}
                  initialZIndex={nextZIndex + 200}
                  onRefreshCapsule={() => {
                    console.log('[HomePage] Refreshing capsules list and selecting new after job completion');
                    fetchCapsules(apiKey, { selectNew: true });
                  }}
                  onRefreshWrap={() => {
                    console.log('[HomePage] Triggering wrap refresh after job completion');
                    // Trigger a manual wrap update to include new content
                    if (user && (accessToken || apiKey) && wrapToolRef.current) {
                      console.log('[HomePage] Calling WrapTool.triggerWrap() programmatically');
                      wrapToolRef.current.triggerWrap();
                    }
                  }}
                  onShowResponse={(message: string) => {
                    console.log('[HomePage] Showing response in header window:', message);
                    setHeaderResponseMessage(message);
                    setShowHeaderMessageWindow(true);
                  }}
                  onStartThinking={startThinking}
                  onStopThinking={stopThinking}
                  onStartDemo={startDemo}
                  onShowDemoWelcomeCard={() => setShowDemoWelcomeWindow(true)}
                  onDemoRequest={handleDemoRequest}
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
                      ref={wrapToolRef}
                      showAsButton={true}
                      autoFetch={false}  // Disabled - using original auto wrap system
                      className="action-button wrap-button"
                      onWrapStart={() => {
                        // Don't clear welcome window - let animation handle it
                        setLoadingPhase('wrapping');
                        updateStatusMessage('wrapping');
                        console.log('[HomePage] Manual wrap started');
                      }}
                      onStatusMessage={(message) => {
                        // Update loading phase to wrapping and show custom message
                        setLoadingPhase('wrapping');
                        setStatusMessage(message);
                        console.log('[HomePage] Wrap status:', message);
                      }}
                      onSummaryUpdate={(summary) => {
                        // When wrap result comes back, handle based on content
                        console.log('[HomePage] Received wrap summary:', summary);
                        console.log('[HomePage] recent3040Error state:', recent3040Error);

                        const isNoUpdatesResponse = summary && (summary.includes('No updates') || summary.includes('unchanged') || summary.length < 50);
                        console.log('[HomePage] isNoUpdatesResponse:', isNoUpdatesResponse);

                        // If 3040 error happened recently, always show full summary (bypass "no updates")
                        if (isNoUpdatesResponse && !recent3040Error) {
                          // Normal case: show "no new updates" in header window
                          console.log('[HomePage] Showing no updates in header window');
                          setHeaderResponseMessage('*No new updates since last wrap - your capsules remain current.*');
                          setShowHeaderMessageWindow(true);
                        } else {
                          // Either has real updates OR bypass due to 3040 error - show full summary in welcome window
                          console.log('[HomePage] Showing full summary in welcome window');
                          setLastWrapSummary(summary);
                          if (recent3040Error) {
                            console.log('[HomePage] Clearing 3040 error flag after successful manual refresh');
                            setRecent3040Error(false);
                          }
                        }
                        // Resume periodic status updates and return to idle phase
                        // Small delay to ensure wrap status message is processed before switching to idle
                        setTimeout(() => {
                          setLoadingPhase('idle');
                          updateStatusMessage('idle');
                          console.log('[HomePage] Wrap tool updated welcome window and resumed status');
                        }, 100);
                      }}
                      onError={(error) => {
                        // Track 3040 errors from manual wrap attempts
                        if (error.includes('3040') || error.includes('temporarily overloaded')) {
                          console.log('[HomePage] Manual wrap 3040 error - enabling refresh exception');
                          setRecent3040Error(true);
                          setTimeout(() => setRecent3040Error(false), 5 * 60 * 1000);
                        }
                      }}
                      onStateHashUpdate={setWrapStateHash}
                      lastStateHash={wrapStateHash}
                    />
                  )}
                  
                  {/* Store button */}
                  <button
                    className="action-button store-button"
                    onClick={() => setShowStore(true)}
                    title="Open Integrations Store"
                  >
                    <span>🛒</span>
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
                console.log('[HomePage] Argue popup closed - clearing argue tracking');
                argueInProgressRef.current = false;
                lastArgueTimeRef.current = Date.now();
                setShowArguePopup(false);
                setArgueQuestion(''); // Clear question when closing
              }}
              onArgueComplete={() => {
                console.log('[HomePage] Argue operation completed - clearing argue in progress flag');
                argueInProgressRef.current = false;
                lastArgueTimeRef.current = Date.now();
              }}
              capsuleId={selectedCapsuleId || ''}
              onBringToFront={handleBringToFront}
              initialZIndex={cardZIndexes['argue-popup'] || nextZIndex + 100}
                initialPosition={arguePopupPosition}
              id="argue-popup"
              initialQuestion={argueQuestion}
              userCapsules={capsules}
              accessibleShrinkedCapsules={accessibleShrinkedCapsules}
            />

            {showDemoWelcomeWindow && (
              <DemoWelcomeWindow
                id="demo-welcome"
                onBringToFront={handleBringToFront}
                initialPosition={{ x: 30, y: 30 }}
                onClose={() => setShowDemoWelcomeWindow(false)}
                wrapSummary={lastWrapSummary}
                userEmail={user?.email}
                demoMessage={demoMessage}
                cardZIndexes={cardZIndexes}
              />
            )}

            {showHeaderMessageWindow && headerResponseMessage && (
              <HeaderMessageWindow
                id="header-message-window"
                onBringToFront={handleBringToFront}
                initialZIndex={cardZIndexes['header-message-window'] || nextZIndex + 400} // Higher than welcome window
                initialPosition={{ x: 60, y: 60 }} // Slightly offset from welcome window
                onClose={() => {
                  console.log('[HomePage] Header message window closed');
                  setShowHeaderMessageWindow(false);
                  setHeaderResponseMessage(''); // Clear message when closing
                }}
                message={headerResponseMessage}
              />
            )}

            <Store
              isOpen={showStore}
              onClose={() => setShowStore(false)}
              userCapsules={capsules}
              user={user}
              onRefreshCapsules={onRefreshCapsules}
              accessibleShrinkedCapsules={accessibleShrinkedCapsules}
            />
          </>
        )}
      </main>
    </>
  );
};

export default HomePage;