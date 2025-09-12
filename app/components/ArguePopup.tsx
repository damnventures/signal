'use client';

import React, { useState, useCallback, useEffect } from 'react';
import DraggableWindow from './DraggableWindow';
import { getArguePrompt } from './ArguePrompt';
import { useAuth } from '../contexts/AuthContext';

interface ArguePopupProps {
  isOpen: boolean;
  onClose: () => void;
  capsuleId: string;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  initialPosition: { x: number; y: number };
  id: string;
  initialQuestion?: string;
}

const ArguePopup: React.FC<ArguePopupProps> = ({
  isOpen,
  onClose,
  capsuleId,
  onBringToFront,
  initialZIndex,
  initialPosition,
  id,
  initialQuestion = '',
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
      if (!contextResponse.ok) throw new Error('Failed to fetch context');

      const contextData = await contextResponse.json();
      const workerUrl = 'https://craig-argue-machine.shrinked.workers.dev';

      const argumentResponse = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context:
            contextData.context ||
            contextData.fullContext ||
            JSON.stringify(contextData),
          question: question.trim(),
          systemPrompt: getArguePrompt(),
        }),
      });

      if (!argumentResponse.ok) {
        const errorData = await argumentResponse.text();
        throw new Error(errorData || 'Failed to generate argument');
      }

      if (!argumentResponse.body) throw new Error('Response body is empty');

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
              if (
                parsed.content &&
                !parsed.content.includes('NO_RELEVANT_CONTEXT')
              ) {
                setReasoningResponse(parsed.content);
              }
            } else if (parsed.type === 'response' && parsed.content) {
              if (parsed.content.chat) {
                setChatResponse((prev) => prev + parsed.content.chat);
              }
              if (parsed.content.reasoning) {
                setReasoningResponse(parsed.content.reasoning);
              }
            } else if (parsed.type === 'error') {
              setError(parsed.content);
            }
          } catch {
            // ignore bad line
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [question, currentCapsuleId, apiKey]);

  const handleClear = useCallback(() => {
    setQuestion('');
    setChatResponse('');
    setReasoningResponse('');
    setError('');
    setIsReasoningExpanded(false);
    setIsStreamingComplete(false);
  }, []);

  if (!isOpen) return null;

  return (
    <DraggableWindow
      id={id}
      onBringToFront={onBringToFront}
      initialZIndex={initialZIndex}
      initialPosition={initialPosition}
    >
      <div className="argue-popup">
        {/* Title bar with grill pattern like Store */}
        <div className="argue-title-bar">
          <div className="argue-title-text">Argue with Craig</div>
          <button 
            className="argue-close-btn"
            onClick={onClose}
            aria-label="Close argue popup"
          >
            ×
          </button>
        </div>

        <div className="window-body">
          <form onSubmit={handleSubmit} className="input-form">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., 'Remote work is more productive'..."
              disabled={isLoading}
            />
            <div className="button-row">
              <button type="submit" disabled={isLoading || !question.trim()}>
                {isLoading ? 'Generating…' : 'Generate'}
              </button>
              <button onClick={handleClear} disabled={isLoading} type="button">
                Clear
              </button>
            </div>
          </form>

          {error && <div className="error-box">Error: {error}</div>}

          {chatResponse && (
            <div className="response-section">
              <div className="response-label">Craig’s Argument:</div>
              <div className="response-box">
                {chatResponse
                  .split(/\n\n|(?<=[.?!])\s+(?=[A-Z])/g)
                  .map((p, i) => (
                    <p key={i}>
                      {p.split(/(\[\[\d+\]\])/).map((part, j) =>
                        /\[\[\d+\]\]/.test(part) ? (
                          <span key={j} className="ref">
                            {part}
                          </span>
                        ) : (
                          part
                        )
                      )}
                    </p>
                  ))}
              </div>
            </div>
          )}

          {reasoningResponse && (
            <div className="analysis">
              <button
                onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                type="button"
              >
                {isReasoningExpanded ? 'Hide Analysis' : 'Show Analysis'}
              </button>
              {isReasoningExpanded && (
                <div className="analysis-box">{reasoningResponse}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .argue-popup {
          width: 520px;
          height: 580px;
          border: 2px solid #000000;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 12px;
          box-shadow: 2px 2px 0px #000000;
        }
        
        .argue-title-bar {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          padding: 8px 16px;
          background: #ffffff;
          border-bottom: 1px solid #000000;
        }
        
        .argue-title-bar::before {
          content: '';
          position: absolute;
          top: 6px;
          left: 3px;
          right: 3px;
          bottom: 6px;
          background-image: repeating-linear-gradient(
            0deg,
            #000000 0px,
            #000000 1px,
            transparent 1px,
            transparent 3px
          );
          z-index: 1;
        }
        
        .argue-title-text {
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 12px;
          font-weight: bold;
          color: #000000;
          z-index: 2;
          position: relative;
        }
        
        .argue-close-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: #ffffff;
          border: none;
          font-size: 16px;
          color: #000000;
          cursor: pointer;
          padding: 2px 6px;
          line-height: 1;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          z-index: 2;
        }
        
        .argue-close-btn:hover {
          background: #e0e0e0;
        }
        
        .argue-close-btn:active {
          background: #d0d0d0;
        }
        .window-body {
          flex: 1;
          padding: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: #ffffff;
        }
        
        textarea {
          width: 100%;
          height: 60px;
          border: 2px solid #000000;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 12px;
          padding: 6px;
          resize: none;
          background: #ffffff;
          box-shadow: inset 1px 1px 0px #808080;
        }
        
        textarea:focus {
          outline: none;
          border: 2px solid #000000;
        }
        
        .button-row {
          margin-top: 8px;
          display: flex;
          gap: 8px;
        }
        
        button {
          border: 2px solid #000000;
          background: #ffffff;
          padding: 6px 12px;
          cursor: pointer;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 11px;
          font-weight: bold;
          box-shadow: 1px 1px 0px #808080;
        }
        
        button:hover:not(:disabled) {
          background: #f0f0f0;
        }
        
        button:active:not(:disabled) {
          background: #e0e0e0;
          box-shadow: inset 1px 1px 0px #808080;
        }
        
        button:disabled {
          color: #808080;
          cursor: default;
          background: #f5f5f5;
        }
        
        .error-box {
          margin-top: 10px;
          padding: 8px;
          border: 2px solid #000000;
          background: #ffe0e0;
          color: #800000;
          font-size: 11px;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
        }
        
        .response-section {
          margin-top: 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        
        .response-label {
          font-weight: bold;
          margin-bottom: 6px;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 12px;
          color: #000000;
        }
        
        .response-box {
          flex: 1;
          border: 2px solid #000000;
          padding: 10px;
          overflow-y: auto;
          line-height: 1.5;
          color: #000000;
          background: #ffffff;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 11px;
          box-shadow: inset 1px 1px 0px #808080;
        }
        
        .response-box p {
          margin: 0 0 12px 0;
        }
        
        .response-box p:last-child {
          margin-bottom: 0;
        }
        
        .response-box::-webkit-scrollbar {
          width: 16px;
        }
        
        .response-box::-webkit-scrollbar-track {
          background: #f0f0f0;
          border-left: 2px solid #000000;
        }
        
        .response-box::-webkit-scrollbar-thumb {
          background: #ffffff;
          border: 2px solid #000000;
          box-shadow: 1px 1px 0px #808080;
        }
        
        .response-box::-webkit-scrollbar-thumb:hover {
          background: #f0f0f0;
        }
        
        .ref {
          color: #666666;
          font-style: italic;
        }
        
        .analysis {
          margin-top: 12px;
        }
        
        .analysis button {
          font-size: 10px;
          padding: 4px 8px;
        }
        
        .analysis-box {
          border: 2px solid #000000;
          padding: 8px;
          margin-top: 6px;
          max-height: 120px;
          overflow-y: auto;
          color: #000000;
          background: #ffffff;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 10px;
          box-shadow: inset 1px 1px 0px #808080;
        }
      `}</style>
    </DraggableWindow>
  );
};

export default ArguePopup;
