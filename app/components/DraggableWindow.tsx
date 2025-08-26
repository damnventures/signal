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
  isDraggable?: boolean; // New prop
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({
  id,
  children,
  onBringToFront,
  initialZIndex,
  initialPosition,
  style,
  className,
  isDraggable = true, // Default to true
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [zIndex, setZIndex] = useState(initialZIndex);
  const offset = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDraggable) return; // Prevent dragging if not draggable
    if (windowRef.current) {
      setIsDragging(true);
      onBringToFront(id); // Bring this window to front on click/drag start
      offset.current = {
        x: e.clientX - windowRef.current.getBoundingClientRect().left,
        y: e.clientY - windowRef.current.getBoundingClientRect().top,
      };
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isDraggable) return; // Prevent dragging if not draggable
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

  // Update zIndex when initialZIndex prop changes (managed by parent)
  useEffect(() => {
    setZIndex(initialZIndex);
  }, [initialZIndex]);

  // Dynamic style based on isDraggable
  const dynamicStyle = isDraggable ? {
    position: 'absolute' as const,
    left: position.x,
    top: position.y,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: zIndex,
    ...style,
  } : {
    // For non-draggable windows, let CSS handle positioning
    cursor: 'default',
    zIndex: zIndex,
    ...style,
  };

  return (
    <div
      ref={windowRef}
      className={`window ${className || ''}`}
      style={dynamicStyle}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {children}
    </div>
  );
};

export default DraggableWindow;