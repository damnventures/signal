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

  const getMessageVariants = () => {
    if (!message || message.trim() === '') {
      return ["Loading..."];
    }

    // For short messages, just show as-is
    const cleanLength = message.replace(/<[^>]+>/g, '').length;
    if (cleanLength < 50) {
      return [message];
    }

    // For longer messages, create progressive variants using shared utility
    return createMessageVariants(message);
  };

  const variants = getMessageVariants();


  // Reset animation when new message arrives
  useEffect(() => {
    if (message) {
      console.log('[HeaderMessageWindow] New message received, restarting animation:', message);
      setVariantIndex(0);
      setShowDiff(false);
    }
  }, [message]);

  // Cycle through variants with shared timing configuration
  useEffect(() => {
    const config = ANIMATION_CONFIG.header;
    const delay = variantIndex === 0 ? config.firstDelay : config.subsequentDelay;
    const timer = setTimeout(() => {
      if (variantIndex < variants.length - 1) {
        setShowDiff(true);
        setVariantIndex(prev => prev + 1);
        setTimeout(() => setShowDiff(false), config.diffDuration);
      } else {
        // Animation complete - auto-close after delay
        setTimeout(() => {
          console.log('[HeaderMessageWindow] Animation complete, auto-closing');
          onClose();
        }, 3000);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [variantIndex, variants.length, onClose]);

  if (!message) {
    return null;
  }

  return (
    <DraggableWindow
      id={id}
      onBringToFront={onBringToFront}
      initialZIndex={initialZIndex}
      initialPosition={initialPosition}
      className="header-message-window"
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
        .header-message-window {
          background: #ffffff;
          border: 2px solid #000000;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 13px;
          min-width: 300px;
          max-width: 500px;
          box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.25);
        }

        .window-content {
          padding: 16px;
          background: #ffffff;
          min-height: 60px;
          display: flex;
          align-items: center;
        }

        .main-text {
          margin: 0;
          line-height: 1.4;
          color: #000000;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 14px;
        }

        .main-text :global(a) {
          color: #007AFF;
          text-decoration: underline;
        }

        .main-text :global(.thinking-indicator) {
          opacity: 0.7;
          font-style: italic;
        }

        .main-text :global(.loading-dots::after) {
          content: "";
          animation: loadingDots 1.5s infinite;
        }

        @keyframes loadingDots {
          0%, 20% { content: ""; }
          40% { content: "."; }
          60% { content: ".."; }
          80%, 100% { content: "..."; }
        }


        .main-text :global(.clickable-tag) {
          background: #e0e0e0;
          border: 1px solid #000000;
          padding: 2px 4px;
          font-weight: bold;
          cursor: pointer;
          text-decoration: none;
          color: #000000;
        }

        .main-text :global(.clickable-tag:hover) {
          background: #d0d0d0;
        }

        .main-text :global(.clickable-tag.selected) {
          background: #000000;
          color: #ffffff;
        }
      `}</style>
    </DraggableWindow>
  );
};

export default HeaderMessageWindow;