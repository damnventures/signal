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
  const [showSecondCard, setShowSecondCard] = useState(false);
  const [secondCardVariantIndex, setSecondCardVariantIndex] = useState(0);
  const [secondCardShowDiff, setSecondCardShowDiff] = useState(false);

  const createWrapVariants = useCallback((summary: string): string[] => {
    return createMessageVariants(summary);
  }, []);

  const getMessageVariants = useCallback(() => {
    if (userEmail) {
      if (!wrapSummary || wrapSummary.trim() === '') {
        return ["Analyzing your capsules..."];
      }
      return createWrapVariants(wrapSummary);
    } else {
      if (demoMessage) {
        return createWrapVariants(demoMessage);
      } else {
        return [
          "Good morning, Vanya! Checking your signals...",
          "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing.",
          "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing, and <span class='clickable-tag'>Ryan Petersen</span> is on today's TBPN stream.",
          "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing, <span class='clickable-tag'>Ryan Petersen</span> is on today's TBPN stream, and your July 30 call with <span class='clickable-tag'>The Residency</span> set deliverables."
        ];
      }
    }
  }, [demoMessage, userEmail, wrapSummary, createWrapVariants]);

  const variants = useMemo(() => {
    return getMessageVariants();
  }, [demoMessage, userEmail, wrapSummary, createWrapVariants]);

  // Determine if we need a second card and where to split
  const { frontCardVariants, secondCardVariants, needsSecondCard } = useMemo(() => {
    const FRONT_CARD_LIMIT = 300; // chars limit for front card
    const finalVariant = variants[variants.length - 1] || '';

    if (finalVariant.length <= FRONT_CARD_LIMIT) {
      return {
        frontCardVariants: variants,
        secondCardVariants: [],
        needsSecondCard: false
      };
    }

    // Find the best split point - look for a good break around the limit
    let splitVariantIndex = -1;
    for (let i = 0; i < variants.length; i++) {
      if (variants[i].length > FRONT_CARD_LIMIT) {
        splitVariantIndex = Math.max(0, i - 1);
        break;
      }
    }

    if (splitVariantIndex === -1) {
      splitVariantIndex = Math.floor(variants.length / 2);
    }

    const frontVariants = variants.slice(0, splitVariantIndex + 1);
    const remainingVariants = variants.slice(splitVariantIndex + 1);

    // Create second card variants that continue from where first card ended
    const baseContent = frontVariants[frontVariants.length - 1];
    const secondCardVariants = remainingVariants.map(variant =>
      variant.substring(baseContent.length).trim()
    );

    return {
      frontCardVariants: frontVariants,
      secondCardVariants: secondCardVariants,
      needsSecondCard: true
    };
  }, [variants]);

  useEffect(() => {
    const config = ANIMATION_CONFIG.welcome;
    const delay = variantIndex === 0 ? config.firstDelay : config.subsequentDelay;
    const timer = setTimeout(() => {
      if (variantIndex < frontCardVariants.length - 1) {
        setShowDiff(true);
        setVariantIndex(prev => prev + 1);
        setTimeout(() => setShowDiff(false), config.diffDuration);
      } else {
        // Front card animation complete
        if (needsSecondCard && !showSecondCard) {
          // Show second card after a brief pause
          setTimeout(() => setShowSecondCard(true), 500);
        }

        if (!userEmail && !demoMessage) {
          setTimeout(onClose, 3000);
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [variantIndex, frontCardVariants.length, onClose, userEmail, demoMessage, needsSecondCard, showSecondCard]);

  // Second card animation
  useEffect(() => {
    if (!showSecondCard || secondCardVariants.length === 0) return;

    const config = ANIMATION_CONFIG.welcome;
    const delay = secondCardVariantIndex === 0 ? config.firstDelay : config.subsequentDelay;
    const timer = setTimeout(() => {
      if (secondCardVariantIndex < secondCardVariants.length - 1) {
        setSecondCardShowDiff(true);
        setSecondCardVariantIndex(prev => prev + 1);
        setTimeout(() => setSecondCardShowDiff(false), config.diffDuration);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [secondCardVariantIndex, secondCardVariants.length, showSecondCard]);

  return (
    <>
      {/* Second card - positioned behind first card */}
      {needsSecondCard && showSecondCard && (
        <DraggableWindow
          id={`${id}-overflow`}
          onBringToFront={onBringToFront}
          initialZIndex={initialZIndex - 1}
          initialPosition={{
            x: initialPosition.x + 10,
            y: initialPosition.y + 10
          }}
          className="animated-header-window"
        >
          <div className="window-content">
            <p className="main-text">
              <MessageDiff
                oldContent={secondCardVariantIndex === 0 ? '' : secondCardVariants[secondCardVariantIndex - 1] || ''}
                newContent={secondCardVariants[secondCardVariantIndex] || ''}
                showDiff={secondCardShowDiff}
              />
            </p>
          </div>

          <style jsx>{`
            .main-text :global(.diff-highlight) {
              background-color: #ffeb3b;
              padding: 2px 4px;
              border-radius: 3px;
              transition: background-color 0.8s ease;
            }
          `}</style>
        </DraggableWindow>
      )}

      {/* Main front card - positioned on top */}
      <DraggableWindow
        id={id}
        onBringToFront={onBringToFront}
        initialZIndex={initialZIndex}
        initialPosition={initialPosition}
        className="animated-header-window"
      >
        <div className="window-content">
          <p className="main-text">
            <MessageDiff
              oldContent={variantIndex === 0 ? '' : frontCardVariants[variantIndex - 1] || ''}
              newContent={frontCardVariants[variantIndex] || ''}
              showDiff={showDiff}
            />
          </p>
        </div>

        <style jsx>{`
          .main-text :global(.diff-highlight) {
            background-color: #ffeb3b;
            padding: 2px 4px;
            border-radius: 3px;
            transition: background-color 0.8s ease;
          }
        `}</style>
      </DraggableWindow>
    </>
  );
};

export default DemoWelcomeWindow;