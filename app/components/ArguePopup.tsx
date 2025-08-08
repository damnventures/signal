'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { getArguePrompt } from './ArguePrompt';

interface ArguePopupProps {
  isOpen: boolean;
  onClose: () => void;
  capsuleId: string;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
}

const ArguePopup: React.FC<ArguePopupProps> = ({ 
  isOpen, 
  onClose, 
  capsuleId, 
  onBringToFront, 
  initialZIndex 
}) => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState('');
  const [reasoningResponse, setReasoningResponse] = useState('');
  const [error, setError] = useState('');
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [isStreamingComplete, setIsStreamingComplete] = useState(false);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zIndex, setZIndex] = useState(initialZIndex);
  const windowRef = useRef<HTMLDivElement>(null);

  // Calculate initial position (below video, centered)
  useEffect(() => {
    if (isOpen && position.x === 0 && position.y === 0) {
      // Position it more centrally, similar to other windows
      const initialX = (window.innerWidth - 500) / 2; // Center horizontally for a 500px wide window
      const initialY = Math.max(50, (window.innerHeight - 600) / 2); // Center vertically, but at least 50px from top
      setPosition({ x: initialX, y: initialY });
    }
  }, [isOpen, position.x, position.y]);

  // Handle dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!windowRef.current) return;
    
    const rect = windowRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    onBringToFront('argue-popup');
    setZIndex(initialZIndex + 1000); // Bring to front immediately
    e.preventDefault();
  }, [onBringToFront, initialZIndex]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }
  
    setIsLoading(true);
    setError('');
    setChatResponse('');
    setReasoningResponse('');
    setIsReasoningExpanded(false);
    setIsStreamingComplete(false);
  
    try {
      const contextResponse = await fetch(`/api/capsules/${capsuleId}/context`);
      if (!contextResponse.ok) {
        throw new Error('Failed to fetch context');
      }
  
      const contextData = await contextResponse.json();
      const workerUrl = 'https://craig-argue-machine.shrinked.workers.dev';
      
      const argumentResponse = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: contextData.context || contextData.fullContext || JSON.stringify(contextData),
          question: question.trim(),
          systemPrompt: getArguePrompt(),
        }),
      });
  
      if (!argumentResponse.ok) {
        const errorData = await argumentResponse.text();
        throw new Error(errorData || 'Failed to generate argument');
      }
  
      if (!argumentResponse.body) {
        throw new Error('Response body is empty');
      }
  
      const reader = argumentResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setIsStreamingComplete(true);
          break;
        }
  
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
  
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const parsed = JSON.parse(line);
            
            if (parsed.type === 'filtered') {
              if (parsed.content && !parsed.content.includes('NO_RELEVANT_CONTEXT')) {
                setReasoningResponse(parsed.content);
              }
            } else if (parsed.type === 'response' && parsed.content) {
              if (parsed.content.chat) {
                setChatResponse(prev => prev + parsed.content.chat);
              }
              if (parsed.content.reasoning) {
                setReasoningResponse(parsed.content.reasoning);
              }
            } else if (parsed.type === 'error') {
              setError(parsed.content);
            }
          } catch (e) {
            console.warn('Failed to parse line:', line);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [question, capsuleId]);

  const handleClear = useCallback(() => {
    setQuestion('');
    setChatResponse('');
    setReasoningResponse('');
    setError('');
    setIsReasoningExpanded(false);
    setIsStreamingComplete(false);
  }, []);

  const handleWindowClick = useCallback(() => {
    onBringToFront('argue-popup');
  }, [onBringToFront]);

  if (!isOpen) return null;

  return (
    <div 
      ref={windowRef}
      className="draggable-window retro-window"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: zIndex,
        width: '500px',
        maxHeight: '600px',
        cursor: isDragging ? 'grabbing' : 'default',
        background: 'linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%)',
        border: '1px solid black',
        boxShadow: '8px 8px 0px #808080, 16px 16px 0px #404040', // Flat, offset shadow like TV window
        borderRadius: '20px', // Rounded corners like TV window
      }}
      onClick={handleWindowClick}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          width: '20px',
          height: '20px',
          background: '#c0c0c0',
          border: '2px outset #c0c0c0',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'black',
          zIndex: 10,
        }}
      >
        ×
      </button>

      {/* Content */}
      <div 
        style={{ 
          padding: '20px', 
          maxHeight: 'calc(100% - 16px)', // Adjust max height to account for padding
          overflowY: 'auto',
          fontSize: '12px', // Match status line font size
          fontFamily: 'Geneva, sans-serif', // Match status line font
          color: 'black', // Ensure dark text on light background
        }}
      >
        {/* New Header */}
        <div 
          style={{
            background: 'linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%)', // Same as main window background
            color: 'black', // Black text
            padding: '6px 12px', // Add horizontal padding
            fontWeight: 'bold',
            fontSize: '13px', // Slightly larger for header
            fontFamily: 'Geneva, sans-serif', // Use Geneva for header
            userSelect: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
            position: 'absolute', // Position absolutely
            top: '-1px', // Move up to cover the border
            left: '50%', // Center horizontally
            transform: 'translateX(-50%)', // Adjust for centering
            width: 'fit-content', // Fit to content
            zIndex: 1, // Ensure it's on top of the border
          }}
          onMouseDown={handleMouseDown}
        >
          Argue with Craig
        </div>

        <form onSubmit={handleSubmit} style={{ marginBottom: '12px' }}>
          <div style={{ marginBottom: '8px' }}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., 'Remote work is more productive' or 'What are the best arguments for this?'"
              style={{
                width: '100%',
                height: '60px',
                padding: '4px',
                border: '2px inset #c0c0c0',
                background: 'white',
                fontSize: '12px', // Match status line font size
                fontFamily: 'Geneva, sans-serif', // Match status line font
                resize: 'none',
                color: 'black', // Ensure dark text
              }}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div style={{
              padding: '4px',
              background: '#ffeeee',
              border: '1px solid #cc0000',
              color: '#cc0000',
              fontSize: '12px', // Match status line font size
              marginBottom: '8px'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              style={{
                padding: '4px 8px',
                background: isLoading || !question.trim() ? '#d0d0d0' : '#c0c0c0',
                border: '2px solid #000000',
                boxShadow: '2px 2px 0px #808080, 4px 4px 0px #404040',
                fontSize: '12px', // Match status line font size
                fontWeight: 'bold',
                cursor: isLoading || !question.trim() ? 'default' : 'pointer',
                color: isLoading || !question.trim() ? '#808080' : 'black', // Ensure dark text
                fontFamily: 'Geneva, sans-serif', // Match status line font
              }}
            >
              {isLoading ? 'Generating...' : 'Generate Argument'}
            </button>
            <button
              onClick={handleClear}
              disabled={isLoading}
              style={{
                padding: '4px 8px',
                background: isLoading ? '#d0d0d0' : '#c0c0c0',
                border: '2px solid #000000',
                boxShadow: '2px 2px 0px #808080, 4px 4px 0px #404040',
                fontSize: '12px', // Match status line font size
                fontWeight: 'bold',
                cursor: isLoading ? 'default' : 'pointer',
                color: isLoading ? '#808080' : 'black', // Ensure dark text
                fontFamily: 'Geneva, sans-serif', // Match status line font
              }}
            >
              Clear
            </button>
          </div>
        </form>

        {/* Loading indicator */}
        {isLoading && !chatResponse && (
          <div style={{ 
            padding: '8px',
            background: '#f0f0f0',
            border: '1px inset #c0c0c0',
            fontSize: '12px', // Match status line font size
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'black', // Ensure dark text
            fontFamily: 'Geneva, sans-serif', // Match status line font
          }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              <div style={{ 
                width: '4px', 
                height: '4px', 
                background: '#0066cc', 
                borderRadius: '50%',
                animation: 'bounce 1.4s infinite ease-in-out both',
                animationDelay: '0s'
              }}></div>
              <div style={{ 
                width: '4px', 
                height: '4px', 
                background: '#0066cc', 
                borderRadius: '50%',
                animation: 'bounce 1.4s infinite ease-in-out both',
                animationDelay: '0.16s'
              }}></div>
              <div style={{ 
                width: '4px', 
                height: '4px', 
                background: '#0066cc', 
                borderRadius: '50%',
                animation: 'bounce 1.4s infinite ease-in-out both',
                animationDelay: '0.32s'
              }}></div>
            </div>
            Craig is building his argument...
          </div>
        )}

        {/* Response */}
        {chatResponse && (
          <div style={{ marginTop: '8px' }}>
            <div style={{
              marginBottom: '6px',
              fontWeight: 'bold',
              fontSize: '12px', // Match status line font size
              background: '#0066cc',
              color: 'white',
              padding: '2px 6px',
              fontFamily: 'Geneva, sans-serif', // Match status line font
            }}>
              Craig's Argument:
            </div>
            
            <div style={{
              background: 'white',
              border: '2px inset #c0c0c0',
              padding: '6px',
              maxHeight: '200px',
              overflowY: 'auto',
              fontSize: '12px', // Match status line font size
              lineHeight: '1.3',
              color: 'black', // Ensure dark text
              fontFamily: 'Geneva, sans-serif', // Match status line font
            }}>
              {chatResponse}
              {isLoading && !isStreamingComplete && 
                <span style={{ animation: 'blink 1s infinite' }}>|</span>
              }
            </div>
            
            {/* Analysis toggle */}
            {reasoningResponse && reasoningResponse.trim() && (
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                  style={{
                    padding: '2px 6px',
                    background: '#c0c0c0',
                    border: '2px solid #000000',
                    boxShadow: '2px 2px 0px #808080, 4px 4px 0px #404040',
                    fontSize: '12px', // Match status line font size
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'black', // Ensure dark text
                    fontFamily: 'Geneva, sans-serif', // Match status line font
                  }}
                >
                  <span style={{ 
                    fontSize: '10px', // Slightly larger for arrow
                    transform: isReasoningExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▶
                  </span>
                  {isReasoningExpanded ? 'Hide Analysis' : 'Show Full Analysis'}
                </button>
                {isReasoningExpanded && (
                  <div style={{
                    marginTop: '6px',
                    background: '#f8f8f8',
                    border: '1px inset #c0c0c0',
                    padding: '6px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    fontSize: '12px', // Match status line font size
                    lineHeight: '1.3',
                    whiteSpace: 'pre-wrap',
                    color: 'black', // Ensure dark text
                    fontFamily: 'Geneva, sans-serif', // Match status line font
                  }}>
                    {reasoningResponse}
                  </div>
                )}
              </div>
            )}
            
            {/* Copy button */}
            <div style={{ marginTop: '6px' }}>
              <button
                onClick={() => navigator.clipboard.writeText(chatResponse + (reasoningResponse ? '\n\n' + reasoningResponse : ''))}
                style={{
                  padding: '2px 6px',
                  background: '#c0c0c0',
                  border: '2px solid #000000',
                  boxShadow: '2px 2px 0px #808080, 4px 4px 0px #404040',
                  fontSize: '12px', // Match status line font size
                  cursor: 'pointer',
                  color: 'black', // Ensure dark text
                  fontFamily: 'Geneva, sans-serif', // Match status line font
                }}
              >
                📋 Copy
              </button>
            </div>
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default ArguePopup;