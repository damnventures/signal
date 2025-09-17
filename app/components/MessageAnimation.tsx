"use client";

import React from 'react';

// Shared utility for progressive message animation
export function createMessageVariants(message: string): string[] {
  if (!message || message.trim() === '') {
    return ["Loading..."];
  }

  // For wrap summaries, split on natural breakpoints: ", and " or ", "
  // This creates smaller, more digestible chunks
  let splitPoints: string[] = [];

  if (message.includes(', and ')) {
    splitPoints = message.split(/, and /);
  } else if (message.includes(', ')) {
    splitPoints = message.split(/, /);
  } else if (message.includes('. ')) {
    splitPoints = message.split(/\. (?=[A-Z])/);
  } else {
    // Single long sentence - split at word boundaries every ~50-60 chars
    const words = message.split(' ');
    const targetLength = 50;
    let currentChunk = '';

    words.forEach(word => {
      if (currentChunk.length + word.length + 1 > targetLength && currentChunk.length > 0) {
        splitPoints.push(currentChunk.trim());
        currentChunk = word;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + word;
      }
    });
    if (currentChunk) {
      splitPoints.push(currentChunk.trim());
    }
  }

  // Build progressive variants by accumulating split points
  const variants: string[] = [];

  splitPoints.forEach((_, index) => {
    const chunks = splitPoints.slice(0, index + 1);
    let combined = '';

    chunks.forEach((chunk, i) => {
      if (i === 0) {
        combined = chunk;
      } else if (i === chunks.length - 1 && message.includes(', and ')) {
        combined += ' and ' + chunk;
      } else {
        combined += ', ' + chunk;
      }
    });

    // Ensure proper ending punctuation
    if (!combined.endsWith('.') && !combined.endsWith('!') && !combined.endsWith('?')) {
      combined += '.';
    }

    variants.push(combined);
  });

  return variants.length > 1 ? variants : [message];
}

// Shared diff highlighting component
interface Segment {
  text: string;
  isDiff: boolean;
}

interface DiffProps {
  oldContent: string;
  newContent: string;
  showDiff: boolean;
}

export const MessageDiff: React.FC<DiffProps> = ({ oldContent, newContent, showDiff }) => {
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

  // Reconstruct HTML with diff highlighting
  const renderHtml = () => {
    let resultHtml = newContent;

    // Apply diff highlighting
    if (showDiff) {
      let currentHtmlIndex = 0;
      segments.forEach(segment => {
        const plainTextSegment = segment.text;
        const plainTextIndex = newText.indexOf(plainTextSegment, currentHtmlIndex);

        if (plainTextIndex !== -1 && segment.isDiff) {
          let tempPlain = '';
          let htmlIdx = 0;
          while(tempPlain.length < plainTextIndex && htmlIdx < newContent.length) {
            if (newContent[htmlIdx] === '<') {
              while(newContent[htmlIdx] !== '>' && htmlIdx < newContent.length) {
                htmlIdx++;
              }
            } else {
              tempPlain += newContent[htmlIdx];
            }
            htmlIdx++;
          }
          const actualHtmlIndex = htmlIdx - 1;

          const segmentHtml = newContent.substring(actualHtmlIndex, actualHtmlIndex + plainTextSegment.length + (newContent.substring(actualHtmlIndex + plainTextSegment.length).match(/^<[^>]+>/) || [''])[0].length);

          resultHtml = resultHtml.replace(segmentHtml, `<span class="diff-highlight">${segmentHtml}</span>`);
        }
        currentHtmlIndex = plainTextIndex + plainTextSegment.length;
      });
    }

    return <span dangerouslySetInnerHTML={{ __html: resultHtml }} />;
  };

  return renderHtml();
};

// Animation configuration
export const ANIMATION_CONFIG = {
  welcome: {
    firstDelay: 2000,
    subsequentDelay: 1500,
    diffDuration: 1000
  },
  header: {
    firstDelay: 1000,
    subsequentDelay: 1200,
    diffDuration: 800
  }
};