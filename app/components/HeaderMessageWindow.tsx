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
    tempDiv.style.padding = '30px'; // Match window-content padding
    tempDiv.style.fontSize = '18px'; // Match main-text font-size on desktop
    tempDiv.style.fontFamily = "'Geneva', sans-serif";
    tempDiv.style.lineHeight = '1.4';
    tempDiv.style.maxWidth = '500px';
    tempDiv.style.minWidth = '150px';
    tempDiv.style.wordWrap = 'break-word';
    document.body.appendChild(tempDiv);
    
    const width = Math.max(150, Math.min(500, Math.ceil(tempDiv.scrollWidth + 60))); // Add padding buffer
    const height = Math.ceil(tempDiv.scrollHeight + 60); // Add padding buffer
    document.body.removeChild(tempDiv);
    
    setIsAnimatingSize(true);
    setWindowDimensions({ 
      width: `${width}px`, 
      height: `${height}px` 
    });
    
    setTimeout(() => {
      setIsAnimatingSize(false);
    }, 500);
  }, []);

  useEffect(() => {
    const contentToMeasure = variants[variantIndex] || '';
    if (contentToMeasure) {
      measureContentAndResize(contentToMeasure);
    }
  }, [variantIndex, variants, measureContentAndResize]);

  useEffect(() => {
    if (message) {
      setVariantIndex(0);
      setShowDiff(false);
    }
  }, [message]);

  useEffect(() => {
    const config = ANIMATION_CONFIG.header;
    const delay = variantIndex === 0 ? config.firstDelay : config.subsequentDelay;
    const timer = setTimeout(() => {
      if (variantIndex < variants.length - 1) {
        setShowDiff(true);
        setVariantIndex(prev => prev + 1);
        setTimeout(() => setShowDiff(false), config.diffDuration);
      } else {
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
      className="animated-header-window" // Use the same class as DemoWelcomeWindow
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
      {/* Styles are now inherited from globals.css via animated-header-window and main-text classes */}
    </DraggableWindow>
  );
};

export default HeaderMessageWindow;