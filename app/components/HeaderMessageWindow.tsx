"use client";

import React, { useState, useEffect, useCallback } from 'react';
import DraggableWindow from './DraggableWindow';

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

  // Helper function to break text into sentence-based variants like welcome window
  const createMessageVariants = useCallback((msg: string): string[] => {
    // Split by sentences and rebuild progressively
    const sentences = msg.split(/\. (?=[A-Z])/);
    const variants: string[] = [];
    let currentText = '';

    sentences.forEach((sentence, index) => {
      if (index === 0) {
        currentText = sentence + (sentence.endsWith('.') ? '' : '.');
      } else {
        currentText += ' ' + sentence + (sentence.endsWith('.') ? '' : '.');
      }
      variants.push(currentText);
    });

    return variants.length > 1 ? variants : [msg];
  }, []);

  const getMessageVariants = () => {
    if (!message || message.trim() === '') {
      return ["Loading..."];
    }

    // Clean HTML tags for sentence splitting but preserve for display
    const cleanMessage = message.replace(/<[^>]+>/g, '');

    // For short messages, just show as-is
    if (cleanMessage.length < 50) {
      return [message];
    }

    // For longer messages, create progressive variants
    return createMessageVariants(cleanMessage).map((variant, index) => {
      // For the first variant, return as-is, for others we need to reconstruct with HTML
      if (index === 0) {
        // Find the first sentence in the original message
        const firstSentence = message.split(/\. (?=[A-Z])/)[0];
        return firstSentence + (firstSentence.endsWith('.') ? '' : '.');
      }
      // For subsequent variants, we'll use the clean version for now
      // In a more sophisticated implementation, we'd preserve HTML through the splitting
      return variant;
    });
  };

  const variants = getMessageVariants();

  // Diff component for highlighting changes (similar to welcome window)
  interface Segment {
    text: string;
    isDiff: boolean;
  }

  const Diff = ({ oldContent, newContent, showDiff }: { oldContent: string; newContent: string; showDiff: boolean }) => {
    const segments: Segment[] = [];
    const oldText = oldContent.replace(/<[^>]+>/g, '') || "";
    const newText = newContent.replace(/<[^>]+>/g, '') || "";
    const maxLength = Math.max(oldText.length, newText.length);
    let currentSegment: Segment = { text: "", isDiff: false };

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

    // For HTML content, we'll return it directly with diff highlighting
    let resultHtml = newContent;
    if (showDiff && segments.some(s => s.isDiff)) {
      // Simple approach: wrap the entire new content in diff highlight if there are changes
      resultHtml = `<span class="diff-highlight">${newContent}</span>`;
    }

    return <span dangerouslySetInnerHTML={{ __html: resultHtml }} />;
  };

  // Reset animation when new message arrives
  useEffect(() => {
    if (message) {
      console.log('[HeaderMessageWindow] New message received, restarting animation:', message);
      setVariantIndex(0);
      setShowDiff(false);
    }
  }, [message]);

  // Cycle through variants with timing similar to welcome window
  useEffect(() => {
    const delay = variantIndex === 0 ? 1000 : 1200; // Slightly faster than welcome window
    const timer = setTimeout(() => {
      if (variantIndex < variants.length - 1) {
        setShowDiff(true);
        setVariantIndex(prev => prev + 1);
        setTimeout(() => setShowDiff(false), 800);
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
          <Diff
            oldContent={variantIndex === 0 ? '' : variants.slice(0, variantIndex).join(' ')}
            newContent={variants.slice(0, variantIndex + 1).join(' ')}
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