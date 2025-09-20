"use client";

import React from 'react';

// Shared utility for progressive message animation
export function createMessageVariants(message: string): string[] {
  if (!message || message.trim() === '') {
    return ["Loading..."];
  }

  // Check if this looks like a wrap summary with multiple topics
  const hasMultipleTopics = message.includes('\n\n') ||
    (message.includes('Alright, love') && message.split(/[A-Z][a-z]+.*?(?=\s+[A-Z][a-z]+|\s*$)/g).length > 2);

  if (hasMultipleTopics) {
    // For wrap summaries, split into distinct topical cards rather than progressive
    const variants: string[] = [];

    // Try splitting by double newlines first
    const paragraphs = message.split('\n\n').filter(line => line.trim());

    if (paragraphs.length >= 3) {
      // Extract intro/header
      const intro = paragraphs[0];

      // Create separate cards for each main topic (skip intro and conclusion)
      for (let i = 1; i < paragraphs.length - 1; i++) {
        const paragraph = paragraphs[i];
        if (paragraph.trim().length > 30) { // Filter out short paragraphs
          if (i === 1) {
            // First card includes intro
            variants.push(`${intro}\n\n${paragraph}`);
          } else {
            // Subsequent cards are standalone topics
            variants.push(paragraph);
          }
        }
      }

      // Add conclusion as final card if it exists
      const lastParagraph = paragraphs[paragraphs.length - 1];
      if (lastParagraph && lastParagraph.toLowerCase().includes('so there')) {
        variants.push(lastParagraph);
      }
    } else {
      // Fallback: split by major topic sentences
      const sentences = message.split(/(?<=\.)\s+(?=[A-Z][a-z]+\s+(?:are|is|isn't|was|were|can|will|might))/g);

      if (sentences.length > 2) {
        // Group sentences into logical topics (2-3 sentences per card)
        const cardsContent: string[] = [];
        let currentCard = '';

        sentences.forEach((sentence, index) => {
          if (index === 0) {
            currentCard = sentence;
          } else if (currentCard.length < 200 && index < sentences.length - 1) {
            currentCard += ' ' + sentence;
          } else {
            cardsContent.push(currentCard);
            currentCard = sentence;
          }
        });

        if (currentCard) {
          cardsContent.push(currentCard);
        }

        return cardsContent.slice(0, 3); // Max 3 cards
      }
    }

    return variants.length > 0 ? variants : [message];
  }

  // Original progressive approach for other messages
  let sentences = message.split(/\. (?=[A-Z])/);

  // If sentences are too long (>80 chars), try splitting on commas
  const processedSentences: string[] = [];
  sentences.forEach(sentence => {
    if (sentence.length > 80 && sentence.includes(', ')) {
      const parts = sentence.split(', ');
      parts.forEach((part, index) => {
        if (index === 0) {
          processedSentences.push(part + ',');
        } else if (index === parts.length - 1) {
          processedSentences.push(part);
        } else {
          processedSentences.push(part + ',');
        }
      });
    } else {
      processedSentences.push(sentence);
    }
  });

  // Build progressive variants
  const variants: string[] = [];
  let currentText = '';

  processedSentences.forEach((sentence, index) => {
    if (index === 0) {
      currentText = sentence;
      if (!currentText.endsWith('.') && !currentText.endsWith(',')) {
        currentText += '.';
      }
    } else {
      currentText += ' ' + sentence;
      if (index === processedSentences.length - 1 && !currentText.endsWith('.')) {
        currentText += '.';
      }
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