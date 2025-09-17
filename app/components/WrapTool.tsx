'use client';

import React, { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { executeWrapRequest, retryOn3040 } from '../utils/requestManager';

interface WrapToolProps {
  onSummaryUpdate?: (summary: string) => void;
  className?: string;
  showAsButton?: boolean;
  autoFetch?: boolean;
  lastStateHash?: string;
  onStateHashUpdate?: (newHash: string) => void;
  onWrapStart?: () => void;  // Called when wrap starts
  onStatusMessage?: (message: string) => void;  // For status bar updates
  isManualTrigger?: boolean;  // Distinguish manual vs auto wrap
}

export interface WrapToolRef {
  triggerWrap: () => void;
}

interface WrapResponse {
  success: boolean;
  summary?: string;
  message?: string;  // Alternative field name for summary content
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

const WrapTool = forwardRef<WrapToolRef, WrapToolProps>(({
  onSummaryUpdate,
  className = '',
  showAsButton = false,
  autoFetch = false,
  lastStateHash,
  onStateHashUpdate,
  onWrapStart,
  onStatusMessage,
  isManualTrigger = false
}, ref) => {
  const { user, accessToken, apiKey } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [metadata, setMetadata] = useState<WrapResponse['metadata']>();
  const [stateHash, setStateHash] = useState<string>('');
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);

  const fetchWrapSummary = useCallback(async (manualTrigger = false) => {
    if (!user || (!accessToken && !apiKey)) {
      console.log('[WrapTool] No user or auth token available');
      return;
    }

    const source = manualTrigger ? 'manual-button' : 'auto-trigger';
    console.log('[WrapTool] Wrap request initiated from:', source);

    // Only call callbacks for manual triggers (button clicks)
    if (manualTrigger) {
      if (onWrapStart) {
        onWrapStart();
      }
      if (onStatusMessage) {
        onStatusMessage('Generating wrap summary...');
      }
    }

    setIsLoading(true);
    setError('');
    setLastRequestTime(Date.now());

    try {
      // Use simple request deduplication with 3040 retry
      const minInterval = manualTrigger ? 2000 : 5000;
      const result = await executeWrapRequest(async () => {
        return await retryOn3040(async () => {
          console.log('[WrapTool] Fetching wrap summary...', {
            manualTrigger,
            source,
            timestamp: new Date().toISOString()
          });

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

          return await response.json();
        });
      }, source, minInterval);

      console.log('[WrapTool] Received wrap response:', result);

      // Handle both successful AI responses and fallback responses
      if (result.summary || result.message) {
        const summaryText = result.summary || result.message || '';
        setSummary(summaryText);
        setMetadata(result.metadata);
        setStateHash(result.stateHash);

        // Notify parent components
        if (onSummaryUpdate) {
          // Check if state changed significantly (only for successful AI responses)
          let summaryToShow = summaryText;
          if (result.success && !result.stateChanged && result.stateHash === lastStateHash) {
            summaryToShow += '\n\n*Not much has changed since your last wrap - your capsules are up to date.*';
          }
          onSummaryUpdate(summaryToShow);
        }
        if (onStateHashUpdate) {
          onStateHashUpdate(result.stateHash);
        }

        // For fallback responses, also show the error
        if (!result.success && result.error) {
          console.warn('[WrapTool] Using fallback summary due to:', result.error);
        }
      } else {
        setError(result.error || 'Failed to generate summary');
      }

    } catch (error) {
      console.error('[WrapTool] Error fetching wrap summary:', error);

      // Handle specific error cases gracefully
      if (error instanceof Error) {
        if (error.message.includes('already in progress')) {
          console.log('[WrapTool] Wrap request already in progress, silently skipping');
          // Don't show error for duplicate requests
        } else if (error.message.includes('Rate limited')) {
          console.log('[WrapTool] Rate limited, silently skipping');
          // Don't show error for rate limiting
        } else {
          setError(error.message);
        }
      } else {
        setError('Unknown error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, accessToken, apiKey, lastStateHash, onSummaryUpdate, onStateHashUpdate, lastRequestTime]);

  // Expose the triggerWrap method via ref
  useImperativeHandle(ref, () => ({
    triggerWrap: () => fetchWrapSummary(true)
  }), [fetchWrapSummary]);

  // Auto-fetch on mount if enabled - start early for optimal timing
  const [hasAutoFetched, setHasAutoFetched] = useState(false);
  
  useEffect(() => {
    if (autoFetch && user && (accessToken || apiKey) && !hasAutoFetched) {
      console.log('[WrapTool] Auto-fetching wrap summary early for optimal timing');
      setHasAutoFetched(true);
      // Small delay to ensure auth is fully ready
      const timer = setTimeout(() => {
        fetchWrapSummary(false);  // false = auto trigger (no callbacks)
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFetch, user, accessToken, apiKey, hasAutoFetched, fetchWrapSummary]);

  // Render as button
  if (showAsButton) {
    return (
      <button
        className={`wrap-tool-button ${className}`}
        onClick={() => fetchWrapSummary(true)}  // true = manual trigger
        disabled={isLoading || !user}
        title="Generate Wrap Summary"
      >
        <span>📊</span>
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
              onClick={() => fetchWrapSummary(true)}
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
              <button onClick={() => fetchWrapSummary(true)} className="wrap-retry-btn">
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
                onClick={() => fetchWrapSummary(true)} 
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
});

WrapTool.displayName = 'WrapTool';

export default WrapTool;