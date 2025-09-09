'use client';

import React, { useState, useEffect } from 'react';

interface StoreProps {
  isOpen: boolean;
  onClose: () => void;
}

const Store: React.FC<StoreProps> = ({ isOpen, onClose }) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

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

  // Sources/Capsules data (6 per row)
  const sources = [
    { id: '1', name: 'YC Reducto AI', author: 'Y Combinator', icon: 'cd' },
    { id: '2', name: 'Slack Conversations', author: 'Workspace Team', icon: 'cd' },
    { id: '3', name: 'Meeting Notes Q3', author: 'John Smith', icon: 'cd' },
    { id: '4', name: 'Research Papers', author: 'MIT Research', icon: 'cd' },
    { id: '5', name: 'Podcast Transcripts', author: 'Joe Rogan', icon: 'cd' },
    { id: '6', name: 'Code Reviews', author: 'Engineering', icon: 'cd' },
    { id: '7', name: 'Customer Feedback', author: 'Support Team', icon: 'cd' },
    { id: '8', name: 'Design Systems', author: 'Design Team', icon: 'cd' },
    { id: '9', name: 'API Documentation', author: 'Platform', icon: 'cd' },
    { id: '10', name: 'Sales Calls', author: 'Sales Team', icon: 'cd' },
    { id: '11', name: 'Twitter Threads', author: 'Social Media', icon: 'cd' },
    { id: '12', name: 'YouTube Videos', author: 'Content Team', icon: 'cd' },
    { id: '13', name: 'Blog Articles', author: 'Marketing', icon: 'cd' },
    { id: '14', name: 'User Interviews', author: 'Product Team', icon: 'cd' },
    { id: '15', name: 'Industry Reports', author: 'Research', icon: 'cd' },
    { id: '16', name: 'Conference Talks', author: 'Speakers', icon: 'cd' },
    { id: '17', name: 'Books Summary', author: 'Library', icon: 'cd' },
    { id: '18', name: 'Email Threads', author: 'Communications', icon: 'cd' }
  ];

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
          <div className="status-left">{sources.length} items</div>
          <div className="status-center">Available sources and capsules</div>
          <div className="status-right">Ready to connect</div>
        </div>

        {/* Content */}
        <div className="store-content">
          <div className="store-grid">
            {sources.map((source) => (
              <div 
                key={source.id} 
                className={`source-card ${selectedSource === source.id ? 'selected' : ''}`}
                onClick={() => setSelectedSource(source.id)}
              >
                <div className="source-icon">
                  💿
                </div>
                <div className="source-info">
                  <div className="source-name">{source.name}</div>
                  <div className="source-author">{source.author}</div>
                </div>
              </div>
            ))}
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
          animation: fadeIn 0.2s ease-out;
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
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.3);
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
          background: #f0f0f0;
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

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default Store;