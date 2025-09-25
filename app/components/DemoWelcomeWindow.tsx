"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DraggableWindow from './DraggableWindow';
import { createMessageVariants, MessageDiff, ANIMATION_CONFIG } from './MessageAnimation';

interface DemoWelcomeWindowProps {
  id: string;
  onBringToFront: (id: string) => void;
  initialPosition: { x: number; y: number };
  onClose: () => void;
  wrapSummary?: string | null;
  userEmail?: string;
  demoMessage?: string | null; // For demo users
  cardZIndexes: Record<string, number>;
}

const DemoWelcomeWindow: React.FC<DemoWelcomeWindowProps> = ({
  id,
  onBringToFront,
  initialPosition,
  onClose,
  wrapSummary,
  userEmail,
  demoMessage,
  cardZIndexes,
}) => {
  const [variantIndex, setVariantIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [showSecondCard, setShowSecondCard] = useState(false);
  const [secondCardVariantIndex, setSecondCardVariantIndex] = useState(0);
  const [secondCardShowDiff, setSecondCardShowDiff] = useState(false);

  const variants = useMemo(() => {
    // For authenticated users
    if (userEmail) {
      // If demo message is provided (from demo intent), use that even for authenticated users
      if (demoMessage) {
        return createMessageVariants(demoMessage);
      }
      // Otherwise use their wrap summary or fallback
      if (!wrapSummary || wrapSummary.trim() === '') {
        return ["Analyzing your capsules..."];
      }
      // Ensure we never return empty variants
      const messageVariants = createMessageVariants(wrapSummary);
      return messageVariants.length > 0 ? messageVariants : ["Analyzing your capsules..."];
    } else {
      // For non-authenticated users only
      if (demoMessage) {
        // When demo is running, combine demo message with Vanya's context example
        const demoVariants = createMessageVariants(demoMessage);
        const vanyaExample = [
          "Good morning, Vanya! Checking your signals...",
          "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing.",
          "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing, and <span class='clickable-tag'>Ryan Petersen</span> is on today's TBPN stream.",
          "Good morning, Vanya! YC covered <span class='clickable-tag'>Reducto AI</span>'s memory parsing, <span class='clickable-tag'>Ryan Petersen</span> is on today's TBPN stream, and your July 30 call with <span class='clickable-tag'>The Residency</span> set deliverables."
        ];
        // Combine both: demo message first, then Vanya's example
        return [...demoVariants, ...vanyaExample];
      } else {
        // No demo triggered - show basic Craig welcome (this should be handled by header/other components)
        // This fallback shouldn't normally be reached for non-auth users without demo
        return ["Welcome! Try asking a question to get started."];
      }
    }
  }, [demoMessage, userEmail, wrapSummary]);

  // Determine if we need a second card and where to split
  const { frontCardVariants, secondCardVariants, needsSecondCard } = useMemo(() => {
    const finalVariant = variants[variants.length - 1] || '';

    // Check for section breaks first (like --- dividers)
    const sections = finalVariant.split(/\n\s*---\s*\n/).filter(s => s.trim());

    // If we have clear section breaks, use those for splitting
    if (sections.length > 1) {
      const midPoint = Math.ceil(sections.length / 2);
      const frontSections = sections.slice(0, midPoint);
      const backSections = sections.slice(midPoint);
      const frontContent = frontSections.join('\n\n---\n\n');

      return {
        frontCardVariants: [frontContent],
        secondCardVariants: [backSections.join('\n\n---\n\n')],
        needsSecondCard: true
      };
    }

    // Fall back to sentence-based splitting
    const sentences = finalVariant.split(/\.(?=\s+[A-Z])|\.(?=\s*$)/).filter(s => s.trim());

    // If 2 or fewer sentences, keep in one card (more aggressive splitting)
    if (sentences.length <= 2) {
      return {
        frontCardVariants: variants,
        secondCardVariants: [],
        needsSecondCard: false
      };
    }

    // Split at half the sentences, ensuring we end at a sentence boundary
    const splitSentenceIndex = Math.ceil(sentences.length / 2);
    const frontSentences = sentences.slice(0, splitSentenceIndex);
    const backSentences = sentences.slice(splitSentenceIndex);

    const frontContent = frontSentences.join('.').trim() + '.';

    // Find which variant contains this split point
    let splitVariantIndex = -1;
    for (let i = 0; i < variants.length; i++) {
      if (variants[i].includes(frontContent) || variants[i].length >= frontContent.length) {
        splitVariantIndex = i;
        break;
      }
    }

    if (splitVariantIndex === -1) {
      splitVariantIndex = Math.floor(variants.length / 2);
    }

    const frontVariants = variants.slice(0, splitVariantIndex + 1);
    const remainingVariants = variants.slice(splitVariantIndex + 1);

    // Create second card with remaining content
    const secondCardVariants = remainingVariants.length > 0
      ? remainingVariants.map(variant => {
          // Extract content after the front card's final content
          const frontFinal = frontVariants[frontVariants.length - 1];
          if (variant.length > frontFinal.length) {
            return variant.substring(frontFinal.length).trim();
          }
          return variant;
        })
      : [backSentences.join('.').trim() + '.'];

    return {
      frontCardVariants: frontVariants,
      secondCardVariants: secondCardVariants.filter(v => v.trim()),
      needsSecondCard: true
    };
  }, [variants]);

  // Reset animation states when content changes
  useEffect(() => {
    setShowSecondCard(false);
    setSecondCardVariantIndex(0);
    setSecondCardShowDiff(false);
    setVariantIndex(0);
    setShowDiff(false);
  }, [wrapSummary, demoMessage]);

  // Reset second card state when needsSecondCard changes
  useEffect(() => {
    if (!needsSecondCard) {
      setShowSecondCard(false);
      setSecondCardVariantIndex(0);
      setSecondCardShowDiff(false);
    }
  }, [needsSecondCard]);

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
          initialZIndex={cardZIndexes[`${id}-overflow`] || 99}
          initialPosition={{
            x: initialPosition.x + 40,
            y: initialPosition.y + 20
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
        initialZIndex={cardZIndexes[id] || 100}
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