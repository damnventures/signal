"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import DraggableWindow from './components/DraggableWindow';
import AnimatedHeader from './components/AnimatedHeader';

interface Highlight {
  title: string;
  setup: string;
  quote: string;
  whyItMatters: string;
}

const HomePage = () => {
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
  const [updateMessage, setUpdateMessage] = useState('Initializing...');
  const [messageAnimationKey, setMessageAnimationKey] = useState(0);

  useEffect(() => {
    setIsClient(true);
  }, []);

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

  const parseHighlights = useCallback((text: string): Highlight[] => {
    console.log('[parseHighlights] Raw text to parse:', text);
    const highlights: Highlight[] = [];
    const highlightBlocks = text.split('---').filter(block => block.trim() !== '');

    console.log('[parseHighlights] Number of highlight blocks found:', highlightBlocks.length);

    highlightBlocks.forEach((block, index) => {
      console.log(`[parseHighlights] Processing block ${index}:`, block);
      const subTitleMatch = block.match(/\*\*Title:\s*([\s\S]*?)\s*\*\*Setup:/);
      const setupMatch = block.match(/\*\*Setup:\s*([\s\S]*?)(?=\s*\*\*Quote:|$)/);
      const quoteMatch = block.match(/\*\*Quote:\s*([\s\S]*?)(?=\s*\*\*Why it matters:|$)/);
      const whyItMattersMatch = block.match(/\*\*Why it matters:\s*([\s\S]*?)(?=\s*---|$)/);

      if (subTitleMatch && setupMatch && quoteMatch && whyItMattersMatch) {
        const newHighlight = {
          title: subTitleMatch[1].trim().replace(/\*\*/g, ''),
          setup: setupMatch[1].trim().replace(/\*\*/g, ''),
          quote: quoteMatch[1].trim().replace(/\*\*/g, ''),
          whyItMatters: whyItMattersMatch[1].trim().replace(/\*\*/g, ''),
        };
        highlights.push(newHighlight);
        console.log(`[parseHighlights] Successfully parsed highlight ${index}:`, newHighlight);
      } else {
        console.warn(`[parseHighlights] Failed to parse block ${index}. Missing matches.`);
      }
    });
    console.log('[parseHighlights] Final parsed highlights:', highlights);
    return highlights;
  }, []);

  useEffect(() => {
    const fetchCapsuleContent = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000';
        const apiUrl = `${baseUrl}/api/capsule-signal`;

        console.log(`[HomePage] Attempting to fetch from: ${apiUrl}`);

        const response = await fetch(apiUrl, {
          cache: 'no-store',
          next: { revalidate: 0 },
        });

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
          setHighlightsData(parsed);
          console.log('[HomePage] Highlights data set:', parsed);
          const initialZIndexes: Record<string, number> = {};
          initialZIndexes['header'] = 1;
          parsed.forEach((_, index) => {
            initialZIndexes[`highlight-${index}`] = index + 2;
          });
          setCardZIndexes(initialZIndexes);
          setNextZIndex(parsed.length + 2);
        }

        if (data.fileIds && Array.isArray(data.fileIds)) {
          const DELAY_BETWEEN_REQUESTS = 500;

          for (const fileId of data.fileIds) {
            try {
              const jobDetailsResponse = await fetch(`/api/job-details?fileId=${fileId}`);
              if (jobDetailsResponse.ok) {
                const jobDetails = await jobDetailsResponse.json();
                if (jobDetails.originalLink) {
                  console.log(`[HomePage] Original link for fileId ${fileId}:`, jobDetails.originalLink);
                  setFetchedOriginalLinks(prevLinks => [...prevLinks, jobDetails.originalLink]);
                } else {
                  console.warn(`[HomePage] No originalLink found for fileId ${fileId}`);
                }
              } else {
                const errorText = await jobDetailsResponse.text();
                console.error(`[HomePage] Failed to fetch job details for fileId ${fileId}: ${jobDetailsResponse.status} - ${errorText}`);
                setCapsuleContent(`Unable to load video content. The backend service is currently unavailable.`);
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
        setCapsuleContent('Unable to load capsule content. Please try again later.');
      }
    };

    fetchCapsuleContent();
  }, [parseHighlights]);

  useEffect(() => {
    const messages = [
      "System idle: Awaiting user input...",
      "Neural networks optimized: Ready for queries!",
      "Quantum processors aligned: Maximum insight mode!",
      "Synaptic circuits engaged: Ready to astound!"
    ];

    let currentIndex = 0;

    // Set the initial message immediately
    setUpdateMessage(messages[currentIndex]);
    setMessageAnimationKey(prevKey => prevKey + 1);
    currentIndex = (currentIndex + 1) % messages.length;

    const interval = setInterval(() => {
      setUpdateMessage(messages[currentIndex]);
      setMessageAnimationKey(prevKey => prevKey + 1); // Trigger animation
      currentIndex = (currentIndex + 1) % messages.length;
    }, 5000); // Update message every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleHeaderLoadingComplete = useCallback(() => {
    setShowCards(true);
    setHighlightCard(0);
    setTimeout(() => setHighlightCard(null), 300);
    setTimeout(() => {
      setShowVideo(true);
    }, highlightsData.length * 300);
  }, [highlightsData.length]);

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
      return { x: leftAreaWidth, y: 100 };
    } else {
      const cardWidth = 320;
      const centerX = (window.innerWidth - cardWidth) / 2;
      const cardsHeight = highlightsData.length * 50 + 100;
      return { x: centerX, y: cardsHeight + 20 };
    }
  }, [highlightsData.length]);

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

  const calculateUpdateWindowPosition = useCallback(() => {
    const buttonWidth = 30; // Width of the action buttons
    const buttonMargin = 10; // Gap between buttons
    const windowWidth = 200; // Approximate width of the update window
    const rightOffset = 20; // Margin from the right edge

    const x = window.innerWidth - rightOffset - (buttonWidth * 2) - buttonMargin - windowWidth - 10; // 10px for extra spacing
    const y = window.innerHeight - 20 - 30; // Align with bottom of buttons

    return { x, y };
  }, []);

  const renderMarkdown = useCallback((text: string) => {
    const boldedText = text.replace(/\*{2,3}(.*?)\*{2,3}/g, '<strong>$1</strong>');
    return <span dangerouslySetInnerHTML={{ __html: boldedText }} />;
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
            />
          )}

          {showCards && highlightsData.length === 0 && !capsuleContent.startsWith('Unable') && (
            <p>No highlights found or parsing failed.</p>
          )}

          {showCards && highlightsData.map((highlight, index) => (
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
              <div className="window-content">
                <h2 className="main-heading">{highlight.title}</h2>
                <p className="main-text"><strong><i>Highlight:</i></strong> {renderMarkdown(highlight.setup)}</p>
                <p className="main-text"><strong><i>Quote:</i></strong> {renderMarkdown(highlight.quote)}</p>
                <p className="main-text"><strong><i>Why it matters:</i></strong> {renderMarkdown(highlight.whyItMatters)}</p>
              </div>
            </DraggableWindow>
          ))}

          {showVideo && fetchedOriginalLinks.length > 0 && (
            <DraggableWindow
              id="original-links"
              onBringToFront={handleBringToFront}
              initialZIndex={cardZIndexes['original-links'] || nextZIndex}
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

          <DraggableWindow
            id="text-update-window"
            onBringToFront={handleBringToFront}
            initialZIndex={cardZIndexes['text-update-window'] || nextZIndex + 1}
            initialPosition={calculateUpdateWindowPosition()}
            isDraggable={false} // Make it non-draggable
            className="text-update-window"
            key={messageAnimationKey} // Key to trigger re-render and animation
          >
            <div className="window-content">
              <p className="main-text update-message-text">{updateMessage}</p>
            </div>
          </DraggableWindow>

          <div className="fixed-buttons-container">
            <button
              className={`action-button`}
              onClick={() => window.location.reload()}
            >
              <img src="/signal.png" alt="Refresh" />
            </button>
            <button className="action-button" onClick={() => window.open('https://shrinked.ai', '_blank')}>
              <img src="/shrinked.png" alt="Shrinked AI" />
            </button>
          </div>
        </>
      )}
    </main>
  );
};

export default HomePage;