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
  const measureRef = useRef<HTMLDivElement | null>(null);

  const variants = [
    "Good morning, Vanya! Checking your signals...",
    "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing.",
    "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing, and <span class='clickable-tag'>Ryan Petersen</span> is on today's TBPN stream.",
    "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing, <span class='clickable-tag'>Ryan Petersen</span> is on today's TBPN stream, and your July 30 call with <span class='clickable-tag'>The Residency</span> set deliverables."
  ];

  // Function to break response into meaningful chunks for streaming animation
  const createResponseChunks = useCallback((response: string) => {
    // Check if response contains HTML - if so, don't chunk to avoid breaking tags
    if (response.includes('<') && response.includes('>')) {
      console.log('[AnimatedHeader] HTML detected, skipping chunking for instant display');
      return [response]; // Return as single chunk for instant display
    }
    
    // Split by sentences first
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
    
    // Ensure we have at least 2 chunks for animation
    if (chunks.length === 1 && chunks[0].length > 40) {
      const singleChunk = chunks[0];
      const midPoint = Math.floor(singleChunk.length / 2);
      // Find a good break point near the middle
      let breakPoint = singleChunk.lastIndexOf(' ', midPoint + 20);
      if (breakPoint === -1 || breakPoint < midPoint - 20) {
        breakPoint = singleChunk.indexOf(' ', midPoint);
      }
      if (breakPoint !== -1) {
        chunks[0] = singleChunk.substring(0, breakPoint + 1);
        chunks.push(singleChunk.substring(breakPoint + 1));
      }
    }
    
    return chunks.filter(chunk => chunk.trim().length > 0);
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

  // Measure dimensions of current variant
  useEffect(() => {
    if (measureRef.current) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = variants[variantIndex];
      tempDiv.style.position = 'absolute';
      tempDiv.style.visibility = 'hidden';
      tempDiv.style.padding = '0 8px';
      tempDiv.style.fontSize = '24px';
      tempDiv.style.fontFamily = "'Geneva', sans-serif";
      document.body.appendChild(tempDiv);
      const width = Math.ceil(tempDiv.scrollWidth);
      const height = Math.ceil(tempDiv.scrollHeight);
      document.body.removeChild(tempDiv);
      setDimensions({ width, height });
    }
  }, [variantIndex]);

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
      style={{ pointerEvents: loadingComplete ? 'auto' : 'none' }}
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
            ) : variantIndex > 0 ? (
              <Diff
                oldContent={variants[Math.max(0, variantIndex - 1)]}
                newContent={variants[variantIndex]}
                showDiff={showDiff}
              />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: variants[0] }} />
            )}
          </p>
        </div>
      </div>
    </DraggableWindow>
  );
};

export default AnimatedHeader;