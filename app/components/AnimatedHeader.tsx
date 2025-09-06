"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import DraggableWindow from './DraggableWindow';

interface AnimatedHeaderProps {
  id: string;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  initialPosition: { x: number; y: number };
  onLoadingComplete: () => void;
  className?: string;
  responseMessage?: string;
  onResponseComplete?: () => void;
}

const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  id,
  onBringToFront,
  initialZIndex,
  initialPosition,
  onLoadingComplete,
  className,
  responseMessage,
  onResponseComplete,
}) => {
  const [variantIndex, setVariantIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [showingResponse, setShowingResponse] = useState(false);
  const [responseShowing, setResponseShowing] = useState(false);
  const [responseChunks, setResponseChunks] = useState<string[]>([]);
  const [currentResponseChunk, setCurrentResponseChunk] = useState(0);
  const [streamingResponse, setStreamingResponse] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: 'auto', height: 'auto' });
  const [isAnimatingSize, setIsAnimatingSize] = useState(false);
  const measureRef = useRef<HTMLDivElement | null>(null);

  const variants = [
    "Welcome to my humble abode. I am Craig, your personal AI assistant.",
    "Welcome to my humble abode. I am Craig, your personal AI assistant. You can try to log in by convincing me you're worthy. Or, you can ask me any question about Vanya's demo content.",
    "Welcome to my humble abode. I am Craig, your personal AI assistant. You can try to log in by convincing me you're worthy. Or, you can ask me any question about Vanya's demo content. Alternatively, you can just say 'demo' to see an automated version of what I can do.",
    "Welcome to my humble abode. I am Craig, your personal AI assistant. You can try to log in by convincing me you're worthy. Or, you can ask me any question about Vanya's demo content. Alternatively, you can just say 'demo' to see an automated version of what I can do. Once you're in, you'll be able to add your own content. But first, you have to prove your worth."
  ];

  // Function to break response into meaningful chunks for streaming animation
  const createResponseChunks = useCallback((response: string) => {
    // Check if response contains complex HTML that shouldn't be chunked
    // Allow simple spans like clickable-tag spans but block complex HTML
    const hasComplexHtml = response.includes('<div') || response.includes('<p>') || 
                          response.includes('<img') || response.includes('<iframe') || 
                          response.includes('<script') || response.includes('<form') ||
                          (response.includes('<span') && !response.includes("class='clickable-tag'"));
    
    if (hasComplexHtml) {
      console.log('[AnimatedHeader] Complex HTML detected, skipping chunking for instant display');
      return [response]; // Return as single chunk for instant display
    }
    
    // For responses with simple HTML links, be more careful about chunking
    const hasSimpleHtml = response.includes('<a ') || response.includes('</a>');
    
    if (hasSimpleHtml) {
      // Split more conservatively for HTML content - avoid breaking in the middle of tags
      const sentences = response.split(/(\. )/);
      const chunks: string[] = [];
      let currentChunk = '';
      
      sentences.forEach((sentence) => {
        if (sentence.trim()) {
          currentChunk += sentence;
          
          // Only create chunks at sentence boundaries to avoid breaking HTML
          if (sentence === '. ' && currentChunk.length > 30) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
        }
      });
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      // For HTML content, ensure we have meaningful chunks
      const meaningfulChunks = chunks.filter(chunk => chunk.length > 10);
      if (meaningfulChunks.length >= 2) {
        return meaningfulChunks;
      }
      // If we couldn't create good chunks, split by length instead
      if (response.length > 80) {
        const midPoint = Math.floor(response.length / 2);
        const breakPoint = response.lastIndexOf(' ', midPoint + 20) || response.indexOf(' ', midPoint);
        if (breakPoint > 20 && breakPoint < response.length - 20) {
          return [response.substring(0, breakPoint + 1), response.substring(breakPoint + 1)];
        }
      }
      return [response]; // Fallback to single chunk
    }
    
    // Regular text processing without HTML
    const sentences = response.split(/([.!?]+\s*)/);
    const chunks: string[] = [];
    let currentChunk = '';
    
    sentences.forEach((sentence, index) => {
      const trimmed = sentence.trim();
      if (trimmed) {
        currentChunk += sentence;
        
        // Create a chunk when:
        // - We hit sentence-ending punctuation and have reasonable length (20+ chars)
        // - Current chunk is getting long (80+ chars)
        // - We hit a natural break (comma followed by space and capital letter)
        if (
          (sentence.match(/[.!?]+\s*$/) && currentChunk.length > 20) ||
          currentChunk.length > 80 ||
          (sentence.match(/,\s+[A-Z]/) && currentChunk.length > 30)
        ) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      }
    });
    
    // Add any remaining content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // Ensure we have at least 2 chunks for animation - be more aggressive about chunking
    if (chunks.length === 1 && chunks[0].length > 25) {
      const singleChunk = chunks[0];
      const midPoint = Math.floor(singleChunk.length / 2);
      
      // Try multiple break strategies
      let breakPoint = -1;
      
      // First, try to break at sentence boundaries
      const sentenceBreaks = ['. ', '! ', '? '];
      for (const sentenceEnd of sentenceBreaks) {
        const pos = singleChunk.indexOf(sentenceEnd, Math.max(20, midPoint - 30));
        if (pos > 20 && pos < singleChunk.length - 10) {
          breakPoint = pos + sentenceEnd.length - 1;
          break;
        }
      }
      
      // If no sentence break, try comma breaks
      if (breakPoint === -1) {
        const commaPos = singleChunk.indexOf(', ', Math.max(15, midPoint - 20));
        if (commaPos > 15 && commaPos < singleChunk.length - 10) {
          breakPoint = commaPos + 1;
        }
      }
      
      // Last resort: break at word boundary
      if (breakPoint === -1) {
        breakPoint = singleChunk.lastIndexOf(' ', midPoint + 15);
        if (breakPoint < 15 || breakPoint > singleChunk.length - 10) {
          breakPoint = singleChunk.indexOf(' ', midPoint);
        }
      }
      
      if (breakPoint > 15 && breakPoint < singleChunk.length - 5) {
        chunks[0] = singleChunk.substring(0, breakPoint + 1).trim();
        chunks.push(singleChunk.substring(breakPoint + 1).trim());
      }
    }
    
    const filteredChunks = chunks.filter(chunk => chunk.trim().length > 0);
    
    // Debug logging
    if (filteredChunks.length > 1) {
      console.log('[AnimatedHeader] Created', filteredChunks.length, 'chunks for streaming animation');
    } else {
      console.log('[AnimatedHeader] Single chunk - no streaming animation');
    }
    
    return filteredChunks;
  }, []);

  // Handle response message changes with streaming animation
  useEffect(() => {
    if (responseMessage && loadingComplete && !showingResponse) {
      setShowingResponse(true);
      setStreamingResponse(true);
      setResponseShowing(true);
      
      // Break response into chunks
      const chunks = createResponseChunks(responseMessage);
      setResponseChunks(chunks);
      setCurrentResponseChunk(0);
      
      // Start with diff animation showing first chunk
      setShowDiff(true);
      setTimeout(() => {
        setShowDiff(false);
      }, 1000);
    }
  }, [responseMessage, loadingComplete, showingResponse, onResponseComplete, createResponseChunks]);

  // Handle streaming animation progression
  useEffect(() => {
    if (!streamingResponse || !responseShowing || responseChunks.length === 0) return;
    
    // If only one chunk (HTML content), finish streaming immediately
    if (responseChunks.length === 1) {
      setStreamingResponse(false);
      if (onResponseComplete) {
        onResponseComplete();
      }
      return;
    }
    
    // Use timing that matches welcome sequence: 2000ms for first, 1500ms for others
    const delay = currentResponseChunk === 0 ? 2000 : 1500;
    
    const timer = setTimeout(() => {
      if (currentResponseChunk < responseChunks.length - 1) {
        setShowDiff(true);
        setCurrentResponseChunk(prev => prev + 1);
        setTimeout(() => setShowDiff(false), 1000);
      } else {
        // Finished streaming all chunks - just stop streaming, don't clear
        setStreamingResponse(false);
        if (onResponseComplete) {
          onResponseComplete();
        }
      }
    }, delay);
    
    return () => clearTimeout(timer);
  }, [currentResponseChunk, responseChunks, streamingResponse, responseShowing, onResponseComplete]);

  // Cycle through variants with pause
  useEffect(() => {
    if (showingResponse) return; // Don't cycle while showing response
    
    const delay = variantIndex === 0 ? 2000 : 1500;
    const timer = setTimeout(() => {
      if (variantIndex < variants.length - 1) {
        setShowDiff(true);
        setVariantIndex(prev => prev + 1);
        setTimeout(() => setShowDiff(false), 1000);
      } else {
        setLoadingComplete(true);
        onLoadingComplete();
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [variantIndex, onLoadingComplete, variants.length, showingResponse]);

  // Function to measure content dimensions and animate window resize
  const measureContentAndResize = useCallback((content: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.padding = '30px 30px 30px 30px'; // Match window-content padding
    tempDiv.style.fontSize = '18px';
    tempDiv.style.fontFamily = "'Geneva', sans-serif";
    tempDiv.style.lineHeight = '1.4';
    tempDiv.style.textAlign = 'center';
    tempDiv.style.color = '#000000';
    tempDiv.style.maxWidth = '480px'; // Match window max-width
    tempDiv.style.minWidth = '280px'; // Ensure minimum width
    tempDiv.style.wordWrap = 'break-word';
    document.body.appendChild(tempDiv);
    
    const width = Math.max(320, Math.min(480, Math.ceil(tempDiv.scrollWidth + 60))); // Add some buffer
    const height = Math.ceil(tempDiv.scrollHeight + 20); // Add some buffer for padding
    document.body.removeChild(tempDiv);
    
    // Animate to new dimensions with smooth easing
    setIsAnimatingSize(true);
    setWindowDimensions({ 
      width: `${width}px`, 
      height: `${height}px` 
    });
    
    // Reset animation state after transition
    setTimeout(() => {
      setIsAnimatingSize(false);
    }, 500); // Match CSS transition duration
    
    setDimensions({ width, height });
  }, []);

  // Measure dimensions of current variant and animate resize
  useEffect(() => {
    if (showingResponse && responseMessage) {
      if (streamingResponse && responseChunks.length > 0) {
        // For streaming responses, measure cumulative content
        const currentContent = responseChunks.slice(0, currentResponseChunk + 1).join('');
        measureContentAndResize(currentContent);
      } else {
        // For final response, measure complete content
        measureContentAndResize(responseMessage);
      }
    } else if (!showingResponse && variants[variantIndex]) {
      // For welcome variants
      measureContentAndResize(variants[variantIndex]);
    }
  }, [variantIndex, showingResponse, responseMessage, streamingResponse, currentResponseChunk, responseChunks, measureContentAndResize]);

  // Diff component for highlighting changes
  interface Segment {
    text: string;
    isDiff: boolean;
  }

  const Diff = ({ oldContent, newContent, showDiff }: { oldContent: string; newContent: string; showDiff: boolean }) => {
    const segments: Segment[] = [];
    const oldText = oldContent.replace(/<[^>]+>/g, '') || "";
    const newText = newContent.replace(/<[^>]+>/g, '') || "";
    const maxLength = Math.max(oldText.length, newText.length);
    let currentSegment: Segment = { text: "", isDiff: false };

    for (let i = 0; i < maxLength; i++) {
      const oldChar = oldText[i] || "";
      const newChar = newText[i] || "";
      if (oldChar !== newChar) {
        if (!currentSegment.isDiff && currentSegment.text) {
          segments.push({ ...currentSegment });
          currentSegment = { text: "", isDiff: true };
        }
        currentSegment.isDiff = true;
        currentSegment.text += newChar;
      } else {
        if (currentSegment.isDiff && currentSegment.text) {
          segments.push({ ...currentSegment });
          currentSegment = { text: "", isDiff: false };
        }
        currentSegment.text += newChar;
      }
    }
    if (currentSegment.text) {
      segments.push(currentSegment);
    }

    // Reconstruct HTML with diff highlighting
    const renderHtml = () => {
      let resultHtml = newContent;

      // Apply diff highlighting first
      if (showDiff) {
        let currentHtmlIndex = 0;
        segments.forEach(segment => {
          const plainTextSegment = segment.text;
          const plainTextIndex = newText.indexOf(plainTextSegment, currentHtmlIndex);

          if (plainTextIndex !== -1 && segment.isDiff) {
            let tempPlain = '';
            let htmlIdx = 0;
            while(tempPlain.length < plainTextIndex && htmlIdx < newContent.length) {
              if (newContent[htmlIdx] === '<') {
                while(newContent[htmlIdx] !== '>' && htmlIdx < newContent.length) {
                  htmlIdx++;
                }
              } else {
                tempPlain += newContent[htmlIdx];
              }
              htmlIdx++;
            }
            const actualHtmlIndex = htmlIdx - 1; 

            const segmentHtml = newContent.substring(actualHtmlIndex, actualHtmlIndex + plainTextSegment.length + (newContent.substring(actualHtmlIndex + plainTextSegment.length).match(/^<[^>]+>/) || [''])[0].length);

            resultHtml = resultHtml.replace(segmentHtml, `<span class="diff-highlight">${segmentHtml}</span>`);
          }
          currentHtmlIndex = plainTextIndex + plainTextSegment.length;
        });
      }

      // Now, apply 'selected' class to the first 'Reducto AI' span
      // This needs to be done carefully to avoid re-highlighting diffs
      const tempElement = document.createElement('div');
      tempElement.innerHTML = resultHtml;
      const clickableTags = tempElement.querySelectorAll('.clickable-tag');
      let reductoAIFound = false;

      clickableTags.forEach(tag => {
        if (tag.textContent === 'Reducto AI' && !reductoAIFound) {
          tag.classList.add('selected');
          reductoAIFound = true;
        }
      });

      return <span dangerouslySetInnerHTML={{ __html: tempElement.innerHTML }} />;
    };

    return renderHtml();
  };

  // For the final variant when loading is complete, apply selected class directly
  const getFinalContent = () => {
    if (variantIndex === variants.length - 1 && loadingComplete) {
      const finalContent = variants[variantIndex].replace(
        /<span class=['"]clickable-tag['"]>Reducto AI<\/span>/,
        '<span class="clickable-tag selected">Reducto AI</span>'
      );
      return <span dangerouslySetInnerHTML={{ __html: finalContent }} />;
    }
    return null;
  };

  return (
    <DraggableWindow
      id={id}
      onBringToFront={onBringToFront}
      initialZIndex={initialZIndex}
      initialPosition={initialPosition}
      style={{ 
        pointerEvents: loadingComplete ? 'auto' : 'none',
        width: windowDimensions.width,
        height: windowDimensions.height,
        transition: isAnimatingSize ? 'width 0.4s cubic-bezier(0.4, 0.0, 0.2, 1), height 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)' : 'none',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
      className={className}
    >
      <div className="window-content">
        <div>
          <div
            ref={measureRef}
            style={{
              position: 'absolute',
              visibility: 'hidden',
              padding: '0 8px',
              fontSize: '24px',
              fontFamily: "'Geneva', sans-serif",
            }}
          />
          <p className="main-text">
            {showingResponse && responseMessage ? (
              streamingResponse ? (
                // Show chunked response with diff animation
                currentResponseChunk > 0 ? (
                  <Diff
                    oldContent={responseChunks.slice(0, currentResponseChunk).join('')}
                    newContent={responseChunks.slice(0, currentResponseChunk + 1).join('')}
                    showDiff={showDiff}
                  />
                ) : (
                  <Diff
                    oldContent={variants[variants.length - 1]}
                    newContent={responseChunks[0] || ''}
                    showDiff={showDiff}
                  />
                )
              ) : (
                // Show final complete response without flashing
                <span dangerouslySetInnerHTML={{ __html: responseMessage }} />
              )
            ) : loadingComplete && variantIndex === variants.length - 1 ? (
      getFinalContent()
    ) : (
      <Diff
        oldContent={variantIndex === 0 ? '' : variants[variantIndex - 1]}
        newContent={variants[variantIndex]}
        showDiff={showDiff}
      />
    )}
          </p>
        </div>
      </div>
    </DraggableWindow>
  );
};

export default AnimatedHeader;