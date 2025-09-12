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
        {/* Title bar */}
        <div className="title-bar">
          <div className="close-box" onClick={onClose}></div>
          <span>Argue with Craig</span>
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
          border: 1px solid #000;
          background: #fff;
          display: flex;
          flex-direction: column;
          font-family: Geneva, sans-serif;
          font-size: 13px;
        }
        .title-bar {
          background: #fff;
          border-bottom: 1px solid #000;
          text-align: center;
          font-weight: bold;
          padding: 2px 0;
          position: relative;
        }
        .close-box {
          width: 12px;
          height: 12px;
          border: 1px solid #000;
          background: #fff;
          position: absolute;
          left: 4px;
          top: 2px;
          cursor: pointer;
        }
        .window-body {
          flex: 1;
          padding: 10px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        textarea {
          width: 100%;
          height: 60px;
          border: 1px solid #000;
          font-family: inherit;
          font-size: 13px;
          padding: 4px;
          resize: none;
        }
        .button-row {
          margin-top: 6px;
          display: flex;
          gap: 6px;
        }
        button {
          border: 1px solid #000;
          background: #fff;
          padding: 4px 8px;
          cursor: pointer;
        }
        button:disabled {
          color: #888;
          cursor: default;
        }
        .error-box {
          margin-top: 8px;
          padding: 6px;
          border: 1px solid #000;
          background: #ffe0e0;
          color: #900;
          font-size: 12px;
        }
        .response-section {
          margin-top: 12px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .response-label {
          font-weight: bold;
          margin-bottom: 4px;
        }
        .response-box {
          flex: 1;
          border: 1px solid #000;
          padding: 8px;
          overflow-y: auto;
          line-height: 1.6;
          color: #444;
        }
        .response-box::-webkit-scrollbar {
          width: 12px;
        }
        .response-box::-webkit-scrollbar-track {
          background: #fff;
          border-left: 1px solid #000;
        }
        .response-box::-webkit-scrollbar-thumb {
          background: #fff;
          border: 1px solid #000;
        }
        .ref {
          color: #888;
        }
        .analysis {
          margin-top: 10px;
        }
        .analysis-box {
          border: 1px solid #000;
          padding: 8px;
          margin-top: 6px;
          max-height: 120px;
          overflow-y: auto;
          color: #444;
        }
      `}</style>
    </DraggableWindow>
  );
};

export default ArguePopup;
