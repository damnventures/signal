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
}

const CapsulesWindow: React.FC<CapsulesWindowProps> = ({ 
  capsules, 
  onSelectCapsule, 
  initialPosition, 
  onBringToFront, 
  initialZIndex, 
  id 
}) => {
  return (
    <DraggableWindow
      id={id}
      onBringToFront={onBringToFront}
      initialZIndex={initialZIndex}
      initialPosition={initialPosition}
    >
      <div className="window-content capsules-list">
        <h2 className="main-heading">Capsules</h2>
        <ul>
          {capsules.length > 0 ? (
            capsules.map(capsule => (
              <li key={capsule._id} onClick={() => onSelectCapsule(capsule._id)}>
                <img src="/file.svg" alt="Capsule" />
                <span>{capsule.name}</span>
              </li>
            ))
          ) : (
            <li className="empty-state">
              <span>No capsules found. Create your first capsule by uploading content.</span>
            </li>
          )}
        </ul>
      </div>
    </DraggableWindow>
  );
};

export default CapsulesWindow;
