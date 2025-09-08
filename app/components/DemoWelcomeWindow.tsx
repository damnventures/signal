"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import DraggableWindow from './DraggableWindow';

interface DemoWelcomeWindowProps {
  id: string;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  initialPosition: { x: number; y: number };
  onClose: () => void;
  wrapSummary?: string | null;
  userEmail?: string;
}

const DemoWelcomeWindow: React.FC<DemoWelcomeWindowProps> = ({
  id,
  onBringToFront,
  initialZIndex,
  initialPosition,
  onClose,
  wrapSummary,
  userEmail,
}) => {
  const [variantIndex, setVariantIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [displayedMessage, setDisplayedMessage] = useState('');

  // Use wrap summary for authenticated users, or demo variants for non-auth users
  const getMessageVariants = () => {
    if (wrapSummary && userEmail) {
      // Authenticated user - show wrap summary with typewriter effect
      return [
        `Good morning, ${userEmail.split('@')[0]}! Checking your signals...`,
        wrapSummary
      ];
    } else {
      // Non-authenticated user - show demo variants
      return [
        "Good morning, Vanya! Checking your signals...",
        "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing.",
        "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing, and <span class='clickable-tag'>Ryan Petersen</span> is on today's TBPN stream.",
        "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing, <span class='clickable-tag'>Ryan Petersen</span> is on today's TBPN stream, and your July 30 call with <span class='clickable-tag'>The Residency</span> set deliverables."
      ];
    }
  };

  const variants = getMessageVariants();

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

  // Cycle through variants with pause
  useEffect(() => {
    const delay = variantIndex === 0 ? 2000 : 1500;
    const timer = setTimeout(() => {
      if (variantIndex < variants.length - 1) {
        setShowDiff(true);
        setVariantIndex(prev => prev + 1);
        setTimeout(() => setShowDiff(false), 1000);
      } else {
        // Animation complete, close after a delay
        setTimeout(onClose, 3000); // Close after 3 seconds
      }
    }, delay);
    
    return () => clearTimeout(timer);
  }, [variantIndex, variants.length, onClose]);

  // Update displayed message
  useEffect(() => {
    if (variantIndex === 0) {
      setDisplayedMessage(variants[0]);
    } else {
      setDisplayedMessage(variants.slice(0, variantIndex + 1).join(' '));
    }
  }, [variantIndex, variants]);

  return (
    <DraggableWindow
      id={id}
      onBringToFront={onBringToFront}
      initialZIndex={initialZIndex}
      initialPosition={initialPosition}
      className="animated-header-window" // Re-use header styles
    >
      <div className="window-content">
        <p className="main-text">
          <Diff
            oldContent={variantIndex === 0 ? '' : variants.slice(0, variantIndex).join(' ')}
            newContent={variants.slice(0, variantIndex + 1).join(' ')}
            showDiff={showDiff}
          />
        </p>
      </div>
    </DraggableWindow>
  );
};

export default DemoWelcomeWindow;