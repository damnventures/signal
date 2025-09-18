"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DraggableWindow from './DraggableWindow';
import { createMessageVariants, MessageDiff, ANIMATION_CONFIG } from './MessageAnimation';

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
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const [visibleVariants, setVisibleVariants] = useState<string[]>([]);
  const [overflowText, setOverflowText] = useState('');

  // Use shared message variant creation utility
  const createWrapVariants = useCallback((summary: string): string[] => {
    return createMessageVariants(summary);
  }, []);

  // For authenticated users, show loading then wrap summary
  // For demo users, show demo message
  // For non-auth users, show demo variants
  const getMessageVariants = useCallback(() => {
    if (userEmail) {
      // Authenticated user flow - NEVER show demo content, only wrap summaries
      if (!wrapSummary || wrapSummary.trim() === '') {
        // Still loading wrap summary - show minimal loading state
        return [
          "Analyzing your capsules..."
        ];
      } else {
        // Break wrap summary into progressive variants like demo mode
        return createWrapVariants(wrapSummary);
      }
    } else {
      // Non-authenticated user only - show demo content
      if (demoMessage) {
        // Demo intent flow - only for non-auth users
        return createWrapVariants(demoMessage);
      } else {
        // Default demo variants for non-auth users
        return [
          "Good morning, Vanya! Checking your signals...",
          "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing.",
          "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing, and <span class='clickable-tag'>Ryan Petersen</span> is on today's TBPN stream.",
          "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing, <span class='clickable-tag'>Ryan Petersen</span> is on today's TBPN stream, and your July 30 call with <span class='clickable-tag'>The Residency</span> set deliverables."
        ];
      }
    }
  }, [demoMessage, userEmail, wrapSummary, createWrapVariants]);

  // Memoize variants to prevent render loops
  const variants = useMemo(() => {
    return getMessageVariants();
  }, [demoMessage, userEmail, wrapSummary, createWrapVariants]);

  useEffect(() => {
    const splitIndex = 3;
    // Only apply stacked cards for authenticated users with long wrap summaries
    if (userEmail && variants.length > splitIndex) {
      setVisibleVariants(variants.slice(0, splitIndex));
      const fullText = variants[variants.length - 1];
      const visibleText = variants[splitIndex - 1];
      // A simple substring might cut in the middle of a word or tag.
      // It's better to find the end of the visibleText in fullText.
      const splitPoint = fullText.indexOf(visibleText) + visibleText.length;
      setOverflowText(fullText.substring(splitPoint));
    } else {
      setVisibleVariants(variants);
      setOverflowText('');
    }
  }, [variants, userEmail]);

  // Cycle through variants with pause
  useEffect(() => {
    if (isAnimationComplete) return; // Don't run animation again if complete

    const config = ANIMATION_CONFIG.welcome;
    const delay = variantIndex === 0 ? config.firstDelay : config.subsequentDelay;
    const timer = setTimeout(() => {
      if (variantIndex < visibleVariants.length - 1) {
        setShowDiff(true);
        setVariantIndex(prev => prev + 1);
        setTimeout(() => setShowDiff(false), config.diffDuration);
      } else {
        // Animation complete
        setIsAnimationComplete(true); // Set completion flag
        if (!userEmail && !demoMessage) {
          // For regular non-auth users (default demo variants), close after delay
          setTimeout(onClose, 3000);
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [variantIndex, visibleVariants.length, onClose, userEmail, demoMessage, isAnimationComplete]);

  return (
    <div style={{ position: 'relative' }}>
      {overflowText && (
        <div
          className="animated-header-window back-card"
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            zIndex: initialZIndex - 1,
            background: '#e0e0e0',
            border: '2px solid #000',
          }}
        >
          <div className="window-content">
            <p className="main-text" dangerouslySetInnerHTML={{ __html: overflowText }} />
          </div>
        </div>
      )}
      <DraggableWindow
        id={id}
        onBringToFront={onBringToFront}
        initialZIndex={initialZIndex}
        initialPosition={initialPosition}
        className="animated-header-window front-card" // Re-use header styles
      >
        <div className="window-content">
          <p className="main-text">
            <MessageDiff
              oldContent={variantIndex === 0 ? '' : visibleVariants[variantIndex - 1] || ''}
              newContent={visibleVariants[variantIndex] || ''}
              showDiff={showDiff}
            />
          </p>
        </div>
      </DraggableWindow>
      <style jsx>{`
        .main-text :global(.diff-highlight) {
          background-color: #ffeb3b;
          padding: 2px 4px;
          border-radius: 3px;
          transition: background-color 0.8s ease;
        }
        .back-card .window-content {
          padding: 20px;
        }
        .back-card .main-text {
          font-size: 14px;
          font-family: 'Geneva', sans-serif;
          color: #333;
          text-align: left;
        }
      `}</style>
    </div>
  );
};
};

export default DemoWelcomeWindow;