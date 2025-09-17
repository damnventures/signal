"use client";

import React from 'react';

// Shared utility for progressive message animation
export function createMessageVariants(message: string): string[] {
  if (!message || message.trim() === '') {
    return ["Loading..."];
  }

  // Split by sentences and rebuild progressively - handle multiple patterns
  let sentences = message.split(/\. (?=[A-Z])/);

  // If we only got 1 sentence, try alternative splitting patterns for structured content
  if (sentences.length === 1) {
    // Try splitting on numbered lists or bullet points
    const listPattern = /(?=\n\n\d+\.|\n\n•|\n\n-)/;
    const listSplit = message.split(listPattern);
    if (listSplit.length > 1) {
      sentences = listSplit.filter(s => s.trim());
    }
  }

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