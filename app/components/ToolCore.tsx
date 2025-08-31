'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToolState, generateToolId } from '../core/toolState';
import { classifyIntent } from '../utils/systemWorker';
import { ToolExecution, ToolConfirmation, MediaCollectionData } from '../core/types';
import MediaCollectorConfirmation from './MediaCollectorConfirmation';
import ToolProgress from './ToolProgress';

interface ToolCoreProps {
  capsuleId: string;
  onArgueRequest: (question: string) => void;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
}

const ToolCore: React.FC<ToolCoreProps> = ({ 
  capsuleId, 
  onArgueRequest, 
  onBringToFront, 
  initialZIndex 
}) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { apiKey } = useAuth();
  
  const {
    pendingConfirmations,
    executions,
    addConfirmation,
    removeConfirmation,
    addExecution,
    updateExecution,
    getActiveExecutions
  } = useToolState();

  const handleUserInput = useCallback(async (userInput: string) => {
    if (!userInput.trim()) return;
    
    setIsProcessing(true);
    
    try {
      const classification = await classifyIntent(userInput, capsuleId);
      
      switch (classification.intent) {
        case 'tool':
          if (classification.action === 'collect_media') {
            await handleMediaCollection(classification.data, userInput);
          }
          break;
          
        case 'argue':
          onArgueRequest(classification.data.question);
          break;
          
        case 'communicate':
          // Handle general communication
          console.log('General communication:', classification.data);
          break;
      }
    } catch (error) {
      console.error('Failed to process input:', error);
    } finally {
      setIsProcessing(false);
      setInput('');
    }
  }, [capsuleId, onArgueRequest]);

  const handleMediaCollection = useCallback(async (data: MediaCollectionData, originalInput: string) => {
    const confirmationId = generateToolId();
    
    const confirmation: ToolConfirmation = {
      id: confirmationId,
      toolId: 'media-collector',
      action: 'collect_media',
      data: {
        ...data,
        capsuleId,
        jobName: data.jobName || `Media from ${new Date().toLocaleString()}`,
        originalInput
      },
      requiresConfirmation: true,
      onConfirm: async (confirmed: boolean, modifiedData?: any) => {
        removeConfirmation(confirmationId);
        
        if (confirmed) {
          const executionId = generateToolId();
          const execution: ToolExecution = {
            id: executionId,
            toolId: 'media-collector',
            status: 'pending',
            input: modifiedData || data,
            createdAt: new Date()
          };
          
          addExecution(execution);
          await executeMediaCollection(executionId, modifiedData || data);
        }
      }
    };
    
    addConfirmation(confirmation);
  }, [capsuleId, addConfirmation, removeConfirmation, addExecution]);

  const executeMediaCollection = useCallback(async (executionId: string, data: any) => {
    updateExecution(executionId, { status: 'processing', progress: 0 });
    
    try {
      const { processMediaWithWorker } = await import('../utils/systemWorker');
      
      for (let i = 0; i < data.urls.length; i++) {
        const url = data.urls[i];
        updateExecution(executionId, { progress: (i / data.urls.length) * 100 });
        
        const result = await processMediaWithWorker(
          url,
          data.capsuleId,
          `${data.jobName} - ${i + 1}`,
          apiKey || ''
        );
        
        if (result.error) {
          throw new Error(result.error);
        }
      }
      
      updateExecution(executionId, {
        status: 'completed',
        progress: 100,
        result: { message: `Successfully processed ${data.urls.length} media files` },
        completedAt: new Date()
      });
    } catch (error) {
      updateExecution(executionId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });
    }
  }, [apiKey, updateExecution]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUserInput(input);
  };

  const activeExecutions = getActiveExecutions();

  return (
    <div className="tool-core">
      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Drop a link, ask a question, or just chat..."
            style={{
              flex: 1,
              padding: '8px',
              border: '2px inset #c0c0c0',
              background: 'white',
              fontSize: '12px',
              fontFamily: 'Geneva, sans-serif'
            }}
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            style={{
              padding: '8px 12px',
              background: isProcessing ? '#d0d0d0' : '#c0c0c0',
              border: '2px solid #000000',
              boxShadow: '2px 2px 0px #808080',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: isProcessing ? 'default' : 'pointer',
              color: isProcessing ? '#808080' : 'black',
              fontFamily: 'Geneva, sans-serif'
            }}
          >
            {isProcessing ? 'Processing...' : 'Send'}
          </button>
        </div>
      </form>

      {/* Pending Confirmations */}
      {pendingConfirmations.map(confirmation => (
        <div key={confirmation.id}>
          {confirmation.toolId === 'media-collector' && (
            <MediaCollectorConfirmation
              confirmation={confirmation}
              onBringToFront={onBringToFront}
              initialZIndex={initialZIndex + 100}
            />
          )}
        </div>
      ))}

      {/* Active Executions */}
      {activeExecutions.map(execution => (
        <ToolProgress
          key={execution.id}
          execution={execution}
          onBringToFront={onBringToFront}
          initialZIndex={initialZIndex + 200}
        />
      ))}
    </div>
  );
};

export default ToolCore;