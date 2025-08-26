import React from 'react';
import DraggableWindow from './DraggableWindow';

export interface Capsule {
  _id: string;
  name: string;
  isPublic: boolean;
}

interface CapsulesWindowProps {
  capsules: Capsule[];
  onSelectCapsule: (capsuleId: string) => void;
  initialPosition: { x: number; y: number };
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  id: string;
  selectedCapsuleId?: string;
}

const CapsulesWindow: React.FC<CapsulesWindowProps> = ({ 
  capsules, 
  onSelectCapsule, 
  initialPosition, 
  onBringToFront, 
  initialZIndex, 
  id,
  selectedCapsuleId 
}) => {
  return (
    <DraggableWindow
      id={id}
      onBringToFront={onBringToFront}
      initialZIndex={initialZIndex}
      initialPosition={initialPosition}
    >
      <div className="window-content capsules-list">
        <div className="capsules-grid">
          {capsules.length > 0 ? (
            capsules.map(capsule => (
              <div 
                key={capsule._id} 
                className={`capsule-item ${selectedCapsuleId === capsule._id ? 'active' : ''}`}
                onClick={() => onSelectCapsule(capsule._id)}
              >
                <div className="capsule-icon-cell">
                  <img src="/capsule.png" alt="Capsule" className="capsule-list-icon" />
                </div>
                <div className="capsule-name-cell">
                  {capsule.name || 'Untitled'}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <span>No capsules found. Create your first capsule by uploading content.</span>
            </div>
          )}
        </div>
      </div>
    </DraggableWindow>
  );
};

export default CapsulesWindow;
