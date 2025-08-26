"use client";

import React, { useState, useRef, useEffect } from 'react';

interface DraggableWindowProps {
  id: string;
  children: React.ReactNode;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  initialPosition: { x: number; y: number };
  style?: React.CSSProperties;
  className?: string;
  isDraggable?: boolean;
  title?: string;
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({
  id,
  children,
  onBringToFront,
  initialZIndex,
  initialPosition,
  style,
  className,
  isDraggable = true,
  title,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [zIndex, setZIndex] = useState(initialZIndex);
  const offset = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDraggable) return;
    if (windowRef.current) {
      setIsDragging(true);
      onBringToFront(id);
      offset.current = {
        x: e.clientX - windowRef.current.getBoundingClientRect().left,
        y: e.clientY - windowRef.current.getBoundingClientRect().top,
      };
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isDraggable) return;
    if (windowRef.current) {
      setIsDragging(true);
      onBringToFront(id);
      offset.current = {
        x: e.touches[0].clientX - windowRef.current.getBoundingClientRect().left,
        y: e.touches[0].clientY - windowRef.current.getBoundingClientRect().top,
      };
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - offset.current.x,
      y: e.clientY - offset.current.y,
    });
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.touches[0].clientX - offset.current.x,
      y: e.touches[0].clientY - offset.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  useEffect(() => {
    setZIndex(initialZIndex);
  }, [initialZIndex]);

  const dynamicStyle = isDraggable ? {
    position: 'absolute' as const,
    left: position.x,
    top: position.y,
    zIndex: zIndex,
    ...style,
  } : {
    cursor: 'default',
    zIndex: zIndex,
    ...style,
  };

  return (
    <div
      ref={windowRef}
      className={`window ${className || ''}`}
      style={dynamicStyle}
    >
      <div 
        className="window-top-bar"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <div className="window-controls">
            <div className="window-control control-red"></div>
            <div className="window-control control-yellow"></div>
            <div className="window-control control-green"></div>
        </div>
        {title && <div className="window-title-bar">{title}</div>}
      </div>
      {children}
    </div>
  );
};

export default DraggableWindow;
