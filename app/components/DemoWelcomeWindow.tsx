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
  const [displayedMessage, setDisplayedMessage] = useState('');

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


  // Cycle through variants with pause
  // Watch for prop changes (wrap summary arriving) and restart demo-style animation
  useEffect(() => {
    console.log('[DemoWelcomeWindow] wrapSummary changed:', wrapSummary, 'userEmail:', userEmail);
    if (userEmail && wrapSummary) {
      console.log('[DemoWelcomeWindow] Restarting animation with new wrap summary');
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
    const config = ANIMATION_CONFIG.welcome;
    const delay = variantIndex === 0 ? config.firstDelay : config.subsequentDelay;
    const timer = setTimeout(() => {
      if (variantIndex < variants.length - 1) {
        setShowDiff(true);
        setVariantIndex(prev => prev + 1);
        setTimeout(() => setShowDiff(false), config.diffDuration);
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
    setDisplayedMessage(variants[variantIndex] || '');
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
          <MessageDiff
            oldContent={variantIndex === 0 ? '' : variants[variantIndex - 1] || ''}
            newContent={variants[variantIndex] || ''}
            showDiff={showDiff}
          />
        </p>
      </div>
    </DraggableWindow>
  );
};

export default DemoWelcomeWindow;