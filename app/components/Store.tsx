'use client';

import React, { useState, useEffect } from 'react';

interface StoreProps {
  isOpen: boolean;
  onClose: () => void;
}

const Store: React.FC<StoreProps> = ({ isOpen, onClose }) => {
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

  // Placeholder integrations data (6 per row)
  const integrations = Array.from({ length: 18 }, (_, index) => ({
    id: `integration-${index + 1}`,
    name: `Integration ${index + 1}`,
    description: `Description for integration ${index + 1}`,
    icon: '🔗', // Placeholder icon
    category: 'General'
  }));

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
          <div className="status-left">{integrations.length} items</div>
          <div className="status-center">Available integrations and tools</div>
          <div className="status-right">Ready to connect</div>
        </div>

        {/* Content */}
        <div className="store-content">
          <div className="store-grid">
            {integrations.map((integration) => (
              <div key={integration.id} className="integration-card">
                <div className="integration-icon">
                  {integration.icon}
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">{integration.name}</h3>
                  <p className="integration-description">{integration.description}</p>
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
          background: #f0f0f0;
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
          background: #e0e0e0;
          border-bottom: 2px solid #000000;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
        }

        .store-title-text {
          font-size: 12px;
          font-weight: bold;
          color: #000000;
          text-align: center;
        }

        .store-close-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          font-size: 16px;
          color: #000000;
          cursor: pointer;
          padding: 2px 6px;
          line-height: 1;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
        }

        .store-close-btn:hover {
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
          background: #f0f0f0;
        }

        .store-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
          max-width: 100%;
          margin: 0;
        }

        .integration-card {
          background: #ffffff;
          border: 1px solid #000000;
          border-radius: 0;
          padding: 12px 8px;
          text-align: center;
          cursor: pointer;
          transition: background-color 0.1s ease;
          min-height: 100px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          box-shadow: 1px 1px 0 #c0c0c0;
        }

        .integration-card:hover {
          background: #e0e0e0;
        }

        .integration-card:active {
          background: #d0d0d0;
          box-shadow: inset 1px 1px 2px #a0a0a0;
        }

        .integration-icon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .integration-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .integration-name {
          margin: 0 0 4px 0;
          font-size: 11px;
          font-weight: bold;
          color: #000000;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
        }

        .integration-description {
          margin: 0;
          font-size: 9px;
          color: #000000;
          line-height: 1.2;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
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