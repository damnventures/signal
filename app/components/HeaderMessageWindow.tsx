"use client";

import React, { useState, useEffect, useCallback } from 'react';
import DraggableWindow from './DraggableWindow';
import { createMessageVariants, MessageDiff, ANIMATION_CONFIG } from './MessageAnimation';

interface HeaderMessageWindowProps {
  id: string;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  initialPosition: { x: number; y: number };
  onClose: () => void;
  message?: string | null;
}

const HeaderMessageWindow: React.FC<HeaderMessageWindowProps> = ({
  id,
  onBringToFront,
  initialZIndex,
  initialPosition,
  onClose,
  message,
}) => {
  const [variantIndex, setVariantIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [animationReady, setAnimationReady] = useState(false);

  const getMessageVariants = () => {
    if (!message || message.trim() === '') {
      return ["Loading..."];
    }

    const cleanLength = message.replace(/<[^>]+>/g, '').length;
    if (cleanLength < 50) {
      return [message];
    }

    return createMessageVariants(message);
  };

  const variants = getMessageVariants();

  // Check if current message is short (like "thinking")
  const isShortMessage = message && message.replace(/<[^>]+>/g, '').trim().length < 20;


  // Removed redundant useEffect that was causing infinite loop
  // Resizing is now handled in the message change effect below

  useEffect(() => {
    if (message) {
      console.log('[HeaderMessageWindow] New message received, starting smooth transition');
      // Step 1: Start content transition (no clearing for smooth resize)
      setAnimationReady(false);
      setVariantIndex(0);
      setShowDiff(false);

      // Step 2: Start animation with smooth transition
      setTimeout(() => {
        setAnimationReady(true);
        console.log('[HeaderMessageWindow] Ready to start animation');
      }, 300); // Longer delay for smooth transition
    }
  }, [message]);

  useEffect(() => {
    // Only start animation when ready
    if (!animationReady || variants.length === 0) return;

    const config = ANIMATION_CONFIG.header;
    const delay = variantIndex === 0 ? config.firstDelay : config.subsequentDelay;
    const timer = setTimeout(() => {
      if (variantIndex < variants.length - 1) {
        setShowDiff(true);
        const nextIndex = variantIndex + 1;
        setVariantIndex(nextIndex);

        setTimeout(() => setShowDiff(false), config.diffDuration);
      } else {
        console.log('[HeaderMessageWindow] Animation complete');
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [variantIndex, variants.length, onClose, animationReady]);

  if (!message) {
    return null;
  }

  return (
    <DraggableWindow
      id={id}
      onBringToFront={onBringToFront}
      initialZIndex={initialZIndex}
      initialPosition={initialPosition}
      className={`animated-header-window ${isShortMessage ? 'short-message' : ''}`}
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

      <style jsx>{`
        .main-text :global(.diff-highlight) {
          background-color: #ffeb3b;
          padding: 2px 4px;
          border-radius: 3px;
          transition: background-color 0.8s ease;
        }
        :global(.short-message) {
          width: auto !important;
          min-width: 120px !important;
          max-width: 200px !important;
          margin-right: 30px !important;
          transition: all 0.4s cubic-bezier(0.4, 0.0, 0.2, 1);
        }
      `}</style>
    </DraggableWindow>
  );
};

export default HeaderMessageWindow;