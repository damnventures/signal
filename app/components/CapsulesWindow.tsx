import React from 'react';
import DraggableWindow from './DraggableWindow';
import { SHRINKED_CAPSULE_IDS } from '../constants/shrinkedCapsules';

export interface Capsule {
  _id: string;
  name: string;
  isPublic: boolean;
  shared?: boolean;
  isShared?: boolean;
  owner?: {
    email?: string;
    username?: string;
  };
}

interface CapsulesWindowProps {
  capsules: Capsule[];
  onSelectCapsule: (capsuleId: string) => void;
  initialPosition: { x: number; y: number };
  onBringToFront: (id: string) => void;
  initialZIndex: number;
  id: string;
  selectedCapsuleId?: string | null;
  currentUser?: {
    email?: string;
    username?: string;
  } | null;
}

const CapsulesWindow: React.FC<CapsulesWindowProps> = ({ 
  capsules, 
  onSelectCapsule, 
  initialPosition, 
  onBringToFront, 
  initialZIndex, 
  id,
  selectedCapsuleId,
  currentUser
}) => {
  // Helper function to get the author name for a capsule
  const getAuthorName = (capsule: Capsule): string => {
    // Check if it's a shared capsule (has owner info)
    if (capsule.owner && (capsule.shared || capsule.isShared)) {
      return capsule.owner.email?.split('@')[0] || capsule.owner.username || 'Shared';
    }
    
    // Check if it's a known Shrinked system capsule
    if (SHRINKED_CAPSULE_IDS.includes(capsule._id)) {
      return 'Shrinked';
    }
    
    // Default to current user or "You"
    return currentUser?.email?.split('@')[0] || currentUser?.username || 'You';
  };
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
            capsules.map(capsule => {
              const author = getAuthorName(capsule);
              const isShrinkedCapsule = author === 'Shrinked';
              
              return (
                <div 
                  key={capsule._id} 
                  className={`capsule-item ${selectedCapsuleId === capsule._id ? 'active' : ''} ${isShrinkedCapsule ? 'shrinked' : ''}`}
                  onClick={() => onSelectCapsule(capsule._id)}
                >
                  <div className="capsule-icon-cell">
                    <img src="/capsule.png" alt="Capsule" className="capsule-list-icon" />
                  </div>
                  <div className="capsule-info">
                    <div className="capsule-name-cell">
                      {capsule.name || 'Untitled'}
                    </div>
                    <div className="capsule-author">
                      {author}
                    </div>
                  </div>
                </div>
              );
            })
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
