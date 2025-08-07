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
      const isDesktop = window.innerWidth >= 768;
      if (isDesktop) {
        // Position it in the center-right area, below where video typically is
        setPosition({ 
          x: window.innerWidth * 0.65, 
          y: 450 
        });
      } else {
        // Mobile: center horizontally
        setPosition({ 
          x: (window.innerWidth - 500) / 2, 
          y: 200 
        });
      }
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
        border: '2px solid #808080',
        boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.8), inset -2px -2px 4px rgba(0,0,0,0.3), 4px 4px 8px rgba(0,0,0,0.3)',
      }}
      onClick={handleWindowClick}
    >
      {/* Title Bar */}
      <div 
        className="window-header"
        onMouseDown={handleMouseDown}
        style={{
          padding: '4px 8px',
          background: 'linear-gradient(90deg, #0066cc 0%, #4080ff 100%)',
          color: 'white',
          fontSize: '11px',
          fontWeight: 'bold',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
          borderBottom: '1px solid #808080'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px' }}>🎯</span>
          <span>Craig's Argue Machine</span>
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            style={{
              width: '16px',
              height: '14px',
              background: '#c0c0c0',
              border: '1px solid #808080',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'black'
            }}
            title="Clear"
          >
            C
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              width: '16px',
              height: '14px',
              background: '#c0c0c0',
              border: '1px solid #808080',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'black'
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ 
        padding: '8px', 
        background: '#c0c0c0',
        maxHeight: '540px',
        overflowY: 'auto',
        fontSize: '11px'
      }}>
        <form onSubmit={handleSubmit} style={{ marginBottom: '12px' }}>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '4px', 
              fontWeight: 'bold',
              fontSize: '11px'
            }}>
              Question or Position:
            </label>
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
                fontSize: '11px',
                fontFamily: 'MS Sans Serif, sans-serif',
                resize: 'none'
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
              fontSize: '10px',
              marginBottom: '8px'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            style={{
              padding: '4px 8px',
              background: isLoading || !question.trim() ? '#d0d0d0' : '#c0c0c0',
              border: '2px outset #c0c0c0',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: isLoading || !question.trim() ? 'default' : 'pointer',
              color: isLoading || !question.trim() ? '#808080' : 'black'
            }}
          >
            {isLoading ? 'Generating...' : 'Generate Argument'}
          </button>
        </form>

        {/* Loading indicator */}
        {isLoading && !chatResponse && (
          <div style={{ 
            padding: '8px',
            background: '#f0f0f0',
            border: '1px inset #c0c0c0',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
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
              fontSize: '11px',
              background: '#0066cc',
              color: 'white',
              padding: '2px 6px'
            }}>
              Craig's Argument:
            </div>
            
            <div style={{
              background: 'white',
              border: '2px inset #c0c0c0',
              padding: '6px',
              maxHeight: '200px',
              overflowY: 'auto',
              fontSize: '11px',
              lineHeight: '1.3'
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
                    border: '1px outset #c0c0c0',
                    fontSize: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ 
                    fontSize: '8px',
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
                    fontSize: '10px',
                    lineHeight: '1.3',
                    whiteSpace: 'pre-wrap'
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
                  border: '1px outset #c0c0c0',
                  fontSize: '10px',
                  cursor: 'pointer'
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