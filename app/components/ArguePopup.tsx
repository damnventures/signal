"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { getArguePrompt } from './ArguePrompt';

interface ArguePopupProps {
  isOpen: boolean;
  onClose: () => void;
  capsuleId: string;
}

const AVAILABLE_MODELS = {
  'openai-gpt-120b': { name: 'OpenAI GPT-OSS 120B', description: 'Best for complex reasoning and production use' },
  'openai-gpt-20b': { name: 'OpenAI GPT-OSS 20B', description: 'Faster, lower latency option' },
  'qwen-coder-32b': { name: 'Qwen 2.5 Coder 32B', description: 'Optimized for code and technical content' },
  'qwen-1.5-7b': { name: 'Qwen 1.5 7B', description: 'Lightweight and fast' },
  'deepseek-qwen-32b': { name: 'DeepSeek-R1 Qwen 32B', description: 'Advanced reasoning capabilities' },
  'qwq-32b': { name: 'QwQ 32B', description: 'Specialized reasoning model' }
};

const ArguePopup: React.FC<ArguePopupProps> = ({ isOpen, onClose, capsuleId }) => {
  const [question, setQuestion] = useState('');
  const [selectedModel, setSelectedModel] = useState('openai-gpt-120b');
  const [isLoading, setIsLoading] = useState(false);
  const [responses, setResponses] = useState<Record<string, {
    chatResponse: string;
    reasoningResponse: string;
    isComplete: boolean;
    error?: string;
  }>>({});
  const [error, setError] = useState('');
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({});

  const handleSubmit = useCallback(async (e: React.FormEvent, modelKey?: string) => {
    e.preventDefault();
    
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }
  
    const modelsToRun = modelKey ? [modelKey] : [selectedModel];
    
    setIsLoading(true);
    setError('');
    
    // Initialize responses for the models we're running
    const newResponses = { ...responses };
    modelsToRun.forEach(model => {
      newResponses[model] = {
        chatResponse: '',
        reasoningResponse: '',
        isComplete: false
      };
    });
    setResponses(newResponses);
  
    try {
      const contextResponse = await fetch(`/api/capsules/${capsuleId}/context`);
      if (!contextResponse.ok) {
        throw new Error('Failed to fetch context');
      }
  
      const contextData = await contextResponse.json();
      const workerUrl = 'https://craig-argue-machine.shrinked.workers.dev';
      
      // Run all models in parallel
      const promises = modelsToRun.map(async (model) => {
        try {
          const argumentResponse = await fetch(workerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              context: contextData.context || contextData.fullContext || JSON.stringify(contextData),
              question: question.trim(),
              systemPrompt: getArguePrompt(),
              model: model,
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
          let currentSection = 'chat';
    
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              setResponses(prev => ({
                ...prev,
                [model]: { ...prev[model], isComplete: true }
              }));
              break;
            }
    
            buffer += decoder.decode(value, { stream: true });            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
    
            for (const line of lines) {
              if (!line.trim()) continue;
              
              try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'response' && parsed.content.chat) {
                  const newText = parsed.content.chat;
                  
                  if (newText.includes('**Extended Reasoning**')) {
                    const parts = newText.split('**Extended Reasoning**');
                    setResponses(prev => ({
                      ...prev,
                      [model]: {
                        ...prev[model],
                        chatResponse: prev[model].chatResponse + parts[0]
                      }
                    }));
                    if (parts[1]) {
                      setResponses(prev => ({
                        ...prev,
                        [model]: {
                          ...prev[model],
                          reasoningResponse: parts[1]
                        }
                      }));
                    }
                    currentSection = 'reasoning';
                  } else if (currentSection === 'reasoning') {
                    setResponses(prev => ({
                      ...prev,
                      [model]: {
                        ...prev[model],
                        reasoningResponse: prev[model].reasoningResponse + newText
                      }
                    }));
                  } else {
                    setResponses(prev => ({
                      ...prev,
                      [model]: {
                        ...prev[model],
                        chatResponse: prev[model].chatResponse + newText
                      }
                    }));
                  }
                } else if (parsed.type === 'error') {
                  setResponses(prev => ({
                    ...prev,
                    [model]: { ...prev[model], error: parsed.content }
                  }));
                }
              } catch (e) {
                console.warn('Failed to parse line:', line);
              }
            }
          }
        } catch (err) {
          setResponses(prev => ({
            ...prev,
            [model]: { 
              ...prev[model], 
              error: err instanceof Error ? err.message : 'An error occurred',
              isComplete: true
            }
          }));
        }
      });

      await Promise.all(promises);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [question, capsuleId, selectedModel, responses]);

  const handleClear = useCallback(() => {
    setQuestion('');
    setResponses({});
    setError('');
    setExpandedModels({});
  }, []);

  const toggleExpanded = useCallback((model: string) => {
    setExpandedModels(prev => ({
      ...prev,
      [model]: !prev[model]
    }));
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />
      
      {/* Popup */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-gray-100 border-2 border-gray-400 shadow-lg max-w-6xl w-full max-h-[95vh] overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%)',
            boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.8), inset -2px -2px 4px rgba(0,0,0,0.3), 4px 4px 8px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-400 bg-gray-200">
            <h2 className="font-bold text-lg text-black"> Multi-Model Argue Tool</h2>
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
          <div className="p-4 overflow-y-auto max-h-[calc(95vh-120px)] bg-white">
            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
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

              <div>
                <label htmlFor="model" className="block text-sm font-bold mb-2 text-black">
                  AI Model:
                </label>
                <select
                  id="model"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full p-2 border-2 border-gray-400 text-black bg-white"
                  style={{
                    boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.1)'
                  }}
                  disabled={isLoading}
                >
                  {Object.entries(AVAILABLE_MODELS).map(([key, model]) => (
                    <option key={key} value={key}>
                      {model.name} - {model.description}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="p-3 bg-red-100 border-2 border-red-400 text-red-800">
                  <strong>Error:</strong> {error}
                </div>
              )}

              <div className="flex gap-2">
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
                  {isLoading ? 'Generating...' : 'Generate Argument'}
                </button>
                
                <button
                  type="button"
                  onClick={(e) => {
                    // Run all models
                    Object.keys(AVAILABLE_MODELS).forEach(async (model) => {
                      await handleSubmit(e, model);
                    });
                  }}
                  disabled={isLoading || !question.trim()}
                  className={`px-6 py-2 font-bold border-2 border-gray-400 text-black ${
                    isLoading || !question.trim() 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-blue-200 hover:bg-blue-300 cursor-pointer'
                  }`}
                  style={{
                    boxShadow: isLoading || !question.trim() 
                      ? 'inset 2px 2px 4px rgba(0,0,0,0.2)' 
                      : 'inset 1px 1px 2px rgba(255,255,255,0.8), inset -1px -1px 2px rgba(0,0,0,0.3)'
                  }}
                >
                   Compare All Models
                </button>
              </div>
            </form>

            {/* Show loading indicator */}
            {isLoading && Object.keys(responses).length === 0 && (
              <div className="mt-6">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  <span className="text-gray-600 text-sm">Generating arguments...</span>
                </div>
              </div>
            )}

            {/* Model Responses */}
            {Object.entries(responses).map(([modelKey, response]) => (
              <div key={modelKey} className="mt-6 border-2 border-gray-400 bg-gray-50">
                <div className="bg-gray-200 p-3 border-b border-gray-400 flex items-center justify-between">
                  <h3 className="font-bold text-lg text-black">
                    {AVAILABLE_MODELS[modelKey as keyof typeof AVAILABLE_MODELS]?.name || modelKey}
                  </h3>
                  <div className="flex items-center gap-2">
                    {!response.isComplete && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                    )}
                    {response.isComplete && (
                      <span className="text-green-600 text-sm">✓ Complete</span>
                    )}
                  </div>
                </div>
                
                <div className="p-4">
                  {response.error ? (
                    <div className="p-3 bg-red-100 border border-red-300 text-red-800">
                      <strong>Error:</strong> {response.error}
                    </div>
                  ) : (
                    <>
                      {response.chatResponse && (
                        <div className="mb-4">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed text-black bg-white p-3 border border-gray-300 rounded">
                            {response.chatResponse}
                            {!response.isComplete && <span className="animate-pulse bg-gray-300">|</span>}
                          </div>
                        </div>
                      )}
                      
                      {response.reasoningResponse && (
                        <div className="mt-4">
                          <button
                            onClick={() => toggleExpanded(modelKey)}
                            className="px-4 py-2 text-sm bg-gray-200 border border-gray-400 hover:bg-gray-300 text-black flex items-center gap-2"
                            style={{
                              boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.8), inset -1px -1px 2px rgba(0,0,0,0.3)'
                            }}
                          >
                            <span className={`transform transition-transform ${expandedModels[modelKey] ? 'rotate-90' : ''}`}>
                              ▶
                            </span>
                            {expandedModels[modelKey] ? 'Hide Extended Reasoning' : 'Show Extended Reasoning'}
                          </button>
                          {expandedModels[modelKey] && (
                            <div className="mt-4 p-4 bg-white border border-gray-300 rounded">
                              <div className="whitespace-pre-wrap text-sm leading-relaxed text-black">
                                {response.reasoningResponse}
                                {!response.isComplete && <span className="animate-pulse bg-gray-300">|</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {response.chatResponse && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => navigator.clipboard.writeText(response.chatResponse + (response.reasoningResponse ? '\n\nExtended Reasoning:\n' + response.reasoningResponse : ''))}
                            className="px-4 py-2 text-sm bg-gray-200 border border-gray-400 hover:bg-gray-300 text-black"
                            style={{
                              boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.8), inset -1px -1px 2px rgba(0,0,0,0.3)'
                            }}
                          >
                            Copy Full Response
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default ArguePopup;
