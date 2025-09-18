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
    tempDiv.style.padding = '16px'; // Match window-content padding
    tempDiv.style.fontSize = '14px';
    tempDiv.style.fontFamily = "'Chicago', 'Lucida Grande', sans-serif";
    tempDiv.style.lineHeight = '1.4';
    tempDiv.style.maxWidth = '500px'; // Match window max-width
    tempDiv.style.minWidth = '150px'; // Set a smaller min-width
    tempDiv.style.wordWrap = 'break-word';
    document.body.appendChild(tempDiv);
    
    const width = Math.max(150, Math.min(500, Math.ceil(tempDiv.scrollWidth + 32))); // Add padding buffer
    const height = Math.ceil(tempDiv.scrollHeight + 32); // Add padding buffer
    document.body.removeChild(tempDiv);
    
    setIsAnimatingSize(true);
    setWindowDimensions({ 
      width: `${width}px`, 
      height: `${height}px` 
    });
    
    setTimeout(() => {
      setIsAnimatingSize(false);
    }, 500); // Match CSS transition duration
  }, []);

  useEffect(() => {
    const contentToMeasure = variants[variantIndex] || '';
    if (contentToMeasure) {
      measureContentAndResize(contentToMeasure);
    }
  }, [variantIndex, variants, measureContentAndResize]);

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
        // Animation complete
        console.log('[HeaderMessageWindow] Animation complete');
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
      style={{
        width: windowDimensions.width,
        height: windowDimensions.height,
        transition: isAnimatingSize ? 'width 0.4s cubic-bezier(0.4, 0.0, 0.2, 1), height 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)' : 'none',
      }}
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

        .main-text :global(.diff-highlight) {
          background-color: #ffeb3b;
          padding: 2px 4px;
          border-radius: 3px;
          transition: background-color 0.8s ease;
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