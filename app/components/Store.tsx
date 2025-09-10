'use client';

import React, { useState, useEffect } from 'react';

interface Capsule {
  _id: string;
  name: string;
  isPublic: boolean;
}

interface SourceItem {
  id: string;
  name: string;
  author: string;
  type: 'user' | 'shrinked' | 'coming' | 'add-new';
  capsuleId: string | null;
  icon?: string;
}

interface User {
  email?: string;
  username?: string;
}

interface StoreProps {
  isOpen: boolean;
  onClose: () => void;
  userCapsules?: Capsule[];
  user?: User | null;
  onRefreshCapsules?: () => void;
}

const Store: React.FC<StoreProps> = ({ isOpen, onClose, userCapsules = [], user, onRefreshCapsules }) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [isCreatingCapsule, setIsCreatingCapsule] = useState(false);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent background scroll when store is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle creating a new capsule
  const handleCreateCapsule = async () => {
    if (!user || isCreatingCapsule) return;
    
    setIsCreatingCapsule(true);
    
    try {
      const accessToken = localStorage.getItem('auth_access_token');
      if (!accessToken) {
        console.error('[Store] No access token found');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api.shrinked.ai'}/capsules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: `New Capsule ${new Date().toLocaleString()}`
        })
      });

      if (response.ok) {
        const newCapsule = await response.json();
        console.log('[Store] Capsule created successfully:', newCapsule);
        
        // Refresh the capsules list
        if (onRefreshCapsules) {
          onRefreshCapsules();
        }
        
        // Show success feedback (optional)
        setSelectedSource(newCapsule._id);
      } else {
        console.error('[Store] Failed to create capsule:', response.status);
      }
    } catch (error) {
      console.error('[Store] Error creating capsule:', error);
    } finally {
      setIsCreatingCapsule(false);
    }
  };

  // User's capsules (real data when authenticated, fallback when not)
  const getUserCapsules = () => {
    if (user && userCapsules.length > 0) {
      // Use real user capsule data
      return userCapsules.map(capsule => ({
        id: capsule._id,
        name: capsule.name || 'Untitled Capsule',
        author: user.email?.split('@')[0] || user.username || 'You',
        type: 'user' as const,
        capsuleId: capsule._id
      } as SourceItem));
    } else if (user) {
      // User is authenticated but has no capsules
      return [];
    } else {
      // Non-authenticated user - show demo data
      return [
        { id: 'user-1', name: 'My Research', author: 'You', type: 'user' as const, capsuleId: null } as SourceItem,
        { id: 'user-2', name: 'Meeting Notes', author: 'You', type: 'user' as const, capsuleId: null } as SourceItem,
      ];
    }
  };

  const userCapsulesData = getUserCapsules();

  // Shrinked shared capsules (available to add/use)
  const shrinkedCapsules: SourceItem[] = [
    { id: 'shrink-1', name: 'YC Reducto AI', author: 'Shrinked', type: 'shrinked', capsuleId: '6887e02fa01e2f4073d3bb51' },
    { id: 'shrink-2', name: 'AI Research Papers', author: 'Shrinked', type: 'shrinked', capsuleId: '6887e02fa01e2f4073d3bb52' },
    { id: 'shrink-3', name: 'Startup Insights', author: 'Shrinked', type: 'shrinked', capsuleId: '6887e02fa01e2f4073d3bb53' },
    { id: 'shrink-4', name: 'Tech Podcasts', author: 'Shrinked', type: 'shrinked', capsuleId: '6887e02fa01e2f4073d3bb54' },
  ];

  // Coming soon items (passive, not clickable) - organized by category
  const comingSoonItems: SourceItem[] = [
    // Data Sources
    { id: 'soon-1', name: 'Email Inbox', author: 'Gmail, Outlook, etc', type: 'coming', capsuleId: null, icon: 'mailbox' },
    { id: 'soon-2', name: 'Voice Records', author: 'Audio transcription', type: 'coming', capsuleId: null, icon: 'voicerecords' },
    { id: 'soon-3', name: 'Smart Glasses POV', author: 'Meta, Apple Vision', type: 'coming', capsuleId: null, icon: 'smartglasses' },
    { id: 'soon-4', name: 'Apple Notes', author: 'Notes sync', type: 'coming', capsuleId: null, icon: 'notepad' },
    { id: 'soon-5', name: 'Call Recordings', author: 'Meetings, phone calls', type: 'coming', capsuleId: null, icon: 'calls' },
    { id: 'soon-6', name: 'Excel/Numbers', author: 'Spreadsheet analysis', type: 'coming', capsuleId: null, icon: 'excel' },
    
    // Expansion Packs
    { id: 'soon-7', name: 'Chess (FIDE)', author: 'Game analysis pack', type: 'coming', capsuleId: null, icon: 'chess-pieces' },
    { id: 'soon-8', name: 'Bible Study', author: 'Scripture analysis', type: 'coming', capsuleId: null, icon: 'books' },
    { id: 'soon-9', name: 'Harry Potter', author: 'Book series pack', type: 'coming', capsuleId: null, icon: 'books' },
    
    // Creator Integrations
    { id: 'soon-10', name: 'John Oliver', author: 'YouTube creator', type: 'coming', capsuleId: null, icon: 'tvhost' },
    { id: 'soon-11', name: 'Gordon Ramsay', author: 'Cooking recipes', type: 'coming', capsuleId: null, icon: 'recipe' },
    
    // Future Tools
    { id: 'soon-12', name: 'Crypto Wallet', author: 'DeFi integration', type: 'coming', capsuleId: null, icon: 'coin' },
  ];

  // Add new capsule - only for authenticated users, positioned at the end (bottom right)
  const addNewCapsule: SourceItem = { id: 'add-new', name: 'Add New Capsule', author: '', type: 'add-new', capsuleId: null };

  const allSources = user 
    ? [...userCapsulesData, ...shrinkedCapsules, ...comingSoonItems, addNewCapsule]
    : [...userCapsulesData, ...shrinkedCapsules, ...comingSoonItems];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="store-backdrop"
        onClick={onClose}
      />
      
      {/* Store Popup */}
      <div className={`store-popup ${isOpen ? 'store-popup-open' : ''}`}>
        {/* Title Bar */}
        <div className="store-title-bar">
          <div className="store-title-text">Sources</div>
          <button 
            className="store-close-btn"
            onClick={onClose}
            aria-label="Close store"
          >
            ×
          </button>
        </div>

        {/* Status Bar */}
        <div className="store-status-bar">
          <div className="status-left">{allSources.length} items</div>
          <div className="status-center">{userCapsulesData.length + (user ? 1 : 0)} yours • {shrinkedCapsules.length} from Shrinked • {comingSoonItems.length} coming soon</div>
          <div className="status-right">Ready to connect</div>
        </div>

        {/* Content */}
        <div className="store-content">
          <div className="store-grid">
            {allSources.map((source: SourceItem) => {
              const isClickable = source.type !== 'coming';
              const getIcon = () => {
                if (source.type === 'add-new') return isCreatingCapsule ? '⏳' : '➕';
                if (source.type === 'coming' && source.icon) {
                  const isWebp = source.icon === 'smartglasses' || source.icon === 'tvhost' || source.icon === 'coin';
                  const extension = isWebp ? 'webp' : 'png';
                  return <img src={`/items/${source.icon}.${extension}`} alt={source.name} style={{ width: '32px', height: '32px', imageRendering: 'pixelated' }} />;
                }
                if (source.type === 'coming') return '⏳';
                return '💿';
              };

              const handleClick = () => {
                if (!isClickable) return;
                
                if (source.type === 'add-new') {
                  handleCreateCapsule();
                } else {
                  setSelectedSource(source.id);
                }
              };
              
              return (
                <div 
                  key={source.id} 
                  className={`source-card ${selectedSource === source.id ? 'selected' : ''} ${source.type} ${isCreatingCapsule && source.type === 'add-new' ? 'creating' : ''}`}
                  onClick={handleClick}
                  style={{ cursor: isClickable && !(isCreatingCapsule && source.type === 'add-new') ? 'pointer' : 'default' }}
                >
                  <div className="source-icon">
                    {getIcon()}
                  </div>
                  <div className="source-info">
                    <div className="source-name">
                      {source.type === 'add-new' && isCreatingCapsule ? (
                        <>Creating<span className="loading-dots"></span></>
                      ) : (
                        source.name
                      )}
                    </div>
                    <div className="source-author">{source.author}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        .store-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 9998;
        }

        .store-popup {
          position: fixed;
          top: 5%;
          left: 5%;
          width: 90%;
          height: 90%;
          background: #ffffff;
          border: 2px solid #000000;
          border-radius: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          transform: translateY(100%);
          transition: transform 0.2s ease-out;
          box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.25);
        }

        .store-popup-open {
          transform: translateY(0);
        }

        .store-title-bar {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          padding: 8px 16px;
          background: #ffffff;
          border-bottom: 2px solid #000000;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
        }
        
        .store-title-bar::before {
          content: '';
          position: absolute;
          top: 6px;
          left: 3px;
          right: 3px;
          bottom: 6px;
          background-image: repeating-linear-gradient(
            0deg,
            #000000 0px,
            #000000 1px,
            transparent 1px,
            transparent 3px
          );
          z-index: 1;
        }

        .store-title-text {
          font-size: 12px;
          font-weight: bold;
          color: #000000;
          text-align: center;
          background: #ffffff;
          padding: 0 8px;
          z-index: 2;
          position: relative;
        }

        .store-close-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: #ffffff;
          border: none;
          font-size: 16px;
          color: #000000;
          cursor: pointer;
          padding: 2px 6px;
          line-height: 1;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          z-index: 2;
        }

        .store-close-btn:hover {
          background: #e0e0e0;
        }

        .store-close-btn:active {
          background: #d0d0d0;
        }

        .store-status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 16px;
          background: #e8e8e8;
          border-bottom: 1px solid #c0c0c0;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 10px;
          color: #000000;
          background-image: repeating-linear-gradient(
            90deg,
            transparent,
            transparent 1px,
            #d0d0d0 1px,
            #d0d0d0 2px
          );
        }

        .status-left, .status-center, .status-right {
          flex: 1;
        }

        .status-center {
          text-align: center;
        }

        .status-right {
          text-align: right;
        }

        .store-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          background: #ffffff;
        }

        .store-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
          max-width: 100%;
          margin: 0;
        }

        .source-card {
          background: transparent;
          border: none;
          border-radius: 0;
          padding: 16px 12px;
          text-align: center;
          cursor: pointer;
          min-height: 120px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
        }

        .source-icon {
          font-size: 32px;
          margin-bottom: 12px;
          filter: grayscale(0.3) brightness(0.9);
        }

        .source-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .source-name {
          font-size: 11px;
          font-weight: bold;
          color: #000000;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          text-align: center;
          line-height: 1.2;
          padding: 2px 4px;
          transition: all 0.1s ease;
        }

        .source-card.selected .source-name {
          background: #000000;
          color: #ffffff;
        }

        /* Coming soon items - passive styling */
        .source-card.coming {
          opacity: 0.5;
        }

        .source-card.coming .source-name {
          color: #999999;
        }

        .source-card.coming .source-author {
          color: #cccccc;
        }

        /* Add new capsule - special styling */
        .source-card.add-new .source-icon {
          font-size: 24px;
          opacity: 0.7;
        }

        .source-card.add-new .source-name {
          font-style: italic;
          color: #666666;
        }

        .source-card.add-new.creating {
          opacity: 0.6;
          pointer-events: none;
        }

        .source-card.add-new.creating .source-name {
          font-style: normal;
          color: #000000;
        }

        /* User capsules */
        .source-card.user .source-name {
          color: #000000;
        }

        /* Shrinked capsules */
        .source-card.shrinked .source-author {
          color: #0066cc;
          font-weight: bold;
        }

        .source-author {
          font-size: 9px;
          color: #666666;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          text-align: center;
          line-height: 1.1;
        }

        /* Responsive adjustments */
        @media (max-width: 1400px) {
          .store-grid {
            grid-template-columns: repeat(5, 1fr);
          }
        }

        @media (max-width: 1200px) {
          .store-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        @media (max-width: 900px) {
          .store-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }
          
          .store-content {
            padding: 12px;
          }

          .store-popup {
            top: 2.5%;
            left: 2.5%;
            width: 95%;
            height: 95%;
          }
        }

        @media (max-width: 600px) {
          .store-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .store-title-bar {
            padding: 6px 12px;
          }
          
          .store-title-text {
            font-size: 11px;
          }

          .store-status-bar {
            padding: 3px 12px;
            font-size: 9px;
          }
        }

      `}</style>
    </>
  );
};

export default Store;