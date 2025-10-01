import React from 'react';
import DraggableWindow from './DraggableWindow';
import { SHRINKED_CAPSULES, isShrinkedCapsule, getShrinkedCapsuleById } from '../constants/shrinkedCapsules';

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
  const getAuthorName = (capsule: Capsule): string => {
    if (capsule.owner && (capsule.shared || capsule.isShared)) {
      return capsule.owner.email?.split('@')[0] || capsule.owner.username || 'Shared';
    }
    if (isShrinkedCapsule(capsule._id)) {
      return 'Shrinked';
    }
    return currentUser?.email?.split('@')[0] || currentUser?.username || 'You';
  };

  const getIcon = (capsule: Capsule) => {
    const shrinkedCapsule = getShrinkedCapsuleById(capsule._id);
    if (shrinkedCapsule && shrinkedCapsule.icon) {
      const isWebp = ['smartglasses', 'tvhost', 'coin'].includes(shrinkedCapsule.icon);
      const extension = isWebp ? 'webp' : 'png';
      return <img src={`/items/${shrinkedCapsule.icon}.${extension}`} alt={capsule.name} className="capsule-list-icon" />;
    }
    // Default icon for user-owned or other capsules
    return <img src="/capsule.png" alt="Capsule" className="capsule-list-icon" />;
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
                    {getIcon(capsule)}
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

