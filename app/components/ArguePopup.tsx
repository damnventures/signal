'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { getArguePrompt } from './ArguePrompt';
import { useAuth } from '../contexts/AuthContext';
import DraggableWindow from './DraggableWindow';

interface ArguePopupProps {
  isOpen: boolean;
  onClose: () => void;
  capsuleId: string;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  initialPosition: { x: number; y: number };
  initialQuestion?: string;
  id: string;
}

const ArguePopup: React.FC<ArguePopupProps> = ({
  isOpen,
  onClose,
  capsuleId,
  onBringToFront,
  initialZIndex,
  initialPosition,
  initialQuestion = '',
  id,
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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
            context: contextData.context || contextData.fullContext || JSON.stringify(contextData),
            question: question.trim(),
            systemPrompt: getArguePrompt(),
          }),
        });

        if (!argumentResponse.ok) throw new Error(await argumentResponse.text());
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
              if (parsed.type === 'filtered' && parsed.content && !parsed.content.includes('NO_RELEVANT_CONTEXT')) {
                setReasoningResponse(parsed.content);
              } else if (parsed.type === 'response' && parsed.content) {
                if (parsed.content.chat) setChatResponse(prev => prev + parsed.content.chat);
                if (parsed.content.reasoning) setReasoningResponse(parsed.content.reasoning);
              } else if (parsed.type === 'error') setError(parsed.content);
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
    },
    [question, currentCapsuleId, apiKey]
  );

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
      width={520}
      height={580}
      title="Argue with Craig"
      onClose={onClose}
    >
      <div className="argue-window">
        <form onSubmit={handleSubmit} className="argue-form">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="e.g., 'Remote work is more productive' or 'What are the best arguments for this?'"
            disabled={isLoading}
            className="retro-textarea"
          />
          {error && <div className="retro-error"><strong>Error:</strong> {error}</div>}
          <div className="retro-actions">
            <button type="submit" disabled={isLoading || !question.trim()} className="retro-btn">
              {isLoading ? 'Generating…' : 'Generate Argument'}
            </button>
            <button onClick={handleClear} disabled={isLoading} className="retro-btn">Clear</button>
            <span className="capsule-id-label">Capsule ID:</span>
            <input
              type="text"
              value={currentCapsuleId}
              onChange={e => setCurrentCapsuleId(e.target.value)}
              disabled={isLoading}
              className="retro-input"
            />
          </div>
        </form>

        {isLoading && !chatResponse && <div className="retro-loading">Craig is building his argument…</div>}

        {chatResponse && (
          <div className="retro-section">
            <div className="retro-section-header">Craig’s Argument</div>
            <div className="retro-output">
              {chatResponse
                .split(/\n\n|(?<=[.?!])\s+(?=[A-Z])/g)
                .map((paragraph, index) => (
                  <p key={index} className="retro-paragraph">
                    {paragraph.split(/(\[\[\d+\]\])/).map((part, i) =>
                      /\[\[\d+\]\]/.test(part) ? <span key={i} className="retro-ref">{part}</span> : part
                    )}
                    {isLoading && !isStreamingComplete && index === chatResponse.length - 1 && (
                      <span className="retro-cursor">|</span>
                    )}
                  </p>
                ))}
            </div>
            {reasoningResponse && (
              <div className="retro-section">
                <button onClick={() => setIsReasoningExpanded(!isReasoningExpanded)} className="retro-btn">
                  {isReasoningExpanded ? 'Hide Analysis' : 'Show Full Analysis'}
                </button>
                {isReasoningExpanded && <div className="retro-analysis">{reasoningResponse}</div>}
              </div>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(chatResponse + (reasoningResponse ? '\n\n' + reasoningResponse : ''))}
              className="retro-btn"
              style={{ marginTop: '10px' }}
            >
              📋 Copy
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .argue-window {
          padding: 12px;
          font-family: Chicago, Geneva, sans-serif;
          font-size: 13px;
          color: #444;
          background: #fff;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .argue-form { margin-bottom: 12px; }
        .retro-textarea {
          width: 100%;
          height: 60px;
          border: 1px solid #000;
          padding: 4px;
          resize: none;
          font-family: Chicago, Geneva, sans-serif;
          font-size: 13px;
          line-height: 1.5;
          background: #fff;
          color: #444;
        }
        .retro-error {
          margin: 8px 0;
          padding: 6px;
          border: 1px solid #000;
          background: #ffe0e0;
          color: #b00;
        }
        .retro-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 6px;
          flex-wrap: wrap;
        }
        .retro-btn {
          border: 1px solid #000;
          background: #fff;
          padding: 3px 6px;
          cursor: pointer;
          font-family: Chicago, Geneva, sans-serif;
          font-size: 12px;
        }
        .retro-input {
          border: 1px solid #000;
          padding: 2px 4px;
          font-size: 12px;
          background: #fff;
          color: #444;
        }
        .capsule-id-label { font-size: 12px; }
        .retro-loading {
          margin-top: 10px;
          padding: 8px;
          border: 1px solid #000;
          background: #f8f8f8;
          font-size: 12px;
        }
        .retro-section { margin-top: 14px; }
        .retro-section-header {
          font-weight: bold;
          padding: 4px;
          border-bottom: 1px solid #000;
          margin-bottom: 6px;
          background: #fff;
        }
        .retro-output {
          border: 1px solid #000;
          padding: 10px;
          background: #fff;
          max-height: 220px;
          overflow-y: auto;
          line-height: 1.7;
        }
        .retro-output::-webkit-scrollbar { width: 12px; }
        .retro-output::-webkit-scrollbar-track {
          background: #fff;
          border: 1px solid #000;
        }
        .retro-output::-webkit-scrollbar-thumb {
          background: #ddd;
          border: 1px solid #000;
        }
        .retro-paragraph { margin-bottom: 12px; }
        .retro-ref { color: #888; }
        .retro-cursor { animation: blink 1s infinite; }
        .retro-analysis {
          margin-top: 8px;
          border: 1px solid #000;
          padding: 8px;
          background: #f8f8f8;
          max-height: 150px;
          overflow-y: auto;
          white-space: pre-wrap;
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </DraggableWindow>
  );
};

export default ArguePopup;
