"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { getArguePrompt } from './ArguePrompt';

interface ArguePopupProps {
  isOpen: boolean;
  onClose: () => void;
  capsuleId: string;
}

const ArguePopup: React.FC<ArguePopupProps> = ({ isOpen, onClose, capsuleId }) => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState('');
  const [filteredContext, setFilteredContext] = useState('');
  const [error, setError] = useState('');
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    setIsLoading(true);
    setError('');
    setChatResponse('');
    setFilteredContext('');
    setIsReasoningExpanded(false);

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
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buf.trim()) {
            try {
              const parsed = JSON.parse(buf);
              if (parsed.type === 'chat') {
                setChatResponse(prev => prev + parsed.content);
              } else if (parsed.type === 'filtered') {
                setFilteredContext(prev => prev + parsed.content);
              }
            } catch (e) {
              console.error('Failed to parse final chunk:', buf, e);
            }
          }
          break;
        }

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop()!;

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'chat') {
                setChatResponse(prev => prev + parsed.content);
              } else if (parsed.type === 'filtered') {
                setFilteredContext(prev => prev + parsed.content);
              }
          } catch (e) {
            console.error('Failed to parse line:', line, e);
          }
        }
      }
    } catch (err) {
      console.error('Error generating argument:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [question, capsuleId]);

  const handleClear = useCallback(() => {
    setQuestion('');
    setChatResponse('');
    setFilteredContext('');
    setError('');
    setIsReasoningExpanded(false);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />
      
      {/* Popup */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-gray-100 border-2 border-gray-400 shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%)',
            boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.8), inset -2px -2px 4px rgba(0,0,0,0.3), 4px 4px 8px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-400 bg-gray-200">
            <h2 className="font-bold text-lg text-black">🎯 Argue Tool</h2>
            <div className="flex gap-2">
              <button
                onClick={handleClear}
                className="px-3 py-1 text-sm bg-gray-200 border border-gray-400 hover:bg-gray-300 text-black"
                style={{
                  boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.8), inset -1px -1px 2px rgba(0,0,0,0.3)'
                }}
              >
                Clear
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1 text-sm bg-gray-200 border border-gray-400 hover:bg-gray-300 text-black"
                style={{
                  boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.8), inset -1px -1px 2px rgba(0,0,0,0.3)'
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)] bg-white">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="question" className="block text-sm font-bold mb-2 text-black">
                  Ask a question or state a position to argue about:
                </label>
                <textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., 'Remote work is more productive than office work' or 'What are the strongest arguments for this approach?'"
                  className="w-full h-24 p-3 border-2 border-gray-400 resize-none text-black"
                  style={{
                    background: 'white',
                    boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.1)'
                  }}
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-100 border-2 border-red-400 text-red-800">
                  <strong>Error:</strong> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                className={`px-6 py-2 font-bold border-2 border-gray-400 text-black ${
                  isLoading || !question.trim() 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-gray-200 hover:bg-gray-300 cursor-pointer'
                }`}
                style={{
                  boxShadow: isLoading || !question.trim() 
                    ? 'inset 2px 2px 4px rgba(0,0,0,0.2)' 
                    : 'inset 1px 1px 2px rgba(255,255,255,0.8), inset -1px -1px 2px rgba(0,0,0,0.3)'
                }}
              >
                {isLoading ? 'Generating Argument...' : 'Generate Argument'}
              </button>
            </form>

            {(chatResponse || filteredContext) && (
              <div className="mt-6">
                <h3 className="font-bold text-lg mb-3 text-black">Generated Argument:</h3>
                <div 
                  className="p-4 bg-white border-2 border-gray-400 max-h-96 overflow-y-auto"
                  style={{
                    boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-black">
                    {chatResponse}
                  </div>
                  {filteredContext && (
                    <div className="mt-4">
                      <button
                        onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                        className="px-4 py-2 text-sm bg-gray-200 border border-gray-400 hover:bg-gray-300 text-black"
                        style={{
                          boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.8), inset -1px -1px 2px rgba(0,0,0,0.3)'
                        }}
                      >
                        {isReasoningExpanded ? 'Hide Filtered Context' : 'Show Filtered Context'}
                      </button>
                      {isReasoningExpanded && (
                        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-black">
                          {filteredContext}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(chatResponse + (isReasoningExpanded ? '\n\n' + filteredContext : ''))}
                    className="px-4 py-2 text-sm bg-gray-200 border border-gray-400 hover:bg-gray-300 text-black"
                    style={{
                      boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.8), inset -1px -1px 2px rgba(0,0,0,0.3)'
                    }}
                  >
                    Copy to Clipboard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ArguePopup;