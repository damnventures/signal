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
  demoMessage?: string | null; // For demo users
}

const DemoWelcomeWindow: React.FC<DemoWelcomeWindowProps> = ({
  id,
  onBringToFront,
  initialZIndex,
  initialPosition,
  onClose,
  wrapSummary,
  userEmail,
  demoMessage,
}) => {
  const [variantIndex, setVariantIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [displayedMessage, setDisplayedMessage] = useState('');

  // Helper function to break text into sentence-based variants like demo mode
  const createWrapVariants = useCallback((summary: string): string[] => {
    // Split by sentences and rebuild progressively like demo mode
    const sentences = summary.split(/\. (?=[A-Z])/);
    const variants: string[] = [];
    let currentText = '';
    
    sentences.forEach((sentence, index) => {
      if (index === 0) {
        currentText = sentence + (sentence.endsWith('.') ? '' : '.');
      } else {
        currentText += ' ' + sentence + (sentence.endsWith('.') ? '' : '.');
      }
      variants.push(currentText);
    });
    
    return variants.length > 1 ? variants : [summary];
  }, []);

  // For authenticated users, show loading then wrap summary
  // For demo users, show demo message
  // For non-auth users, show demo variants
  const getMessageVariants = () => {
    if (userEmail) {
      // Authenticated user flow
      if (!wrapSummary) {
        // Still loading wrap summary - show minimal loading state
        return [
          "Analyzing your capsules..."
        ];
      } else {
        // Break wrap summary into progressive variants like demo mode
        return createWrapVariants(wrapSummary);
      }
    } else if (demoMessage) {
      // Demo user flow - break demo message into progressive variants
      return createWrapVariants(demoMessage);
    } else {
      // Non-authenticated user - show default demo variants
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
  // Watch for prop changes (wrap summary arriving) and restart demo-style animation
  useEffect(() => {
    if (userEmail && wrapSummary) {
      // Reset animation when wrap summary arrives and use demo-style progression
      setVariantIndex(0);
      setShowDiff(false);
      // Don't use word-based animation - let variant progression handle it
    }
  }, [wrapSummary, userEmail]);

  // Watch for demo message changes and restart demo-style animation
  useEffect(() => {
    if (demoMessage && !userEmail) {
      // Reset animation when demo message arrives and use demo-style progression
      setVariantIndex(0);
      setShowDiff(false);
      // Don't use word-based animation - let variant progression handle it
    }
  }, [demoMessage, userEmail]);

  useEffect(() => {
    const delay = variantIndex === 0 ? 2000 : 1500;
    const timer = setTimeout(() => {
      if (variantIndex < variants.length - 1) {
        setShowDiff(true);
        setVariantIndex(prev => prev + 1);
        setTimeout(() => setShowDiff(false), 1000);
      } else {
        // Animation complete
        if (userEmail) {
          // For authenticated users, don't auto-close - let them close manually
          console.log('[DemoWelcomeWindow] Animation complete for auth user');
        } else if (demoMessage) {
          // For demo users with demo message, don't auto-close - let them close manually
          console.log('[DemoWelcomeWindow] Animation complete for demo user - keeping window open');
        } else {
          // For regular non-auth users (default demo variants), close after delay
          setTimeout(onClose, 3000);
        }
      }
    }, delay);
    
    return () => clearTimeout(timer);
  }, [variantIndex, variants.length, onClose, userEmail, demoMessage]);

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