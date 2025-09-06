'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface WrapToolProps {
  onSummaryUpdate?: (summary: string) => void;
  className?: string;
  showAsButton?: boolean;
  autoFetch?: boolean;
  lastStateHash?: string;
  onStateHashUpdate?: (newHash: string) => void;
}

interface WrapResponse {
  success: boolean;
  summary: string;
  stateChanged: boolean;
  stateHash: string;
  metadata?: {
    capsuleCount: number;
    processingTimeMs: number;
    timestamp: string;
    contentSizeKB: number;
  };
  error?: string;
}

const WrapTool: React.FC<WrapToolProps> = ({ 
  onSummaryUpdate,
  className = '',
  showAsButton = false,
  autoFetch = false,
  lastStateHash,
  onStateHashUpdate
}) => {
  const { user, accessToken, apiKey } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [metadata, setMetadata] = useState<WrapResponse['metadata']>();
  const [stateHash, setStateHash] = useState<string>('');

  const fetchWrapSummary = useCallback(async () => {
    if (!user || (!accessToken && !apiKey)) {
      console.log('[WrapTool] No user or auth token available');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('[WrapTool] Fetching wrap summary...');
      const response = await fetch('/api/wrap-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          apiKey,
          lastStateHash
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch wrap summary: ${response.status}`);
      }

      const result: WrapResponse = await response.json();
      console.log('[WrapTool] Received wrap response:', result);

      if (result.success || result.summary) {
        setSummary(result.summary);
        setMetadata(result.metadata);
        setStateHash(result.stateHash);
        
        // Notify parent components
        if (onSummaryUpdate) {
          onSummaryUpdate(result.summary);
        }
        if (onStateHashUpdate) {
          onStateHashUpdate(result.stateHash);
        }
      } else {
        setError(result.error || 'Failed to generate summary');
      }

    } catch (error) {
      console.error('[WrapTool] Error fetching wrap summary:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [user, accessToken, apiKey, lastStateHash, onSummaryUpdate, onStateHashUpdate]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && user && (accessToken || apiKey)) {
      console.log('[WrapTool] Auto-fetching wrap summary');
      fetchWrapSummary();
    }
  }, [autoFetch, user, accessToken, apiKey, fetchWrapSummary]);

  // Render as button
  if (showAsButton) {
    return (
      <button
        className={`wrap-tool-button ${className}`}
        onClick={fetchWrapSummary}
        disabled={isLoading || !user}
        title="Generate Wrap Summary"
      >
        {isLoading ? (
          <span>📊 ...</span>
        ) : (
          <span>📊</span>
        )}
        {isLoading && <span className="loading-text">Wrap</span>}
      </button>
    );
  }

  // Render as widget/display
  return (
    <div className={`wrap-tool-widget ${className}`}>
      {!user ? (
        <div className="wrap-no-user">
          <p>Login to see your capsule summary</p>
        </div>
      ) : (
        <>
          {!summary && !isLoading && !error && (
            <button
              className="wrap-generate-btn"
              onClick={fetchWrapSummary}
              disabled={isLoading}
            >
              Generate Summary
            </button>
          )}

          {isLoading && (
            <div className="wrap-loading">
              <span>📊</span>
              <span>Generating wrap summary...</span>
            </div>
          )}

          {error && (
            <div className="wrap-error">
              <p>Error: {error}</p>
              <button onClick={fetchWrapSummary} className="wrap-retry-btn">
                Retry
              </button>
            </div>
          )}

          {summary && !isLoading && (
            <div className="wrap-summary">
              <div className="wrap-summary-text">
                {summary}
              </div>
              {metadata && (
                <div className="wrap-metadata">
                  <small>
                    {metadata.capsuleCount} capsule{metadata.capsuleCount !== 1 ? 's' : ''} • 
                    Generated {new Date(metadata.timestamp).toLocaleTimeString()}
                  </small>
                </div>
              )}
              <button 
                onClick={fetchWrapSummary} 
                className="wrap-refresh-btn"
                title="Refresh summary"
              >
                🔄
              </button>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .wrap-tool-widget {
          max-width: 400px;
          margin: 10px 0;
        }

        .wrap-tool-button {
          background: #4a90e2;
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s ease;
        }

        .wrap-tool-button:hover:not(:disabled) {
          background: #357abd;
          transform: translateY(-1px);
        }

        .wrap-tool-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .wrap-generate-btn, .wrap-retry-btn, .wrap-refresh-btn {
          background: #4a90e2;
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
          font-size: 12px;
          padding: 6px 10px;
          transition: background 0.2s ease;
        }

        .wrap-generate-btn:hover, .wrap-retry-btn:hover, .wrap-refresh-btn:hover {
          background: #357abd;
        }

        .wrap-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #666;
          font-size: 14px;
        }

        .wrap-error {
          color: #e74c3c;
          font-size: 14px;
        }

        .wrap-error p {
          margin: 0 0 8px 0;
        }

        .wrap-summary {
          position: relative;
        }

        .wrap-summary-text {
          background: #f8f9fa;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.4;
          padding: 12px;
          border-left: 4px solid #4a90e2;
        }

        .wrap-metadata {
          margin-top: 6px;
          text-align: right;
        }

        .wrap-metadata small {
          color: #666;
          font-size: 11px;
        }

        .wrap-refresh-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(255, 255, 255, 0.8);
          color: #666;
          font-size: 12px;
          padding: 4px 6px;
          opacity: 0.7;
        }

        .wrap-refresh-btn:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.95);
        }

        .wrap-no-user p {
          color: #666;
          font-size: 14px;
          margin: 0;
        }

        .loading-text {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.8);
        }
      `}</style>
    </div>
  );
};

export default WrapTool;