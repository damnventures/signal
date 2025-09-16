'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ToolExecution } from '../core/types';
import { useToolState } from '../core/toolState';
import { useAuth } from '../contexts/AuthContext';

interface ToolProgressProps {
  execution: ToolExecution;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  onRefreshCapsule?: () => void;
  onRefreshWrap?: () => void;
  capsuleName?: string;
}

const ToolProgress: React.FC<ToolProgressProps> = ({
  execution,
  onBringToFront,
  initialZIndex,
  onRefreshCapsule,
  onRefreshWrap,
  capsuleName
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zIndex, setZIndex] = useState(initialZIndex);
  const [currentPhase, setCurrentPhase] = useState<'downloading' | 'craig_processing' | 'waiting_backend' | 'backend_processing' | 'adding_to_capsule' | 'refreshing_wrap' | 'completed'>('downloading');
  const [shrinkedJob, setShrinkedJob] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState('downloading video');
  const [progress, setProgress] = useState(0);
  
  const { removeExecution } = useToolState();
  const { apiKey } = useAuth();
  const windowRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate initial position
  useEffect(() => {
    if (position.x === 0 && position.y === 0) {
      const initialX = (window.innerWidth - 300) / 2 + Math.random() * 100 - 50;
      const initialY = Math.max(50, (window.innerHeight - 80) / 2 + Math.random() * 100 - 50);
      setPosition({ x: initialX, y: initialY });
    }
  }, [position.x, position.y]);

  // Handle dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!windowRef.current) return;
    
    const rect = windowRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    onBringToFront(execution.id);
    setZIndex(initialZIndex + 1000);
    e.preventDefault();
  }, [onBringToFront, execution.id, initialZIndex]);

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

  const handleClose = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    removeExecution(execution.id);
  }, [execution.id, removeExecution]);

  // Enhanced polling logic for Signal jobs
  useEffect(() => {
    // Only start enhanced polling if this is a media processing job that completed download phase
    if (execution.toolId === 'media-collector' && execution.status === 'completed' && currentPhase === 'downloading') {
      console.log('[ToolProgress] Download completed, starting enhanced polling for Shrinked job');
      setCurrentPhase('craig_processing');
      setStatusMessage('sending to craig for processing');
      setProgress(25);

      // Start polling for the new Shrinked job
      const jobName = execution.result?.jobName || execution.input?.jobName;
      if (jobName) {
        startShrinkedJobPolling(jobName);
      } else {
        console.warn('[ToolProgress] No job name found for polling');
        setStatusMessage('completed, unable to track');
        setCurrentPhase('completed');
        setProgress(100);
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [execution.status, execution.toolId, currentPhase, execution.result, execution.input]);

  const startShrinkedJobPolling = useCallback(async (jobName: string) => {
    const pollForJob = async () => {
      try {
        console.log(`[ToolProgress] Polling for job with name: ${jobName}`);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (apiKey) {
          headers['x-api-key'] = apiKey;
        }

        const response = await fetch('/api/jobs', {
          headers,
        });
        
        if (!response.ok) {
          console.error(`[ToolProgress] Failed to fetch jobs: ${response.status}`);
          return false;
        }
        
        const jobs = await response.json();
        console.log(`[ToolProgress] Fetched ${jobs.length} jobs, looking for: ${jobName}`);
        
        // Look for a job that matches our job name
        const matchingJob = jobs.find((job: any) => 
          job.name === jobName || 
          job.jobName === jobName ||
          (job.name && job.name.includes(jobName.substring(0, 20))) // Partial match fallback
        );
        
        if (matchingJob) {
          console.log(`[ToolProgress] Found matching job:`, matchingJob);
          setShrinkedJob(matchingJob);
          setCurrentPhase('backend_processing');
          setStatusMessage('craig transforming content');
          setProgress(50);

          // Start polling this specific job's status
          startJobStatusPolling(matchingJob._id || matchingJob.id);
          return true;
        }
        
        return false;
      } catch (error) {
        console.error('[ToolProgress] Error polling for jobs:', error);
        return false;
      }
    };
    
    // Wait a bit for job to be created on the backend before first check
    setCurrentPhase('waiting_backend');
    setStatusMessage('waiting for shrinked backend');
    setProgress(35);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Initial check
    const found = await pollForJob();
    if (!found) {
      // Poll every 4 seconds for up to 3 minutes to give more time for job creation
      let attempts = 0;
      const maxAttempts = 45; // 3 minutes / 4 seconds

      pollingIntervalRef.current = setInterval(async () => {
        attempts++;
        const found = await pollForJob();

        if (found || attempts >= maxAttempts) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }

          if (!found) {
            setStatusMessage('completed, unable to track');
            setCurrentPhase('completed');
            setProgress(100);
          }
        }
      }, 4000);
    }
  }, [apiKey]);

  const startJobStatusPolling = useCallback(async (jobId: string) => {
    const pollJobStatus = async () => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (apiKey) {
          headers['x-api-key'] = apiKey;
        }
        
        const response = await fetch(`/api/jobs?id=${jobId}`, {
          headers,
        });
        
        if (!response.ok) {
          console.error(`[ToolProgress] Failed to fetch job status: ${response.status}`);
          return false;
        }
        
        const jobData = await response.json();
        console.log(`[ToolProgress] Job status update:`, jobData);
        
        setShrinkedJob(jobData);
        
        // Update message based on job status
        if (jobData.status === 'completed' || jobData.status === 'finished') {
          setCurrentPhase('adding_to_capsule');
          setStatusMessage(capsuleName ? `adding to ${capsuleName.toLowerCase()} capsule` : 'adding to capsule');
          setProgress(75);

          // Clear polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }

          // Refresh both capsule content and wrap summary
          console.log('[ToolProgress] Job completed, triggering capsule and wrap refresh');

          // Add a small delay to ensure the document is fully processed
          setTimeout(async () => {
            // Refresh capsule content first
            if (onRefreshCapsule) {
              onRefreshCapsule();
            }

            setCurrentPhase('refreshing_wrap');
            setStatusMessage('updating wrap summary');
            setProgress(90);

            // Then refresh wrap summary to include the new content
            if (onRefreshWrap) {
              console.log('[ToolProgress] Triggering wrap refresh after job completion');
              onRefreshWrap();
            }

            // Final completion
            setTimeout(() => {
              setCurrentPhase('completed');
              setStatusMessage(capsuleName ? `added to ${capsuleName.toLowerCase()}` : 'media added successfully');
              setProgress(100);
            }, 2000);
          }, 2000);
          
          return true;
        } else if (jobData.status === 'error' || jobData.status === 'failed') {
          setStatusMessage(`failed: ${jobData.error || 'unknown error'}`);
          setCurrentPhase('completed');
          setProgress(100);

          // Clear polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          return true;
        } else {
          // Job still processing - keep progress at 50-65%
          const statusText = jobData.status || 'processing';
          setStatusMessage(`craig ${statusText}`);
          setProgress(50 + Math.random() * 15); // Subtle progress variation
        }
        
        return false;
      } catch (error) {
        console.error('[ToolProgress] Error polling job status:', error);
        return false;
      }
    };
    
    // Poll every 6 seconds for job status (slightly slower to reduce server load)
    pollingIntervalRef.current = setInterval(async () => {
      const completed = await pollJobStatus();
      if (completed && pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    }, 6000);
    
    // Also do initial check
    await pollJobStatus();
  }, [apiKey]);


  return (
    <div
      ref={windowRef}
      className="retro-window"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: zIndex,
        width: '300px',
        height: '80px',
        cursor: isDragging ? 'grabbing' : 'default',
        background: '#c0c0c0',
        border: '2px outset #c0c0c0',
        fontFamily: 'MS Sans Serif, Geneva, sans-serif',
        fontSize: '11px',
      }}
    >
      {/* Title Bar */}
      <div
        style={{
          background: 'linear-gradient(90deg, #0000ff 0%, #000080 100%)',
          color: 'white',
          padding: '2px 4px',
          fontWeight: 'normal',
          fontSize: '11px',
          userSelect: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        onMouseDown={handleMouseDown}
      >
        <span>media processing</span>

        <button
          onClick={handleClose}
          style={{
            width: '16px',
            height: '14px',
            background: '#c0c0c0',
            border: '1px outset #c0c0c0',
            fontSize: '10px',
            fontWeight: 'bold',
            cursor: 'pointer',
            color: 'black',
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '8px' }}>
        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: '12px',
          background: '#ffffff',
          border: '1px inset #c0c0c0',
          marginBottom: '6px'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: currentPhase === 'completed' && statusMessage.includes('failed')
              ? '#ff0000'
              : '#0000ff',
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* Status and Progress */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '10px',
          color: '#000000'
        }}>
          <span>{statusMessage}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

    </div>
  );
};

export default ToolProgress;