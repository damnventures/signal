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
  const [windowDimensions, setWindowDimensions] = useState({ width: 'auto', height: 'auto' });
  const [isAnimatingSize, setIsAnimatingSize] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
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

  const measureContentAndResize = useCallback((content: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.padding = '30px'; // Match global window-content padding
    tempDiv.style.fontSize = '14px'; // Match welcome window font-size
    tempDiv.style.fontFamily = "'Geneva', sans-serif";
    tempDiv.style.lineHeight = '1.4';
    tempDiv.style.wordWrap = 'break-word';
    document.body.appendChild(tempDiv);

    // Get natural content size
    const naturalWidth = tempDiv.scrollWidth;
    const naturalHeight = tempDiv.scrollHeight;

    // Smart sizing based on content length
    const cleanText = content.replace(/<[^>]+>/g, '').trim();
    const isShortMessage = cleanText.length < 20; // "thinking" = 8 chars

    let width, maxWidth;
    if (isShortMessage) {
      // For short messages like "thinking", use minimal width
      maxWidth = 200;
      width = Math.max(120, Math.min(maxWidth, naturalWidth + 60)); // Account for 30px padding each side
    } else {
      // For longer messages, use more generous sizing like welcome window
      maxWidth = 500;
      width = Math.max(180, Math.min(maxWidth, naturalWidth + 60)); // Account for 30px padding each side
    }

    const height = Math.max(80, naturalHeight + 60); // Account for 30px padding top/bottom

    document.body.removeChild(tempDiv);

    console.log('[HeaderMessageWindow] Sizing calculation:', {
      content: cleanText.substring(0, 50) + (cleanText.length > 50 ? '...' : ''),
      fullLength: cleanText.length,
      isShortMessage,
      naturalWidth,
      naturalHeight,
      calculatedWidth: width,
      calculatedHeight: height
    });

    setIsAnimatingSize(true);
    setWindowDimensions({
      width: `${width}px`,
      height: `${height}px`
    });

    setTimeout(() => {
      setIsAnimatingSize(false);
    }, 400); // Faster animation like welcome window
  }, []);

  // Removed redundant useEffect that was causing infinite loop
  // Resizing is now handled in the message change effect below

  useEffect(() => {
    if (message) {
      console.log('[HeaderMessageWindow] New message received, starting clear animation');
      // Step 1: Clear current content
      setIsClearing(true);
      setAnimationReady(false);
      setVariantIndex(0);
      setShowDiff(false);

      // Step 2: Resize window for new content and start animation
      setTimeout(() => {
        const currentVariants = getMessageVariants();
        // Start with the first variant
        const contentToMeasure = currentVariants[0] || message;
        measureContentAndResize(contentToMeasure);

        setIsClearing(false);
        setAnimationReady(true);
        console.log('[HeaderMessageWindow] Ready to start animation');
      }, 100); // Brief clear period
    }
  }, [message, measureContentAndResize]); // Remove variants from dependencies to break the loop

  useEffect(() => {
    // Only start animation when ready and not clearing
    if (!animationReady || isClearing || variants.length === 0) return;

    const config = ANIMATION_CONFIG.header;
    const delay = variantIndex === 0 ? config.firstDelay : config.subsequentDelay;
    const timer = setTimeout(() => {
      if (variantIndex < variants.length - 1) {
        setShowDiff(true);
        const nextIndex = variantIndex + 1;
        setVariantIndex(nextIndex);

        // Resize window for the new content
        setTimeout(() => {
          const newContent = variants[nextIndex] || '';
          measureContentAndResize(newContent);
        }, config.diffDuration / 2); // Resize halfway through diff animation

        setTimeout(() => setShowDiff(false), config.diffDuration);
      } else {
        console.log('[HeaderMessageWindow] Animation complete');
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [variantIndex, variants.length, onClose, animationReady, isClearing, variants, measureContentAndResize]);

  if (!message) {
    return null;
  }

  return (
    <DraggableWindow
      id={id}
      onBringToFront={onBringToFront}
      initialZIndex={initialZIndex}
      initialPosition={initialPosition}
      style={{
        width: windowDimensions.width,
        height: windowDimensions.height,
        transition: isAnimatingSize ? 'width 0.4s cubic-bezier(0.4, 0.0, 0.2, 1), height 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)' : 'none',
      }}
      className="animated-header-window" // Use the same class as DemoWelcomeWindow
    >
      <div className="window-content">
        <p className="main-text">
          {isClearing ? (
            '' // Empty during clear
          ) : (
            <MessageDiff
              oldContent={variantIndex === 0 ? '' : variants[variantIndex - 1] || ''}
              newContent={variants[variantIndex] || ''}
              showDiff={showDiff}
            />
          )}
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
  );
};

export default HeaderMessageWindow;