'use client';

import React, { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { getArguePrompt } from './ArguePrompt';
import { useAuth } from '../contexts/AuthContext';

interface ArguePopupProps {
  isOpen: boolean;
  onClose: () => void;
  capsuleId: string;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  initialQuestion?: string;
}

const ArguePopup: React.FC<ArguePopupProps> = ({ 
  isOpen, 
  onClose, 
  capsuleId, 
  onBringToFront, 
  initialZIndex,
  initialQuestion = ''
}) => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState('');
  const [reasoningResponse, setReasoningResponse] = useState('');
  const [error, setError] = useState('');
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [isStreamingComplete, setIsStreamingComplete] = useState(false);
  const [currentCapsuleId, setCurrentCapsuleId] = useState(capsuleId);
  const { apiKey } = useAuth();
  
  useEffect(() => {
    setCurrentCapsuleId(capsuleId);
  }, [capsuleId]);

  useEffect(() => {
    if (isOpen && initialQuestion && !question) {
      setQuestion(initialQuestion);
    }
  }, [isOpen, initialQuestion, question]);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zIndex, setZIndex] = useState(initialZIndex);
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && position.x === 0 && position.y === 0) {
      const initialX = (window.innerWidth - 500) / 2;
      const initialY = Math.max(50, (window.innerHeight - 600) / 2);
      setPosition({ x: initialX, y: initialY });
    }
  }, [isOpen, position.x, position.y]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!windowRef.current) return;
    
    const rect = windowRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    onBringToFront('argue-popup');
    setZIndex(initialZIndex + 1000);
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
      const contextUrl = apiKey
        ? `/api/capsules/${currentCapsuleId}/context?userApiKey=${apiKey}`
        : `/api/capsules/${currentCapsuleId}/context`;
      const contextResponse = await fetch(contextUrl);
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
  }, [question, currentCapsuleId, apiKey]);

  useEffect(() => {
    if (isOpen && question === initialQuestion && initialQuestion && !isLoading && !chatResponse) {
      const timer = setTimeout(() => {
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
        handleSubmit(fakeEvent);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, question, initialQuestion, isLoading, chatResponse, handleSubmit]);

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
        background: '#ffffff',
        border: '2px solid #000000',
        boxShadow: '4px 4px 0px #c0c0c0, 8px 8px 0px #808080',
        borderRadius: '8px',
      }}
      onClick={handleWindowClick}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          width: '20px',
          height: '20px',
          background: '#ffffff',
          border: '2px outset #c0c0c0',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          color: '#000000',
          zIndex: 10,
        }}
      >
        ×
      </button>

      <div 
        style={{
          background: '#ffffff',
          padding: '6px 12px',
          fontWeight: 'bold',
          fontSize: '14px',
          fontFamily: 'Geneva, sans-serif',
          userSelect: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          position: 'absolute',
          top: '-1px',
          left: '0',
          width: '100%',
          textAlign: 'center',
          borderBottom: '2px solid #c0c0c0',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
        }}
        onMouseDown={handleMouseDown}
      >
        Argue with Craig
      </div>

      <div 
        style={{ 
          padding: '20px', 
          maxHeight: 'calc(100% - 40px)',
          overflowY: 'auto',
          fontSize: '12px',
          fontFamily: 'Geneva, sans-serif',
          color: '#000000',
          scrollbarWidth: 'thin',
          scrollbarColor: '#c0c0c0 #f0f0f0',
        }}
      >
        <form onSubmit={handleSubmit} style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '12px' }}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., 'Remote work is more productive' or 'What are the best arguments for this?'"
              style={{
                width: '100%',
                height: '60px',
                padding: '6px',
                border: '2px inset #c0c0c0',
                background: '#ffffff',
                fontSize: '12px',
                fontFamily: 'Geneva, sans-serif',
                resize: 'none',
                color: '#000000',
                lineHeight: '1.5',
              }}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div style={{
              padding: '6px',
              background: '#ffe0e0',
              border: '1px solid #ff9999',
              color: '#cc0000',
              fontSize: '12px',
              marginBottom: '12px',
              lineHeight: '1.5',
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                style={{
                  padding: '6px 12px',
                  background: isLoading || !question.trim() ? '#e0e0e0' : '#ffffff',
                  border: '2px solid #000000',
                  boxShadow: '2px 2px 0px #c0c0c0',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: isLoading || !question.trim() ? 'default' : 'pointer',
                  color: '#000000',
                  fontFamily: 'Geneva, sans-serif',
                }}
              >
                {isLoading ? 'Generating...' : 'Generate Argument'}
              </button>
              <button
                onClick={handleClear}
                disabled={isLoading}
                style={{
                  padding: '6px 12px',
                  background: isLoading ? '#e0e0e0' : '#ffffff',
                  border: '2px solid #000000',
                  boxShadow: '2px 2px 0px #c0c0c0',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: isLoading ? 'default' : 'pointer',
                  color: '#000000',
                  fontFamily: 'Geneva, sans-serif',
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontFamily: 'Geneva, sans-serif', color: '#000000' }}>Capsule ID:</span>
              <input
                type="text"
                value={currentCapsuleId}
                onChange={(e) => setCurrentCapsuleId(e.target.value)}
                style={{
                  width: '150px',
                  padding: '4px',
                  border: '2px inset #c0c0c0',
                  background: '#ffffff',
                  fontSize: '12px',
                  fontFamily: 'Geneva, sans-serif',
                  color: '#000000',
                }}
                disabled={isLoading}
              />
            </div>
          </div>
        </form>

        {isLoading && !chatResponse && (
          <div style={{ 
            padding: '10px',
            background: '#f0f0f0',
            border: '1px inset #c0c0c0',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#000000',
            fontFamily: 'Geneva, sans-serif',
            lineHeight: '1.5',
          }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <div style={{ width: '6px', height: '6px', background: '#0066cc', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0s' }}></div>
              <div style={{ width: '6px', height: '6px', background: '#0066cc', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.16s' }}></div>
              <div style={{ width: '6px', height: '6px', background: '#0066cc', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.32s' }}></div>
            </div>
            Craig is building his argument...
          </div>
        )}

        {chatResponse && (
          <div style={{ marginTop: '16px' }}>
            <div style={{
              marginBottom: '10px',
              fontWeight: 'bold',
              fontSize: '12px',
              background: '#0066cc',
              color: '#ffffff',
              padding: '4px 8px',
              fontFamily: 'Geneva, sans-serif',
            }}>
              Craig's Argument:
            </div>
            
            <div style={{
              background: '#ffffff',
              border: '2px inset #c0c0c0',
              padding: '12px',
              maxHeight: '200px',
              overflowY: 'auto',
              fontSize: '12px',
              lineHeight: '1.6',
              color: '#000000',
              fontFamily: 'Geneva, sans-serif',
              scrollbarWidth: 'thin',
              scrollbarColor: '#c0c0c0 #f0f0f0',
            }}>
              {chatResponse.split('\n\n').map((paragraph, index) => (
                <p key={index} style={{ marginBottom: '12px' }}>
                  {paragraph.replace(/\[\[\d+\]\]/g, match => `<span style="color: #808080">${match}</span>`)}
                  {isLoading && !isStreamingComplete && index === chatResponse.split('\n\n').length - 1 && <span style={{ animation: 'blink 1s infinite' }}>|</span>}
                </p>
              ))}
            </div>
            
            {reasoningResponse && reasoningResponse.trim() && (
              <div style={{ marginTop: '16px' }}>
                <button
                  onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                  style={{
                    padding: '4px 8px',
                    background: '#ffffff',
                    border: '2px solid #000000',
                    boxShadow: '2px 2px 0px #c0c0c0',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#000000',
                    fontFamily: 'Geneva, sans-serif',
                  }}
                >
                  <span style={{ 
                    fontSize: '10px',
                    transform: isReasoningExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▶
                  </span>
                  {isReasoningExpanded ? 'Hide Analysis' : 'Show Full Analysis'}
                </button>
                {isReasoningExpanded && (
                  <div style={{
                    marginTop: '10px',
                    background: '#f0f0f0',
                    border: '1px inset #c0c0c0',
                    padding: '12px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    color: '#000000',
                    fontFamily: 'Geneva, sans-serif',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#c0c0c0 #f0f0f0',
                  }}>
                    {reasoningResponse}
                  </div>
                )}
              </div>
            )}
            
            <div style={{ marginTop: '12px' }}>
              <button
                onClick={() => navigator.clipboard.writeText(chatResponse + (reasoningResponse ? '\n\n' + reasoningResponse : ''))}
                style={{
                  padding: '4px 8px',
                  background: '#ffffff',
                  border: '2px solid #000000',
                  boxShadow: '2px 2px 0px #c0c0c0',
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: '#000000',
                  fontFamily: 'Geneva, sans-serif',
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
        .retro-window::-webkit-scrollbar {
          width: 12px;
        }
        .retro-window::-webkit-scrollbar-track {
          background: #f0f0f0;
          border-radius: 6px;
        }
        .retro-window::-webkit-scrollbar-thumb {
          background: #c0c0c0;
          border-radius: 6px;
          border: 2px solid #f0f0f0;
        }
        .retro-window::-webkit-scrollbar-thumb:hover {
          background: #a0a0a0;
        }
      `}</style>
    </div>
  );
};

export default ArguePopup;