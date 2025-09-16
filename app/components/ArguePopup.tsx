'use client';

import React, { useState, useCallback, useEffect } from 'react';
import DraggableWindow from './DraggableWindow';
import { getArguePrompt } from './ArguePrompt';
import { useAuth } from '../contexts/AuthContext';

interface Capsule {
  _id: string;
  name: string;
  isPublic: boolean;
  shared?: boolean;
  isShared?: boolean;
  owner?: {
    email?: string;
    username?: string;
  };
}

interface ArguePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onArgueComplete?: () => void;
  capsuleId: string;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  initialPosition: { x: number; y: number };
  id: string;
  initialQuestion?: string;
  userCapsules?: Capsule[];
  accessibleShrinkedCapsules?: string[];
}

const ArguePopup: React.FC<ArguePopupProps> = ({
  isOpen,
  onClose,
  onArgueComplete,
  capsuleId,
  onBringToFront,
  initialZIndex,
  initialPosition,
  id,
  initialQuestion = '',
  userCapsules = [],
  accessibleShrinkedCapsules = [],
}) => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState('');
  const [reasoningResponse, setReasoningResponse] = useState('');
  const [error, setError] = useState('');
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [isStreamingComplete, setIsStreamingComplete] = useState(false);
  const [selectedCapsuleIds, setSelectedCapsuleIds] = useState<string[]>([capsuleId]);
  const { apiKey, user } = useAuth();

  useEffect(() => {
    setSelectedCapsuleIds([capsuleId]);
  }, [capsuleId]);

  // Get available capsules for dropdown
  const getAvailableCapsules = () => {
    const capsules: Array<{ id: string; name: string; type: 'user' | 'shrinked' }> = [];
    const addedIds = new Set<string>();

    // Add user's own capsules
    if (user && userCapsules.length > 0) {
      userCapsules.forEach(capsule => {
        if (!addedIds.has(capsule._id)) {
          capsules.push({
            id: capsule._id,
            name: capsule.name || 'Untitled Capsule',
            type: 'user'
          });
          addedIds.add(capsule._id);
        }
      });
    }

    // Add accessible Shrinked capsules (only if not already added as user capsule)
    const shrinkedCapsuleMap: Record<string, string> = {
      '6887e02fa01e2f4073d3bb51': 'YC Reducto AI',
      '68c32cf3735fb4ac0ef3ccbf': 'LastWeekTonight Preview',
      '6887e02fa01e2f4073d3bb52': 'AI Research Papers',
      '6887e02fa01e2f4073d3bb53': 'Startup Insights',
      '6887e02fa01e2f4073d3bb54': 'Tech Podcasts',
    };

    accessibleShrinkedCapsules.forEach(capsuleId => {
      const name = shrinkedCapsuleMap[capsuleId];
      if (name && !addedIds.has(capsuleId)) {
        capsules.push({
          id: capsuleId,
          name: name,
          type: 'shrinked'
        });
        addedIds.add(capsuleId);
      }
    });

    return capsules;
  };

  const availableCapsules = getAvailableCapsules();

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
      // Fetch context from all selected capsules
      const contextPromises = selectedCapsuleIds.map(async (capsuleId) => {
        const contextUrl = apiKey
          ? `/api/capsules/${capsuleId}/context?userApiKey=${apiKey}`
          : `/api/capsules/${capsuleId}/context`;
        const response = await fetch(contextUrl);
        if (!response.ok) throw new Error(`Failed to fetch context for capsule ${capsuleId}`);
        return await response.json();
      });

      const contextResults = await Promise.all(contextPromises);

      // Combine all contexts
      const combinedContext = contextResults.map((data, index) => {
        const capsuleName = availableCapsules.find(c => c.id === selectedCapsuleIds[index])?.name || `Capsule ${index + 1}`;
        const context = data.context || data.fullContext || JSON.stringify(data);
        return `=== ${capsuleName} ===\n${context}`;
      }).join('\n\n');

      const workerUrl = 'https://craig-argue-machine.shrinked.workers.dev';

      const argumentResponse = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: combinedContext,
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
          // Notify parent that argue operation is complete
          if (onArgueComplete) {
            onArgueComplete();
          }
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
      // Notify parent that argue operation is complete (even with error)
      if (onArgueComplete) {
        onArgueComplete();
      }
    } finally {
      setIsLoading(false);
    }
  }, [question, selectedCapsuleIds, apiKey, availableCapsules]);

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
    <>
      {/* Backdrop to ensure proper z-index layering */}
      <div className="argue-backdrop"></div>
      <DraggableWindow
        id={id}
        onBringToFront={onBringToFront}
        initialZIndex={Math.max(initialZIndex, 10000)}
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
            {/* Help text area at top */}
            <div className="help-section">
              <div className="help-text">
                Argue uses capsule content to generate counter-arguments. Select one or more capsules below, then enter your statement to debate.
              </div>
            </div>

            {/* Capsule selection dropdown */}
            <div className="capsule-section">
              <div className="section-label">Select Capsules:</div>
              <div className="capsule-dropdown-container">
                <select
                  multiple
                  value={selectedCapsuleIds}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    setSelectedCapsuleIds(values.length > 0 ? values : [capsuleId]);
                  }}
                  className="capsule-dropdown"
                  disabled={isLoading}
                >
                  {availableCapsules.map(capsule => (
                    <option key={capsule.id} value={capsule.id}>
                      {capsule.name.toLowerCase()} {capsule.type === 'shrinked' ? '(shrinked)' : ''}
                    </option>
                  ))}
                </select>
                <div className="dropdown-hint">
                  Hold Ctrl/Cmd to select multiple capsules
                </div>
              </div>
            </div>

            {/* Chat response area - takes most space */}
            <div className="chat-section">
              {isLoading && !chatResponse ? (
                <div className="thinking-chat">
                  <div className="thinking-message">
                    Craig is thinking...
                  </div>
                </div>
              ) : chatResponse ? (
                <div className="response-section">
                  <div className="response-label">Craig's Argument:</div>
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

                    {/* Show streaming indicator if still loading */}
                    {isLoading && !isStreamingComplete && (
                      <div className="streaming-indicator" style={{
                        fontSize: '12px',
                        color: '#666',
                        fontStyle: 'italic',
                        marginTop: '8px'
                      }}>
                        <span>...</span>
                      </div>
                    )}
                  </div>

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
              ) : (
                <div className="empty-chat">
                </div>
              )}
            </div>

            {error && <div className="error-box">Error: {error}</div>}

            {/* Input form at bottom - chat-like */}
            <div className="input-section">
              <form onSubmit={handleSubmit} className="input-form">
                <div className="input-row">
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., 'Remote work is more productive'..."
                    disabled={isLoading}
                    className="question-input"
                  />
                  <div className="button-group">
                    <button type="submit" disabled={isLoading || !question.trim()} className="generate-btn">
                      {isLoading ? 'Generating…' : 'Generate'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

        <style jsx>{`
        .argue-popup * {
          box-sizing: border-box;
        }

        .argue-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 9998;
        }

        .argue-popup {
          height: 600px;
          max-width: 95vw;
          max-height: 95vh;
          border: 1px solid #000000;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 13px;
          box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.25);
          color: #000000;
          box-sizing: border-box;
        }

        .argue-title-bar {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          padding: 8px 16px;
          background: #ffffff;
          border-bottom: 2px solid #000000;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
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
          text-align: center;
          background: #ffffff;
          padding: 0 8px;
          z-index: 2;
          position: relative;
        }

        .argue-close-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: #ffffff;
          border: 1px solid #000000;
          font-size: 16px;
          color: #000000;
          cursor: pointer;
          padding: 2px 6px;
          line-height: 1;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          z-index: 3;
          min-width: 20px;
          min-height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .argue-close-btn:hover {
          background: #e0e0e0;
          border-color: #000000;
        }

        .argue-close-btn:active {
          background: #d0d0d0;
        }

        .window-body {
          flex: 1;
          padding: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          gap: 8px;
        }

        .help-section {
          background: #f5f5f5;
          border: 1px solid #c0c0c0;
          padding: 8px;
          border-radius: 0;
        }

        .help-text {
          font-size: 10px;
          color: #666666;
          line-height: 1.3;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
        }

        .capsule-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .section-label {
          font-size: 11px;
          font-weight: bold;
          color: #000000;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
        }

        .capsule-dropdown-container {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .capsule-dropdown {
          border: 2px solid #000000;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          padding: 4px;
          background: #ffffff;
          color: #000000;
          box-shadow: inset 1px 1px 0px #808080;
          min-height: 60px;
          max-height: 60px;
          width: 100%;
        }

        .capsule-dropdown::-webkit-scrollbar {
          width: 16px;
        }

        .capsule-dropdown::-webkit-scrollbar-track {
          background: #f0f0f0;
          border-left: 2px solid #000000;
        }

        .capsule-dropdown::-webkit-scrollbar-thumb {
          background: #ffffff;
          border: 2px solid #000000;
          box-shadow: 1px 1px 0px #808080;
        }

        .capsule-dropdown::-webkit-scrollbar-thumb:hover {
          background: #f0f0f0;
        }

        .capsule-dropdown:focus {
          outline: none;
          border: 2px solid #000000;
        }

        .dropdown-hint {
          font-size: 9px;
          color: #999999;
          font-style: italic;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
        }

        .chat-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .empty-chat {
          flex: 1;
          border: 2px solid #000000;
          background: #f0f0f0;
          box-shadow: inset 1px 1px 0px #808080;
        }

        .thinking-chat {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #000000;
          background: #ffffff;
          box-shadow: inset 1px 1px 0px #808080;
        }

        .thinking-message {
          color: #666666;
          font-style: italic;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          text-align: center;
        }

        .response-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .response-label {
          font-weight: bold;
          margin-bottom: 4px;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 11px;
          color: #000000;
        }

        .response-box {
          flex: 1;
          border: 2px solid #000000;
          padding: 8px;
          overflow-y: auto;
          line-height: 1.2;
          color: #000000;
          background: #ffffff;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 15px;
          box-shadow: inset 1px 1px 0px #808080;
        }

        .response-box p {
          margin: 0 0 8px 0;
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
          margin-top: 8px;
        }

        .analysis button {
          padding: 4px 8px;
          border: 2px solid #000000;
          background: #ffffff;
          color: #000000;
          cursor: pointer;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-weight: bold;
          box-shadow: 1px 1px 0px #808080;
        }

        .analysis button:hover:not(:disabled) {
          background: #f0f0f0;
        }

        .analysis button:active:not(:disabled) {
          background: #e0e0e0;
          box-shadow: inset 1px 1px 0px #808080;
        }

        .analysis-box {
          border: 2px solid #000000;
          padding: 6px;
          margin-top: 4px;
          max-height: 80px;
          overflow-y: auto;
          color: #000000;
          background: #ffffff;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 10px;
          box-shadow: inset 1px 1px 0px #808080;
        }

        .error-box {
          padding: 8px;
          border: 2px solid #000000;
          background: #ffe0e0;
          color: #800000;
          font-size: 11px;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-weight: bold;
        }

        .input-section {
          padding-top: 8px;
        }

        .input-form {
          display: flex;
          flex-direction: column;
        }

        .input-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          width: 100%;
        }

        .question-input {
          flex: 1;
          height: 28px;
          border: 2px solid #000000;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          padding: 4px 6px;
          resize: none;
          background: #ffffff;
          color: #000000;
          box-shadow: inset 1px 1px 0px #808080;
          min-width: 0;
        }

        .question-input:focus {
          outline: none;
          border: 2px solid #000000;
        }

        .button-group {
          display: flex;
          flex-direction: row;
          gap: 4px;
          flex-shrink: 0;
          align-items: center;
        }

        .generate-btn {
          border: 1px solid #000000;
          background: #000000;
          color: #ffffff;
          padding: 4px 8px;
          cursor: pointer;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-weight: bold;
          min-width: 60px;
          white-space: nowrap;
          height: 28px;
        }

        .generate-btn:hover:not(:disabled) {
          background: #333333;
          border-color: #000000;
          color: #ffffff;
        }

        .generate-btn:active:not(:disabled) {
          background: #666666;
          box-shadow: inset 1px 1px 0px #000000;
        }

        .generate-btn:disabled {
          color: #cccccc;
          cursor: default;
          background: #f8f8f8;
          border-color: #cccccc;
        }
        `}</style>
      </div>
    </DraggableWindow>
    </>
  );
};

export default ArguePopup;