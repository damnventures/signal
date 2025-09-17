"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import DraggableWindow from './DraggableWindow';
import { createMessageVariants, MessageDiff, ANIMATION_CONFIG } from './MessageAnimation';

interface AnimatedHeaderProps {
  id: string;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  initialPosition: { x: number; y: number };
  onLoadingComplete: () => void;
  className?: string;
  responseMessage?: string;
  onResponseComplete?: () => void;
  isAuthenticated?: boolean;
}

const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  id,
  onBringToFront,
  initialZIndex,
  initialPosition,
  onLoadingComplete,
  className,
  responseMessage,
  onResponseComplete,
  isAuthenticated = false,
}) => {
  const [variantIndex, setVariantIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [showingResponse, setShowingResponse] = useState(false);
  const [responseVariants, setResponseVariants] = useState<string[]>([]);
  const [currentResponseVariant, setCurrentResponseVariant] = useState(0);
  const [streamingResponse, setStreamingResponse] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: 'auto', height: 'auto' });
  const [isAnimatingSize, setIsAnimatingSize] = useState(false);
  const measureRef = useRef<HTMLDivElement | null>(null);

  const variants = isAuthenticated
    ? ["Ready to analyze your content."]
    : [
        "Welcome to my humble abode. I am Craig, your personal AI assistant.",
        "Welcome to my humble abode. I am Craig, your personal AI assistant. You can try to log in by convincing me you're worthy. Or, you can ask me any question about Vanya's demo content.",
        "Welcome to my humble abode. I am Craig, your personal AI assistant. You can try to log in by convincing me you're worthy. Or, you can ask me any question about Vanya's demo content. Alternatively, you can just say 'demo' to see an automated version of what I can do.",
        "Welcome to my humble abode. I am Craig, your personal AI assistant. You can try to log in by convincing me you're worthy. Or, you can ask me any question about Vanya's demo content. Alternatively, you can just say 'demo' to see an automated version of what I can do. Once you're in, you'll be able to add your own content. But first, you have to prove your worth."
      ];

  useEffect(() => {
    if (responseMessage && loadingComplete && !showingResponse) {
      setShowingResponse(true);
      setStreamingResponse(true);
      const variants = createMessageVariants(responseMessage);
      setResponseVariants(variants);
      setCurrentResponseVariant(0);
      setShowDiff(true);
      setTimeout(() => setShowDiff(false), ANIMATION_CONFIG.header.diffDuration);
    }
  }, [responseMessage, loadingComplete, showingResponse]);

  useEffect(() => {
    if (!streamingResponse || responseVariants.length === 0) return;

    const delay = currentResponseVariant === 0
      ? ANIMATION_CONFIG.header.firstDelay
      : ANIMATION_CONFIG.header.subsequentDelay;

    const timer = setTimeout(() => {
      if (currentResponseVariant < responseVariants.length - 1) {
        setShowDiff(true);
        setCurrentResponseVariant(prev => prev + 1);
        setTimeout(() => setShowDiff(false), ANIMATION_CONFIG.header.diffDuration);
      } else {
        setStreamingResponse(false);
        if (onResponseComplete) {
          onResponseComplete();
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [currentResponseVariant, responseVariants, streamingResponse, onResponseComplete]);

  useEffect(() => {
    if (showingResponse) return;

    const delay = variantIndex === 0
      ? ANIMATION_CONFIG.welcome.firstDelay
      : ANIMATION_CONFIG.welcome.subsequentDelay;

    const timer = setTimeout(() => {
      if (variantIndex < variants.length - 1) {
        setShowDiff(true);
        setVariantIndex(prev => prev + 1);
        setTimeout(() => setShowDiff(false), ANIMATION_CONFIG.welcome.diffDuration);
      } else {
        setLoadingComplete(true);
        onLoadingComplete();
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [variantIndex, onLoadingComplete, variants.length, showingResponse]);

  const measureContentAndResize = useCallback((content: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.padding = '30px 30px 30px 30px';
    tempDiv.style.fontSize = '18px';
    tempDiv.style.fontFamily = "'Geneva', sans-serif";
    tempDiv.style.lineHeight = '1.4';
    tempDiv.style.textAlign = 'center';
    tempDiv.style.color = '#000000';
    tempDiv.style.maxWidth = '480px';
    tempDiv.style.minWidth = '280px';
    tempDiv.style.wordWrap = 'break-word';
    document.body.appendChild(tempDiv);

    const width = Math.max(320, Math.min(480, Math.ceil(tempDiv.scrollWidth + 60)));
    const height = Math.ceil(tempDiv.scrollHeight + 20);
    document.body.removeChild(tempDiv);

    setIsAnimatingSize(true);
    setWindowDimensions({
      width: `${width}px`,
      height: `${height}px`
    });

    setTimeout(() => setIsAnimatingSize(false), 500);

    setDimensions({ width, height });
  }, []);

  useEffect(() => {
    let contentToMeasure = '';
    if (showingResponse && responseVariants.length > 0) {
      contentToMeasure = responseVariants[currentResponseVariant];
    } else if (!showingResponse && variants.length > 0) {
      contentToMeasure = variants[variantIndex];
    }

    if (contentToMeasure) {
      measureContentAndResize(contentToMeasure);
    }
  }, [variantIndex, currentResponseVariant, showingResponse, responseVariants, variants, measureContentAndResize]);

  const getFinalContent = () => {
    if (variantIndex === variants.length - 1 && loadingComplete) {
      const finalContent = variants[variantIndex].replace(
        /<span class=['"]clickable-tag['"]>Reducto AI<\/span>/,
        '<span class="clickable-tag selected">Reducto AI</span>'
      );
      return <span dangerouslySetInnerHTML={{ __html: finalContent }} />;
    }
    return null;
  };

  return (
    <DraggableWindow
      id={id}
      onBringToFront={onBringToFront}
      initialZIndex={initialZIndex}
      initialPosition={initialPosition}
      style={{
        pointerEvents: loadingComplete ? 'auto' : 'none',
        width: windowDimensions.width,
        height: windowDimensions.height,
        transition: isAnimatingSize ? 'width 0.4s cubic-bezier(0.4, 0.0, 0.2, 1), height 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)' : 'none',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
      className={className}
    >
      <div className="window-content">
        <div>
          <div
            ref={measureRef}
            style={{
              position: 'absolute',
              visibility: 'hidden',
              padding: '0 8px',
              fontSize: '24px',
              fontFamily: "'Geneva', sans-serif",
            }}
          />
          <p className="main-text">
            {showingResponse && responseMessage ? (
              responseVariants.length > 0 ? (
                <MessageDiff
                  oldContent={currentResponseVariant === 0 ? '' : responseVariants[currentResponseVariant - 1] || ''}
                  newContent={responseVariants[currentResponseVariant] || ''}
                  showDiff={showDiff}
                />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: responseMessage }} />
              )
            ) : loadingComplete && variantIndex === variants.length - 1 ? (
              getFinalContent()
            ) : (
              <MessageDiff
                oldContent={variantIndex === 0 ? '' : variants[variantIndex - 1] || ''}
                newContent={variants[variantIndex] || ''}
                showDiff={showDiff}
              />
            )}
          </p>
        </div>
      </div>
    </DraggableWindow>
  );
};

export default AnimatedHeader;