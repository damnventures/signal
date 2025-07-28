"use client";

import React, { useState, useEffect, useCallback } from 'react';
import DraggableWindow from './components/DraggableWindow';

interface Highlight {
  title: string;
  setup: string;
  quote: string;
  whyItMatters: string;
}

const HomePage = () => {
  const [capsuleContent, setCapsuleContent] = useState<string>("");
  const [highlightsData, setHighlightsData] = useState<Highlight[]>([]);
  const [cardZIndexes, setCardZIndexes] = useState<Record<string, number>>({});
  const [nextZIndex, setNextZIndex] = useState(1);

  const parseHighlights = useCallback((text: string): Highlight[] => {
    console.log('[parseHighlights] Raw text to parse:', text);
    const highlights: Highlight[] = [];
    const highlightBlocks = text.split('---').filter(block => block.trim() !== '');

    console.log('[parseHighlights] Number of highlight blocks found:', highlightBlocks.length);

    highlightBlocks.forEach((block, index) => {
      console.log(`[parseHighlights] Processing block ${index}:`, block);
      const subTitleMatch = block.match(/\*\*Title:\s*([\s\S]*?)\s*\*\*Setup:/);
      const setupMatch = block.match(/\*\*Setup:\s*([\s\S]*?)\s*\*\*Quote:/);
      const quoteMatch = block.match(/\*\*Quote:\s*([\s\S]*?)\s*\*\*Why it matters:/);
      const whyItMattersMatch = block.match(/\*\*Why it matters:\s*([\s\S]*?)(?:\n\n---\n\n|\s*$)/);

      if (subTitleMatch && setupMatch && quoteMatch && whyItMattersMatch) {
        const newHighlight = {
          title: subTitleMatch[1].trim().replace(/\*\*/g, ''),
          setup: setupMatch[1].trim(),
          quote: quoteMatch[1].trim(),
          whyItMatters: whyItMattersMatch[1].trim(),
        };
        highlights.push(newHighlight);
        console.log(`[parseHighlights] Successfully parsed highlight ${index}:`, newHighlight);
      } else {
        console.warn(`[parseHighlights] Failed to parse block ${index}. Missing matches.`);
      }
    });
    console.log('[parseHighlights] Final parsed highlights:', highlights);
    return highlights;
  }, []);

  useEffect(() => {
    const fetchCapsuleContent = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000';
        const apiUrl = `${baseUrl}/api/capsule-signal`;

        console.log(`[HomePage] Attempting to fetch from: ${apiUrl}`);

        const response = await fetch(apiUrl, {
          cache: 'no-store',
          next: { revalidate: 0 },
        });

        console.log(`[HomePage] Received response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[HomePage] Failed to fetch capsule signal: ${response.status} ${response.statusText} - ${errorText}`);
          throw new Error(`Failed to fetch capsule signal: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const fetchedContent = data.highlights || data.signal || JSON.stringify(data, null, 2);
        setCapsuleContent(fetchedContent);

        if (data.highlights) {
          const parsed = parseHighlights(data.highlights);
          setHighlightsData(parsed);
          console.log('[HomePage] Highlights data set:', parsed);
          const initialZIndexes: Record<string, number> = {};
          initialZIndexes['header'] = 1;
          parsed.forEach((_, index) => {
            initialZIndexes[`highlight-${index}`] = index + 2;
          });
          setCardZIndexes(initialZIndexes);
          setNextZIndex(parsed.length + 2);
        }

        console.log(`[HomePage] Successfully fetched capsule content.`);
      } catch (error: any) {
        console.error(`[HomePage] Error fetching capsule content: ${error.message}`);
        setCapsuleContent('Unable to load capsule content. Please try again later.');
      }
    };

    fetchCapsuleContent();
  }, [parseHighlights]);

  const handleBringToFront = useCallback((id: string) => {
    setCardZIndexes(prevZIndexes => ({
      ...prevZIndexes,
      [id]: nextZIndex,
    }));
    setNextZIndex(prev => prev + 1);
  }, [nextZIndex]);

  const calculateInitialPosition = useCallback((index: number) => {
    const offset = index * 15; // 15px offset for each card
    // Simple centering logic, can be improved for more precise centering
    const centerX = window.innerWidth / 2 - (672 / 2); // Assuming max-width of 672px
    const centerY = window.innerHeight / 2 - (300 / 2); // Approximate height
    return { x: centerX + offset, y: centerY + offset };
  }, []);

  const renderMarkdown = useCallback((text: string) => {
    // Replace **text** or ***text*** with <strong>text</strong>
    const boldedText = text.replace(/\*{2,3}(.*?)\*{2,3}/g, '<strong>$1</strong>');
    return <span dangerouslySetInnerHTML={{ __html: boldedText }} />;
  }, []);

  return (
    <main className="main-container">
      {capsuleContent === "" ? (
        <p>Loading capsule content...</p>
      ) : (
        <>
          <DraggableWindow
            id="header"
            onBringToFront={handleBringToFront}
            initialZIndex={cardZIndexes['header'] || 1}
            initialPosition={{ x: 16, y: 16 }} // Top-left position
          >
            <div className="window-content">
              <p className="main-text">Good morning, Vanya</p>
            </div>
          </DraggableWindow>

          {highlightsData.length === 0 && !capsuleContent.startsWith('Unable') && (
            <p>No highlights found or parsing failed.</p>
          )}

          {highlightsData.map((highlight, index) => (
            <DraggableWindow
              key={`highlight-${index}`}
              id={`highlight-${index}`}
              onBringToFront={handleBringToFront}
              initialZIndex={cardZIndexes[`highlight-${index}`] || index + 2}
              initialPosition={calculateInitialPosition(index + 1)}
            >
              <div className="window-content">
                <h2 className="main-heading">{highlight.title}</h2>
                <p className="main-text"><strong>Setup:</strong> {renderMarkdown(highlight.setup)}</p>
                <p className="main-text"><strong>Quote:</strong> {renderMarkdown(highlight.quote)}</p>
                <p className="main-text"><strong>Why it matters:</strong> {renderMarkdown(highlight.whyItMatters)}</p>
              </div>
            </DraggableWindow>
          ))}
        </>
      )}
    </main>
  );
};

export default HomePage;
