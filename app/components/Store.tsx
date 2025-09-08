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
        {/* Header */}
        <div className="store-header">
          <h2 className="store-title">Integrations Store</h2>
          <button 
            className="store-close-btn"
            onClick={onClose}
            aria-label="Close store"
          >
            ×
          </button>
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
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 9998;
          animation: fadeIn 0.2s ease-out;
        }

        .store-popup {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #ffffff;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          transform: translateY(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .store-popup-open {
          transform: translateY(0);
        }

        .store-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 32px;
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .store-title {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: #111827;
        }

        .store-close-btn {
          background: none;
          border: none;
          font-size: 32px;
          color: #6b7280;
          cursor: pointer;
          padding: 4px;
          line-height: 1;
          transition: color 0.2s ease;
          border-radius: 6px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .store-close-btn:hover {
          color: #374151;
          background: #f3f4f6;
        }

        .store-content {
          flex: 1;
          overflow-y: auto;
          padding: 32px;
        }

        .store-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .integration-card {
          background: #ffffff;
          border: 2px solid #e5e7eb;
          border-radius: 16px;
          padding: 24px 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 160px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .integration-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
          transform: translateY(-2px);
        }

        .integration-icon {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .integration-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .integration-name {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .integration-description {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
          line-height: 1.4;
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
            gap: 16px;
          }
          
          .store-content {
            padding: 24px 16px;
          }
        }

        @media (max-width: 600px) {
          .store-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .store-header {
            padding: 16px 20px;
          }
          
          .store-title {
            font-size: 20px;
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