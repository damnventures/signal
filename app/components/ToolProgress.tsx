'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ToolExecution } from '../core/types';
import { useToolState } from '../core/toolState';

interface ToolProgressProps {
  execution: ToolExecution;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
}

const ToolProgress: React.FC<ToolProgressProps> = ({
  execution,
  onBringToFront,
  initialZIndex
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zIndex, setZIndex] = useState(initialZIndex);
  
  const { removeExecution } = useToolState();
  const windowRef = useRef<HTMLDivElement>(null);

  // Calculate initial position
  useEffect(() => {
    if (position.x === 0 && position.y === 0) {
      const initialX = (window.innerWidth - 400) / 2 + Math.random() * 100 - 50;
      const initialY = Math.max(50, (window.innerHeight - 200) / 2 + Math.random() * 100 - 50);
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
    removeExecution(execution.id);
  }, [execution.id, removeExecution]);

  const getStatusIcon = () => {
    switch (execution.status) {
      case 'pending': return '⏳';
      case 'processing': return '🔄';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const getStatusColor = () => {
    switch (execution.status) {
      case 'pending': return '#FFC107';
      case 'processing': return '#2196F3';
      case 'completed': return '#4CAF50';
      case 'error': return '#F44336';
      default: return '#757575';
    }
  };

  return (
    <div
      ref={windowRef}
      className="retro-window"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: zIndex,
        width: '400px',
        cursor: isDragging ? 'grabbing' : 'default',
        background: 'linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%)',
        border: '1px solid black',
        boxShadow: '8px 8px 0px #808080, 16px 16px 0px #404040',
        borderRadius: '20px',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%)',
          color: 'black',
          padding: '6px 12px',
          fontWeight: 'bold',
          fontSize: '13px',
          fontFamily: 'Geneva, sans-serif',
          userSelect: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          position: 'absolute',
          top: '-1px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'fit-content',
          zIndex: 1,
        }}
        onMouseDown={handleMouseDown}
      >
        {getStatusIcon()} Tool Progress
      </div>

      {/* Close Button */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          width: '20px',
          height: '20px',
          background: '#c0c0c0',
          border: '2px outset #c0c0c0',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'black',
          zIndex: 10,
        }}
      >
        ×
      </button>

      {/* Content */}
      <div style={{ padding: '20px', fontSize: '12px', fontFamily: 'Geneva, sans-serif' }}>
        {/* Status */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>{getStatusIcon()}</span>
            <span style={{ 
              fontWeight: 'bold', 
              color: getStatusColor(),
              textTransform: 'capitalize'
            }}>
              {execution.status}
            </span>
          </div>
          
          {/* Progress Bar (for processing status) */}
          {execution.status === 'processing' && execution.progress !== undefined && (
            <div style={{
              width: '100%',
              height: '20px',
              background: '#f0f0f0',
              border: '2px inset #c0c0c0',
              marginBottom: '8px'
            }}>
              <div style={{
                width: `${execution.progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #4CAF50 0%, #45a049 100%)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          )}
          
          {execution.progress !== undefined && (
            <div style={{ fontSize: '11px', color: '#666' }}>
              Progress: {Math.round(execution.progress)}%
            </div>
          )}
        </div>

        {/* Tool Info */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            Tool: {execution.toolId}
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>
            Started: {execution.createdAt.toLocaleString()}
          </div>
          {execution.completedAt && (
            <div style={{ fontSize: '11px', color: '#666' }}>
              Completed: {execution.completedAt.toLocaleString()}
            </div>
          )}
        </div>

        {/* Result or Error */}
        {execution.result && (
          <div style={{
            marginBottom: '12px',
            padding: '8px',
            background: '#e8f5e8',
            border: '1px solid #4CAF50',
            borderRadius: '4px'
          }}>
            <div style={{ fontWeight: 'bold', color: '#4CAF50', marginBottom: '4px' }}>
              ✅ Success:
            </div>
            <div style={{ fontSize: '11px' }}>
              {execution.result.message || JSON.stringify(execution.result)}
            </div>
          </div>
        )}

        {execution.error && (
          <div style={{
            marginBottom: '12px',
            padding: '8px',
            background: '#ffe8e8',
            border: '1px solid #F44336',
            borderRadius: '4px'
          }}>
            <div style={{ fontWeight: 'bold', color: '#F44336', marginBottom: '4px' }}>
              ❌ Error:
            </div>
            <div style={{ fontSize: '11px' }}>
              {execution.error}
            </div>
          </div>
        )}

        {/* Processing Animation */}
        {execution.status === 'processing' && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            color: '#2196F3'
          }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: '4px',
                    height: '4px',
                    background: '#2196F3',
                    borderRadius: '50%',
                    animation: `bounce 1.4s infinite ease-in-out both`,
                    animationDelay: `${i * 0.16}s`
                  }}
                />
              ))}
            </div>
            Processing media files...
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ToolProgress;