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
  const contentRef = useRef<HTMLParagraphElement>(null);

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

  useEffect(() => {
    // Only use card overflow for very long messages (>400 chars in final variant)
    const finalVariant = variants[variants.length - 1] || '';
    const isVeryLong = finalVariant.length > 400;
    const splitIndex = 3;

    if (userEmail && isVeryLong && variants.length > splitIndex) {
      setVisibleVariants(variants.slice(0, splitIndex));
      const fullText = variants[variants.length - 1];
      const visibleText = variants[splitIndex - 1];
      const splitPoint = fullText.indexOf(visibleText) + visibleText.length;
      setOverflowText(fullText.substring(splitPoint));
    } else {
      setVisibleVariants(variants);
      setOverflowText('');
    }
  }, [variants, userEmail]);

  useEffect(() => {
    if (isAnimationComplete) return;

    const config = ANIMATION_CONFIG.welcome;
    const delay = variantIndex === 0 ? config.firstDelay : config.subsequentDelay;
    const timer = setTimeout(() => {
      if (variantIndex < visibleVariants.length - 1) {
        setShowDiff(true);
        setVariantIndex(prev => prev + 1);
        setTimeout(() => setShowDiff(false), config.diffDuration);
      } else {
        setIsAnimationComplete(true);
        if (!userEmail && !demoMessage) {
          setTimeout(onClose, 3000);
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [variantIndex, visibleVariants.length, onClose, userEmail, demoMessage, isAnimationComplete]);

  return (
    <DraggableWindow
      id={id}
      onBringToFront={onBringToFront}
      initialZIndex={initialZIndex}
      initialPosition={initialPosition}
      className="animated-header-window"
    >
      <div style={{ position: 'relative' }}>
        {overflowText && (
          <div className="back-card" style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            zIndex: -1,
            width: '100%',
            padding: '20px',
            background: '#e0e0e0',
            border: '2px solid #000',
          }}>
            <div className="window-content">
              <p className="main-text" dangerouslySetInnerHTML={{ __html: overflowText }} />
            </div>
          </div>
        )}
        <div className="front-card">
          <div className="window-content">
            <p className="main-text" ref={contentRef}>
              <MessageDiff
                oldContent={variantIndex === 0 ? '' : visibleVariants[variantIndex - 1] || ''}
                newContent={visibleVariants[variantIndex] || ''}
                showDiff={showDiff}
              />
            </p>
          </div>
        </div>
      </div>
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
    </DraggableWindow>
  );
};

export default DemoWelcomeWindow;