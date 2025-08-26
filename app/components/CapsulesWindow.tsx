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
      title="Capsules"
    >
      <div className="window-content capsules-list">
        <ul>
          {capsules.map(capsule => (
            <li key={capsule._id} onClick={() => onSelectCapsule(capsule._id)}>
              <img src="/file.svg" alt="Capsule" />
              <span>{capsule.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </DraggableWindow>
  );
};

export default CapsulesWindow;