'use client';

import React, { useState, useEffect } from 'react';
import { SHRINKED_CAPSULES } from '../constants/shrinkedCapsules';

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
  id: string;
  email?: string;
  username?: string;
}

interface StoreProps {
  isOpen: boolean;
  onClose: () => void;
  userCapsules?: Capsule[];
  user?: User | null;
  onRefreshCapsules?: () => void;
  accessibleShrinkedCapsules?: string[];
}

const Store: React.FC<StoreProps> = React.memo(({ isOpen, onClose, userCapsules = [], user, onRefreshCapsules, accessibleShrinkedCapsules = [] }) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [isCreatingCapsule, setIsCreatingCapsule] = useState(false);

  // Email interface state
  const [emailMode, setEmailMode] = useState(false);
  const [gmailConnectionId, setGmailConnectionId] = useState<string>('');
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [emailView, setEmailView] = useState<'main' | 'auth' | 'investing'>('main');

  // Sharing status state
  const [statusVisible, setStatusVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [sharedCapsules, setSharedCapsules] = useState<Set<string>>(new Set());

  // Loading state for initial store check
  const [isCheckingStore, setIsCheckingStore] = useState(false);
  const [storeChecked, setStoreChecked] = useState(false);
  const [loadedCapsules, setLoadedCapsules] = useState<Set<string>>(new Set());
  const [loadingCapsules, setLoadingCapsules] = useState<Set<string>>(new Set());
  
  // Track which items should be shown (vs completely hidden during initial phases)
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());

  // Check for saved Gmail connection on component mount
  useEffect(() => {
    const savedConnectionId = localStorage.getItem('gmailConnectionId');
    if (savedConnectionId) {
      setGmailConnectionId(savedConnectionId);
      setIsGmailConnected(true);
    }

    // Handle OAuth callback from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const connectionId = urlParams.get('connectionId');
    const status = urlParams.get('status');

    if (connectionId && status === 'success') {
      // OAuth callback successful
      setGmailConnectionId(connectionId);
      setIsGmailConnected(true);
      localStorage.setItem('gmailConnectionId', connectionId);
      localStorage.removeItem('pendingGmailConnectionId');

      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('connectionId');
      url.searchParams.delete('status');
      window.history.replaceState({}, document.title, url.toString());

      // Show success message
      setStatusMessage('Gmail connected successfully!');
      setStatusVisible(true);
      setTimeout(() => setStatusVisible(false), 2000);

      // Enter email mode if coming from auth
      if (emailMode) {
        setEmailView('main');
      }
    } else if (connectionId && status === 'failed') {
      // OAuth callback failed
      localStorage.removeItem('pendingGmailConnectionId');
      setStatusMessage('Gmail connection failed');
      setStatusVisible(true);
      setTimeout(() => setStatusVisible(false), 3000);
    }
  }, [emailMode]);

  // Gmail connection handlers
  const handleGmailAuth = async () => {
    try {
      // Initiate Composio OAuth flow for Gmail
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api.shrinked.ai'}/composio/initiate-gmail-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityId: user?.id || 'default',
          redirectUrl: `${window.location.origin}/composio-callback`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to initiate Gmail connection');
      }

      const { redirectUrl, connectionId } = await response.json();

      // Store the pending connection ID for callback processing
      localStorage.setItem('pendingGmailConnectionId', connectionId);

      // Redirect to Composio OAuth flow
      window.location.href = redirectUrl;

    } catch (error) {
      console.error('Gmail auth error:', error);
      setStatusMessage('Failed to initiate Gmail connection');
      setStatusVisible(true);
      setTimeout(() => setStatusVisible(false), 3000);
    }
  };

  const handleEmailIconClick = () => {
    setEmailMode(true);
    if (!isGmailConnected) {
      setEmailView('auth');
    } else {
      setEmailView('main');
    }
  };

  const handleBackToStore = () => {
    setEmailMode(false);
    setEmailView('main');
  };

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
      // Reset store state when closing so it checks again next time
      if (!isOpen) {
        setStoreChecked(false);
        setLoadedCapsules(new Set());
        setLoadingCapsules(new Set());
        setVisibleItems(new Set());
        setStatusVisible(false);
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Sync sharedCapsules state with accessibleShrinkedCapsules prop
  useEffect(() => {
    if (accessibleShrinkedCapsules.length > 0) {
      console.log('[Store] Syncing shared capsules state with accessible capsules:', accessibleShrinkedCapsules);
      setSharedCapsules(new Set(accessibleShrinkedCapsules));
    }
  }, [accessibleShrinkedCapsules]);

  // Simulate checking store contents when opened
  useEffect(() => {
    if (isOpen && !storeChecked) {
      setIsCheckingStore(true);
      setStatusVisible(true);
      
      // Phase 1: Initial check
      setStatusMessage('Checking what\'s in store...');
      
      setTimeout(() => {
        // Phase 2: Permissions check
        setStatusMessage('Scanning user access permissions...');
      }, 1500);
      
      // Load in logical order: user capsules -> accessible capsules -> coming soon
      const loadingOrder: string[] = [];
      
      // 1. User's own capsules (if any)
      const userCapsuleIds = userCapsulesData.map(c => c.id);
      loadingOrder.push(...userCapsuleIds);
      
      // 2. Shrinked capsules user can access (using centralized constants)
      const shrinkedCapsuleMap: Record<string, string> = {};
      SHRINKED_CAPSULES.forEach((capsule, index) => {
        shrinkedCapsuleMap[capsule.id] = `shrink-${index + 1}`;
      });
      
      const accessibleShrinkedIds = accessibleShrinkedCapsules
        .map(capsuleId => shrinkedCapsuleMap[capsuleId])
        .filter(Boolean);
      const allShrinkedIds = Object.values(shrinkedCapsuleMap);
      const inaccessibleShrinkedIds = allShrinkedIds.filter(id => !accessibleShrinkedIds.includes(id));
      
      console.log('[Store] Loading order setup:', {
        accessibleShrinkedCapsules,
        accessibleShrinkedIds,
        inaccessibleShrinkedIds,
        userCapsuleIds
      });
      
      loadingOrder.push(...accessibleShrinkedIds);
      
      // 3. Other Shrinked capsules (user has no access)
      loadingOrder.push(...inaccessibleShrinkedIds);
      
      // 4. Coming soon items (load more for demo)
      const comingSoonIds = ['email-inbox', 'soon-2', 'soon-3', 'soon-4', 'soon-5', 'soon-6', 'soon-7', 'soon-8', 'soon-9', 'soon-10', 'soon-11', 'soon-fashion', 'soon-12'];
      loadingOrder.push(...comingSoonIds);
      
      setTimeout(() => {
        // Phase 3: Start loading capsules
        setStatusMessage('Loading available capsules...');
        
        loadingOrder.forEach((id, index) => {
          setTimeout(() => {
            // First make the item visible (but not loaded)
            setVisibleItems(prev => new Set([...prev, id]));

            // Then immediately show loading animation
            setTimeout(() => {
              setLoadingCapsules(prev => new Set([...prev, id]));

              // Then complete loading after animation
              setTimeout(() => {
                setLoadingCapsules(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(id);
                  return newSet;
                });
                setLoadedCapsules(prev => new Set([...prev, id]));
              }, 800); // Longer loading animation per item
            }, 100); // Longer delay to see the unloaded state first
          }, index * 600); // 600ms between each item load start
        });
      }, 3000);
      
      setTimeout(() => {
        // Phase 4: Complete - after all items loaded
        setIsCheckingStore(false);
        setStoreChecked(true);

        if (user && user.email) {
          // Authenticated user - show "Store ready" and hide after 2 seconds
          setStatusMessage('Store ready.');
          setTimeout(() => {
            setStatusVisible(false);
          }, 2000);
        } else {
          // Non-authenticated user - show persistent "demo" message
          setStatusMessage('demo');
          // Keep statusVisible true - don't hide the demo message
        }
      }, 3000 + (loadingOrder.length * 600) + 900); // After all items fully loaded (including their 900ms animation)
    }
  }, [isOpen, storeChecked, user]);



  const handleShareToggle = async (capsuleId: string, capsuleName: string) => {
    if (!user || !user.email || isSharing) return;

    console.log(`[Store] Starting share toggle for capsule ${capsuleId} (${capsuleName})`);
    console.log(`[Store] User: ${user.email}, Currently shared:`, sharedCapsules.has(capsuleId));

    setIsSharing(true);
    setStatusVisible(true);
    
    const isCurrentlyShared = accessibleShrinkedCapsules.includes(capsuleId);
    
    if (!isCurrentlyShared) {
      // Share the capsule
      console.log(`[Store] Sharing capsule ${capsuleId} with ${user.email}`);
      setStatusMessage('Requesting access to ' + capsuleName + '...');
      
      setTimeout(() => {
        setStatusMessage('Context shared. You now have access.');
        setTimeout(() => {
          setStatusMessage('You can ask questions about this content.');
          setTimeout(() => {
            setStatusVisible(false);
          }, 2000);
        }, 1500);
      }, 1000);
      
      console.log(`[Store] Adding ${capsuleId} to sharedCapsules set`);
      setSharedCapsules(prev => {
        const newSet = new Set([...prev, capsuleId]);
        console.log(`[Store] Updated sharedCapsules:`, Array.from(newSet));
        return newSet;
      });
      setIsSharing(false);

      // Actual API call
      try {
        console.log(`[Store] Making share API call to /api/capsules/${capsuleId}/share`);
        const shareResponse = await fetch(`/api/capsules/${capsuleId}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, role: 'viewer' }),
        });

        console.log(`[Store] Share response status: ${shareResponse.status}`);
        if (shareResponse.ok) {
          console.log(`[Store] Share successful, now accepting invite`);
          const apiKey = localStorage.getItem('auth_api_key');
          console.log(`[Store] Using API key (last 4 chars): ...${apiKey?.slice(-4) || 'none'}`);
          
          const acceptResponse = await fetch(`/api/capsules/${capsuleId}/accept-invite`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey || ''
            },
            body: JSON.stringify({ email: user.email }),
          });
          
          console.log(`[Store] Accept invite response status: ${acceptResponse.status}`);
          if (acceptResponse.ok) {
            console.log(`[Store] Accept invite successful, verifying access...`);

            // Verify the user actually has access by checking the capsule
            try {
              const verifyResponse = await fetch(`/api/capsule-signal?capsuleId=${capsuleId}`, {
                headers: { 'x-api-key': apiKey || '' }
              });

              if (verifyResponse.ok) {
                console.log(`[Store] Access verified! Refreshing capsules`);
                setStatusMessage('Access granted! You can now explore this content.');
                // Refresh capsules to show the newly shared capsule
                if (onRefreshCapsules) {
                  setTimeout(() => {
                    console.log(`[Store] Calling onRefreshCapsules to refresh capsule list after sharing ${capsuleName}`);
                    onRefreshCapsules();
                  }, 1000);
                } else {
                  console.warn(`[Store] No onRefreshCapsules callback provided`);
                }
              } else {
                console.error(`[Store] Access verification failed`);
                setStatusMessage('Hmm, looks like you still need permission. Try asking nicely? 🤷‍♀️');
                // Remove from shared capsules since access was denied
                setSharedCapsules(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(capsuleId);
                  return newSet;
                });
                setTimeout(() => setStatusVisible(false), 3000);
              }
            } catch (error) {
              console.error(`[Store] Access verification error:`, error);
              setStatusMessage('Something went wrong. The digital gremlins are at it again.');
              setTimeout(() => setStatusVisible(false), 3000);
            }
          } else {
            console.error(`[Store] Accept invite failed:`, await acceptResponse.text());
          }
        } else {
          const errorText = await shareResponse.text();
          console.error(`[Store] Share failed:`, errorText);

          // Show sassy error message based on status
          if (shareResponse.status === 401 || shareResponse.status === 403) {
            setStatusMessage('Access denied. This content is exclusive. Very exclusive. 💅');
          } else if (shareResponse.status === 404) {
            setStatusMessage('Content not found. It\'s probably hiding in another dimension.');
          } else {
            setStatusMessage('Sharing failed. The internet is having trust issues today.');
          }

          // Remove from shared capsules since sharing failed
          setSharedCapsules(prev => {
            const newSet = new Set(prev);
            newSet.delete(capsuleId);
            return newSet;
          });
          setTimeout(() => setStatusVisible(false), 3000);
        }
      } catch (error) {
        console.error('[Store] Sharing error:', error);
      }
    } else {
      // Unshare the capsule
      setStatusMessage('Revoking access to ' + capsuleName + '...');
      
      setTimeout(() => {
        setStatusMessage('Access removed.');
        setTimeout(() => {
          setStatusVisible(false);
        }, 2000);
      }, 1000);
      
      setSharedCapsules(prev => {
        const newSet = new Set(prev);
        newSet.delete(capsuleId);
        return newSet;
      });
      setIsSharing(false);

      // Actual API call - remove user access using system key (follows Shrinked API spec)
      try {
        const userId = user.id || (user as any)._id;
        console.log(`[Store] Unsharing capsule ${capsuleId} for user ${userId} (${user.email})`);

        const response = await fetch(`/api/capsules/${capsuleId}/access/${userId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`[Store] Unshare failed:`, response.status);
          setStatusMessage('Failed to remove access. Try again?');
          // Restore the capsule to shared state since removal failed
          setSharedCapsules(prev => {
            const newSet = new Set(prev);
            newSet.add(capsuleId);
            return newSet;
          });
          setTimeout(() => setStatusVisible(false), 3000);
          return;
        }

        console.log(`[Store] Unshare successful for capsule ${capsuleId}`);

        // Refresh capsules to remove the unshared capsule from the list
        if (onRefreshCapsules) {
          setTimeout(() => {
            onRefreshCapsules();
          }, 1000);
        }
      } catch (error) {
        console.error('Unsharing error:', error);
      }
    }
  };

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

  // Shrinked shared capsules (dynamically generated from constants)
  const shrinkedCapsules: SourceItem[] = SHRINKED_CAPSULES.map((capsule, index) => ({
    id: `shrink-${index + 1}`,
    name: capsule.name,
    author: capsule.author,
    type: 'shrinked' as const,
    capsuleId: capsule.id,
    icon: capsule.icon
  }));

  // Coming soon items (passive, not clickable) - organized by category
  const comingSoonItems: SourceItem[] = [
    // Data Sources
    { id: 'email-inbox', name: 'Email Inbox', author: 'Gmail, Outlook, etc', type: 'coming', capsuleId: null, icon: 'mailbox' },
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
    { id: 'soon-fashion', name: 'Style Context', author: 'Brands, trends, fits', type: 'coming', capsuleId: null, icon: 'toolbox-tools' },
    { id: 'soon-12', name: 'Crypto Wallet', author: 'DeFi integration', type: 'coming', capsuleId: null, icon: 'coin' },
  ];

  // Add new capsule - only for authenticated users, positioned at the end (bottom right)
  const addNewCapsule: SourceItem = { id: 'add-new', name: 'Add New Capsule', author: '', type: 'add-new', capsuleId: null };

  // Filter out user capsules that are already defined as Shrinked system capsules to avoid duplicates
  const shrinkedCapsuleIds = shrinkedCapsules.map(c => c.capsuleId);
  const filteredUserCapsules = userCapsulesData.filter(capsule =>
    !shrinkedCapsuleIds.includes(capsule.capsuleId)
  );

  const allSources = user
    ? [...filteredUserCapsules, ...shrinkedCapsules, ...comingSoonItems, addNewCapsule]
    : [...filteredUserCapsules, ...shrinkedCapsules, ...comingSoonItems];

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
          <div className="store-title-text">Skills</div>
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
          {!emailMode ? (
            // Standard Store Grid
            <div className="store-grid">
              {allSources.filter((source: SourceItem) => {
                // Always show user capsules and add-new button
                if (source.type === 'user' || source.type === 'add-new') return true;
                // Always show accessible shrinked capsules (even when loading)
                if (source.type === 'shrinked' && source.capsuleId && accessibleShrinkedCapsules.includes(source.capsuleId)) return true;
                // Only show other items if they're visible
                return visibleItems.has(source.id);
              }).map((source: SourceItem) => {
              const isClickable = (source.type !== 'coming' || source.id === 'email-inbox') && user && user.email;
              const isVisible = source.type === 'user' || source.type === 'add-new' || visibleItems.has(source.id);
              // For accessible shrinked capsules, they should still go through the loading animation
              const isAccessibleShrinked = source.type === 'shrinked' && source.capsuleId && accessibleShrinkedCapsules.includes(source.capsuleId);
              const isLoaded = source.type === 'user' || source.type === 'add-new' || loadedCapsules.has(source.id);
              const isCurrentlyLoading = loadingCapsules.has(source.id);
              const getIcon = () => {
                if (source.type === 'add-new') return isCreatingCapsule ? '⏳' : '➕';

                // Special handling for Email Inbox
                if (source.id === 'email-inbox' && source.icon) {
                  return <img src={`/items/${source.icon}.png`} alt={source.name} style={{ width: '70px', height: '70px', imageRendering: 'pixelated' }} />;
                }

                // Show loading spinner when actively loading (prioritize over custom icons)
                if ((source.type === 'shrinked' || source.type === 'coming') && isCurrentlyLoading) {
                  return <div className="loading-spinner">⏳</div>;
                }
                // Show static loading icon when not loaded (prioritize over custom icons)
                if ((source.type === 'shrinked' || source.type === 'coming') && !isLoaded) {
                  return '⏳';
                }

                // Show custom icon only when loaded
                if ((source.type === 'coming' || source.type === 'shrinked') && source.icon) {
                  const isWebp = source.icon === 'smartglasses' || source.icon === 'tvhost' || source.icon === 'coin';
                  const extension = isWebp ? 'webp' : 'png';
                  return <img src={`/items/${source.icon}.${extension}`} alt={source.name} style={{ width: '70px', height: '70px', imageRendering: 'pixelated' }} />;
                }

                return '💿';
              };

              const handleClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (!isClickable || !isLoaded) return;

                if (source.type === 'add-new') {
                  handleCreateCapsule();
                } else if (source.id === 'email-inbox') {
                  // Handle Email Inbox click - enter email mode
                  handleEmailIconClick();
                } else if (source.type === 'shrinked' && source.capsuleId && user && user.email && isLoaded) {
                  // Shrinked capsule - handle sharing (AUTH USERS ONLY)
                  handleShareToggle(source.capsuleId, source.name);
                } else {
                  // Regular selection for non-auth users or other capsules
                  setSelectedSource(source.id);
                }
              };
              
              // Check if user has access to this Shrinked capsule (either owned or shared)
              const userHasAccess = source.type === 'shrinked' && source.capsuleId && accessibleShrinkedCapsules.includes(source.capsuleId);
              const isSharedWithUser = user && userHasAccess;
              
              // Debug logging for accessible capsule styling (commented out to reduce spam)
              // if (source.capsuleId === '68c32cf3735fb4ac0ef3ccbf') {
              //   console.log(`[Store] LastWeekTonight Preview access check:`, {
              //     hasUser: !!user,
              //     sourceType: source.type,
              //     capsuleId: source.capsuleId,
              //     accessibleCapsules: accessibleShrinkedCapsules,
              //     userHasAccess,
              //     isSharedWithUser
              //   });
              // }
              
              return (
                <div
                  key={source.id}
                  className={`source-card ${selectedSource === source.id ? 'selected' : ''} ${isSharedWithUser ? 'user' : source.type} ${isCreatingCapsule && source.type === 'add-new' ? 'creating' : ''} ${(!isLoaded && source.type === 'shrinked') || isCurrentlyLoading ? 'loading' : ''} ${source.id === 'email-inbox' ? 'email-inbox-active' : ''}`}
                  onClick={handleClick}
                  style={{ cursor: (isClickable && isLoaded && !isCurrentlyLoading && !(isCreatingCapsule && source.type === 'add-new')) ? 'pointer' : 'default' }}
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
        ) : (
          // Email Interface
          <div className="email-interface">
            {emailView === 'auth' ? (
              // Auth View
              <div className="email-auth-view">
                <div className="back-arrow" onClick={handleBackToStore}>← Back</div>
                <div className="auth-container">
                  <div className="auth-icon">🔑</div>
                  <h3>Connect Gmail</h3>
                  <p>Give Craig access to your Gmail so he can filter and organize your investing emails.</p>
                  <button className="auth-button" onClick={handleGmailAuth}>
                    Grant Access Permissions
                  </button>
                  {gmailConnectionId && (
                    <div className="connection-status">
                      Connection ID: {gmailConnectionId.slice(0, 8)}...
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Main Email View
              <div className="email-main-view">
                <div className="back-arrow" onClick={handleBackToStore}>← Back</div>
                <div className="email-sections">
                  {/* Auth Status */}
                  <div
                    className={`email-section auth-section ${isGmailConnected ? 'connected' : 'disconnected'}`}
                    onClick={!isGmailConnected ? () => setEmailView('auth') : undefined}
                    style={{ cursor: !isGmailConnected ? 'pointer' : 'default' }}
                  >
                    <div className="section-icon">
                      {isGmailConnected ? '✅' : '🔐'}
                    </div>
                    <div className="section-info">
                      <div className="section-name">
                        {isGmailConnected ? 'Gmail Connected' : 'Connect Gmail'}
                      </div>
                      <div className="section-description">
                        {isGmailConnected ? 'Ready to fetch emails' : 'Authorize Gmail access'}
                      </div>
                    </div>
                  </div>

                  {/* Investing Emails */}
                  <div
                    className={`email-section investing-section ${isGmailConnected ? 'active' : 'inactive'}`}
                    onClick={isGmailConnected ? () => setEmailView('investing') : undefined}
                    style={{ cursor: isGmailConnected ? 'pointer' : 'default' }}
                  >
                    <div className="section-icon">💰</div>
                    <div className="section-info">
                      <div className="section-name">Investing Emails</div>
                      <div className="section-description">
                        Process fundraising & investment communications
                      </div>
                    </div>
                    {isGmailConnected && (
                      <div className="section-badge">Default Active</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
        
        {/* Status Message */}
        {statusVisible && (
          <div className="store-status-message">
            <div className="status-content">
              {statusMessage}
            </div>
          </div>
        )}
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
          z-index: 10500;
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
          width: 70px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
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
          color: #ffffff;
          background: #000000;
        }

        /* Shrinked capsules */
        .source-card.shrinked .source-author {
          color: #0066cc;
          font-weight: bold;
        }

        /* Loading capsules */
        .source-card.loading {
          opacity: 0.4;
          pointer-events: none;
        }

        .source-card.loading .source-name {
          color: #999999;
        }

        .source-card.loading .source-author {
          color: #cccccc;
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
          
          .sharing-terminal {
            width: 90%;
            height: 120px;
            right: 5%;
            bottom: 5%;
          }
        }

        /* Status Message Styles */
        .store-status-message {
          position: absolute;
          bottom: 20px;
          right: 20px;
          max-width: 300px;
          background: #ffffff;
          border: 2px solid #000000;
          border-radius: 0;
          z-index: 10000;
          animation: statusSlideIn 0.2s ease-out;
        }

        @keyframes statusSlideIn {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .status-content {
          padding: 8px 12px;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          font-size: 11px;
          line-height: 1.3;
          color: #000000;
          white-space: nowrap;
        }

        /* Email Interface Styles */
        .email-interface {
          width: 100%;
          height: 100%;
          padding: 20px;
        }

        .back-arrow {
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          margin-bottom: 20px;
          color: #000000;
          transition: color 0.2s ease;
        }

        .back-arrow:hover {
          color: #666666;
        }

        /* Auth View */
        .email-auth-view {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .auth-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          text-align: center;
        }

        .auth-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }

        .auth-container h3 {
          font-size: 24px;
          margin-bottom: 10px;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
        }

        .auth-container p {
          font-size: 14px;
          color: #666666;
          margin-bottom: 30px;
          max-width: 400px;
        }

        .auth-button {
          background: #ffffff;
          color: #000000;
          border: 2px solid #000000;
          border-radius: 0;
          padding: 12px 24px;
          font-size: 12px;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: normal;
        }

        .auth-button:hover {
          background: #f0f0f0;
        }

        .connection-status {
          margin-top: 20px;
          font-size: 12px;
          color: #666666;
        }

        /* Main Email View */
        .email-main-view {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .email-sections {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .email-section {
          display: flex;
          align-items: center;
          padding: 20px;
          border: 2px solid #000000;
          background: #ffffff;
          transition: all 0.2s ease;
        }

        .email-section:hover {
          background: #f5f5f5;
        }

        .email-section.active {
          background: #e6f7ff;
          border-color: #0066cc;
        }

        .email-section.inactive {
          opacity: 0.6;
          pointer-events: none;
        }

        .email-section.connected {
          background: #e6ffe6;
          border-color: #00cc00;
        }

        .email-section.disconnected {
          background: #ffe6e6;
          border-color: #cc0000;
        }

        .section-icon {
          font-size: 32px;
          margin-right: 20px;
          min-width: 50px;
        }

        .section-info {
          flex: 1;
        }

        .section-name {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
        }

        .section-description {
          font-size: 14px;
          color: #666666;
        }

        .section-badge {
          background: #000000;
          color: #ffffff;
          padding: 4px 8px;
          font-size: 10px;
          border-radius: 2px;
          font-family: 'Chicago', 'Lucida Grande', sans-serif;
        }

        /* Email Inbox Active Styling */
        .source-card.email-inbox-active .source-name {
          color: #000000 !important;
          font-weight: bold;
        }

        .source-card.email-inbox-active .source-author {
          color: #666666 !important;
        }

        /* Loading Animation */
        .loading-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

      `}</style>
    </>
  );
});

export default Store;