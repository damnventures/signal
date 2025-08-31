'use client';

import { create } from 'zustand';
import { ToolExecution, ToolConfirmation } from './types';

interface ToolState {
  // Active tool executions
  executions: ToolExecution[];
  
  // Pending confirmations
  pendingConfirmations: ToolConfirmation[];
  
  // Actions
  addExecution: (execution: ToolExecution) => void;
  updateExecution: (id: string, updates: Partial<ToolExecution>) => void;
  removeExecution: (id: string) => void;
  
  addConfirmation: (confirmation: ToolConfirmation) => void;
  removeConfirmation: (id: string) => void;
  
  // Getters
  getExecutionsByStatus: (status: ToolExecution['status']) => ToolExecution[];
  getActiveExecutions: () => ToolExecution[];
}

export const useToolState = create<ToolState>((set, get) => ({
  executions: [],
  pendingConfirmations: [],
  
  addExecution: (execution) => {
    set((state) => ({
      executions: [...state.executions, execution]
    }));
  },
  
  updateExecution: (id, updates) => {
    set((state) => ({
      executions: state.executions.map(exec =>
        exec.id === id ? { ...exec, ...updates } : exec
      )
    }));
  },
  
  removeExecution: (id) => {
    set((state) => ({
      executions: state.executions.filter(exec => exec.id !== id)
    }));
  },
  
  addConfirmation: (confirmation) => {
    set((state) => ({
      pendingConfirmations: [...state.pendingConfirmations, confirmation]
    }));
  },
  
  removeConfirmation: (id) => {
    set((state) => ({
      pendingConfirmations: state.pendingConfirmations.filter(conf => conf.id !== id)
    }));
  },
  
  getExecutionsByStatus: (status) => {
    return get().executions.filter(exec => exec.status === status);
  },
  
  getActiveExecutions: () => {
    return get().executions.filter(exec => 
      exec.status === 'pending' || exec.status === 'processing'
    );
  }
}));

// Helper function to generate unique IDs
export function generateToolId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}