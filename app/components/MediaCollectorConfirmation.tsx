'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ToolConfirmation } from '../core/types';

interface MediaCollectorConfirmationProps {
  confirmation: ToolConfirmation;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
}

const MediaCollectorConfirmation: React.FC<MediaCollectorConfirmationProps> = ({
  confirmation,
  onBringToFront,
  initialZIndex
}) => {
  const [jobName, setJobName] = useState(confirmation.data.jobName || '');
  const [outputFormat, setOutputFormat] = useState<'mp3' | 'mp4'>(confirmation.data.suggestedFormat || 'mp3');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zIndex, setZIndex] = useState(initialZIndex);
  
  const windowRef = useRef<HTMLDivElement>(null);

  // Calculate initial position
  useEffect(() => {
    if (position.x === 0 && position.y === 0) {
      const initialX = (window.innerWidth - 450) / 2;
      const initialY = Math.max(50, (window.innerHeight - 300) / 2);
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
    onBringToFront(confirmation.id);
    setZIndex(initialZIndex + 1000);
    e.preventDefault();
  }, [onBringToFront, confirmation.id, initialZIndex]);

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

  const handleConfirm = useCallback(() => {
    const modifiedData = {
      ...confirmation.data,
      jobName: jobName.trim() || confirmation.data.jobName,
      outputFormat
    };
    confirmation.onConfirm(true, modifiedData);
  }, [confirmation, jobName, outputFormat]);

  const handleCancel = useCallback(() => {
    confirmation.onConfirm(false);
  }, [confirmation]);

  return (
    <div
      ref={windowRef}
      className="retro-window"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: zIndex,
        width: '450px',
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
        🔗 Confirm Media Collection
      </div>

      {/* Close Button */}
      <button
        onClick={handleCancel}
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
        {/* Detected URLs */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            📎 Detected Media ({confirmation.data.urls.length}):
          </div>
          {confirmation.data.urls.map((url: string, index: number) => (
            <div key={index} style={{ 
              marginBottom: '4px', 
              padding: '4px', 
              background: '#f0f0f0', 
              border: '1px inset #c0c0c0',
              fontSize: '11px',
              wordBreak: 'break-all'
            }}>
              <strong>{confirmation.data.platforms[index] || 'Unknown'}:</strong> {url}
            </div>
          ))}
        </div>

        {/* Job Name */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            📝 Job Name:
          </label>
          <input
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="Enter a descriptive name for this collection"
            style={{
              width: '100%',
              padding: '4px',
              border: '2px inset #c0c0c0',
              background: 'white',
              fontSize: '12px',
              fontFamily: 'Geneva, sans-serif',
            }}
          />
        </div>

        {/* Output Format */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            🎵 Output Format:
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="radio"
                value="mp3"
                checked={outputFormat === 'mp3'}
                onChange={(e) => setOutputFormat(e.target.value as 'mp3' | 'mp4')}
              />
              MP3 (Audio only)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="radio"
                value="mp4"
                checked={outputFormat === 'mp4'}
                onChange={(e) => setOutputFormat(e.target.value as 'mp3' | 'mp4')}
              />
              MP4 (Video)
            </label>
          </div>
        </div>

        {/* Target Capsule */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            🎯 Target Capsule:
          </div>
          <div style={{ 
            padding: '4px', 
            background: '#e0e0e0', 
            border: '1px inset #c0c0c0',
            fontSize: '11px'
          }}>
            {confirmation.data.capsuleId}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '8px 16px',
              background: '#c0c0c0',
              border: '2px solid #000000',
              boxShadow: '2px 2px 0px #808080, 4px 4px 0px #404040',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              color: 'black',
              fontFamily: 'Geneva, sans-serif',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '8px 16px',
              background: '#4CAF50',
              border: '2px solid #000000',
              boxShadow: '2px 2px 0px #808080, 4px 4px 0px #404040',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              color: 'white',
              fontFamily: 'Geneva, sans-serif',
            }}
          >
            🚀 Process Media
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaCollectorConfirmation;