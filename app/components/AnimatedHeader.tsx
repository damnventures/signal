"use client";

import React, { useState, useEffect, useRef } from 'react';
import DraggableWindow from './DraggableWindow';

interface AnimatedHeaderProps {
  id: string;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  initialPosition: { x: number; y: number };
  onLoadingComplete: () => void; // Callback when loading finishes
}

const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  id,
  onBringToFront,
  initialZIndex,
  initialPosition,
  onLoadingComplete,
}) => {
  const [variantIndex, setVariantIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [loadingComplete, setLoadingComplete] = useState(false);
  const measureRef = useRef<HTMLDivElement | null>(null);

  const variants = [
    "Good morning, Vanya! Checking the updates / context",
    "Good morning, Vanya! You confirmed the account issue is resolved.",
    "Good morning, Vanya! You confirmed the account issue is resolved, you can now test the Sunflower Mail 1.0 (233) build on iOS.",
    "Good morning, Vanya! You confirmed the account issue is resolved, you can now test the Sunflower Mail 1.0 (233) build on iOS, and you sent your resignation."
  ];

  // Cycle through variants
  useEffect(() => {
    const initialDelay = setTimeout(() => {
      if (variantIndex < variants.length - 1) {
        const timer = setTimeout(() => {
          setShowDiff(true);
          setVariantIndex(prev => prev + 1);
          setTimeout(() => setShowDiff(false), 1000); // Highlight for 1 second
        }, 2000); // 2-second delay between updates
        return () => clearTimeout(timer);
      } else {
        setLoadingComplete(true);
        onLoadingComplete(); // Notify parent when loading is complete
      }
    }, 2000); // Initial 2-second delay before starting the animation

    return () => clearTimeout(initialDelay);
  }, [variantIndex, onLoadingComplete, variants.length]);

  // Measure dimensions of current variant
  useEffect(() => {
    if (measureRef.current) {
      measureRef.current.textContent = variants[variantIndex];
      const width = Math.ceil(measureRef.current.scrollWidth);
      const height = Math.ceil(measureRef.current.scrollHeight);
      setDimensions({ width, height });
    }
  }, [variantIndex]);

  // Diff component for highlighting changes
  const Diff = ({ oldContent, newContent, showDiff }: { oldContent: string; newContent: string; showDiff: boolean }) => {
    const segments = [];
    const oldText = oldContent || "";
    const newText = newContent || "";
    const maxLength = Math.max(oldText.length, newText.length);
    let currentSegment = { text: "", isDiff: false };

    for (let i = 0; i < maxLength; i++) {
      const oldChar = oldText[i] || "";
      const newChar = newText[i] || "";
      if (oldChar !== newChar) {
        if (!currentSegment.isDiff && currentSegment.text) {
          segments.push({ ...currentSegment });
          currentSegment = { text: "", isDiff: true };
        }
        currentSegment.isDiff = true;
        currentSegment.text += newChar;
      } else {
        if (currentSegment.isDiff && currentSegment.text) {
          segments.push({ ...currentSegment });
          currentSegment = { text: "", isDiff: false };
        }
        currentSegment.text += newChar;
      }
    }
    if (currentSegment.text) {
      segments.push(currentSegment);
    }

    return (
      <>
        {segments.map((segment, index) => (
          <span key={index} className={showDiff && segment.isDiff ? "diff-highlight" : ""}>
            {segment.text}
          </span>
        ))}
      </>
    );
  };

  return (
    <DraggableWindow
      id={id}
      onBringToFront={onBringToFront}
      initialZIndex={initialZIndex}
      initialPosition={initialPosition}
      style={{ pointerEvents: loadingComplete ? 'auto' : 'none' }} // Disable dragging until loading complete
    >
      <div className="window-content">
        <div
          style={{
            width: dimensions.width ? `${dimensions.width}px` : 'auto',
            height: dimensions.height ? `${dimensions.height}px` : 'auto',
            transition: 'width 0.1s ease-out, height 0.1s ease-out',
          }}
        >
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
            {variantIndex > 0 ? (
              <Diff
                oldContent={variants[Math.max(0, variantIndex - 1)]}
                newContent={variants[variantIndex]}
                showDiff={showDiff}
              />
            ) : (
              variants[0]
            )}
          </p>
        </div>
      </div>
    </DraggableWindow>
  );
};

export default AnimatedHeader;