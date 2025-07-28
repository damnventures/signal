"use client";

import React, { useState, useRef, useEffect } from 'react';

interface DraggableWindowProps {
  id: string;
  children: React.ReactNode;
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  initialPosition: { x: number; y: number };
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({
  id,
  children,
  onBringToFront,
  initialZIndex,
  initialPosition,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [zIndex, setZIndex] = useState(initialZIndex);
  const offset = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowRef.current) {
      setIsDragging(true);
      onBringToFront(id); // Bring this window to front on click/drag start
      offset.current = {
        x: e.clientX - windowRef.current.getBoundingClientRect().left,
        y: e.clientY - windowRef.current.getBoundingClientRect().top,
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

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Update zIndex when initialZIndex prop changes (managed by parent)
  useEffect(() => {
    setZIndex(initialZIndex);
  }, [initialZIndex]);

  return (
    <div
      ref={windowRef}
      className="window"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: zIndex,
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  );
};

export default DraggableWindow;
