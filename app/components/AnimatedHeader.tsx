"use client";

import React, { useState, useEffect, useRef } from 'react';
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
  const measureRef = useRef<HTMLDivElement | null>(null);

  const variants = [
    "Good morning, Vanya! Checking your signals...",
    "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing.",
    "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing, and <span class='clickable-tag'>Ryan Petersen</span> is on today's TBPN stream.",
    "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing, <span class='clickable-tag'>Ryan Petersen</span> is on today's TBPN stream, and your July 30 call with <span class='clickable-tag'>The Residency</span> set deliverables."
  ];

  // Handle response message changes
  useEffect(() => {
    if (responseMessage && loadingComplete && !showingResponse) {
      setShowingResponse(true);
      setShowDiff(true);
      
      // Show the response after diff animation
      setTimeout(() => {
        setResponseShowing(true);
        setShowDiff(false);
      }, 1000);
      
      // Clear response after 4 seconds
      setTimeout(() => {
        setShowDiff(true);
        setTimeout(() => {
          setShowingResponse(false);
          setResponseShowing(false);
          setShowDiff(false);
          if (onResponseComplete) {
            onResponseComplete();
          }
        }, 1000);
      }, 4000);
    }
  }, [responseMessage, loadingComplete, showingResponse, onResponseComplete]);

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
              responseShowing ? (
                <span dangerouslySetInnerHTML={{ __html: responseMessage }} />
              ) : (
                <Diff
                  oldContent={variants[variants.length - 1]}
                  newContent={responseMessage}
                  showDiff={showDiff}
                />
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