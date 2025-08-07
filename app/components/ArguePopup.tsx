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
  const [reasoningResponse, setReasoningResponse] = useState('');
  const [error, setError] = useState('');
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [isStreamingComplete, setIsStreamingComplete] = useState(false);
  const [currentSection, setCurrentSection] = useState('chat');

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
    setCurrentSection('chat');
  
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
      let accumulatedChat = '';
      let accumulatedReasoning = '';
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setIsStreamingComplete(true);
          break;
        }
  
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
  
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'response' && parsed.content.chat) {
              const deltaText = parsed.content.chat;
              
              // Check if we've hit the Extended Reasoning section
              if (deltaText.includes('## Full Analysis') || deltaText.includes('**Extended Reasoning**')) {
                setCurrentSection('reasoning');
              }
              
              // Accumulate the delta text based on current section
              if (currentSection === 'reasoning') {
                accumulatedReasoning += deltaText;
                setReasoningResponse(accumulatedReasoning);
              } else {
                accumulatedChat += deltaText;
                setChatResponse(accumulatedChat);
                
                // Check if this delta contains the transition to reasoning
                if (deltaText.includes('## Full Analysis') || deltaText.includes('**Extended Reasoning**')) {
                  const parts = accumulatedChat.split(/## Full Analysis|**Extended Reasoning**/);
                  if (parts.length > 1) {
                    setChatResponse(parts[0].trim());
                    accumulatedReasoning = '## Full Analysis' + parts[1];
                    setReasoningResponse(accumulatedReasoning);
                    setCurrentSection('reasoning');
                  }
                }
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
  }, [question, capsuleId, currentSection]);

  const handleClear = useCallback(() => {
    setQuestion('');
    setChatResponse('');
    setReasoningResponse('');
    setError('');
    setIsReasoningExpanded(false);
    setIsStreamingComplete(false);
    setCurrentSection('chat');
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

            {/* Show loading indicator */}
            {isLoading && !chatResponse && (
              <div className="mt-6">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  <span className="text-gray-600 text-sm">Marcus is building his argument...</span>
                </div>
              </div>
            )}

            {chatResponse && (
              <div className="mt-6">
                <h3 className="font-bold text-lg mb-3 text-black">Marcus Rivera's Argument:</h3>
                <div 
                  className="p-4 bg-white border-2 border-gray-400 max-h-96 overflow-y-auto"
                  style={{
                    boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  {/* Chat Response Section */}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-black">
                    {chatResponse}
                    {isLoading && !isStreamingComplete && currentSection === 'chat' && 
                      <span className="animate-pulse bg-gray-300">|</span>
                    }
                  </div>
                  
                  {/* Extended Reasoning Section */}
                  {reasoningResponse && (
                    <div className="mt-6">
                      <button
                        onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                        className="px-4 py-2 text-sm bg-gray-200 border border-gray-400 hover:bg-gray-300 text-black flex items-center gap-2"
                        style={{
                          boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.8), inset -1px -1px 2px rgba(0,0,0,0.3)'
                        }}
                      >
                        <span className={`transform transition-transform ${isReasoningExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                        {isReasoningExpanded ? 'Hide Full Analysis' : 'Show Full Analysis'}
                      </button>
                      {isReasoningExpanded && (
                        <div className="mt-4 p-4 bg-gray-50 border border-gray-300 rounded">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed text-black">
                            {reasoningResponse}
                            {isLoading && !isStreamingComplete && currentSection === 'reasoning' && 
                              <span className="animate-pulse bg-gray-300">|</span>
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(chatResponse + (reasoningResponse ? '\n\n' + reasoningResponse : ''))}
                    className="px-4 py-2 text-sm bg-gray-200 border border-gray-400 hover:bg-gray-300 text-black"
                    style={{
                      boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.8), inset -1px -1px 2px rgba(0,0,0,0.3)'
                    }}
                  >
                    📋 Copy to Clipboard
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