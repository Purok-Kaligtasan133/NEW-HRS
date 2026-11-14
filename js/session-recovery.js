// ============ SESSION RECOVERY - DETECT BROWSER CLOSURE (FIXED) ============
(function() {
    // Skip on login page
    const isLoginPage = window.location.pathname.includes('index.html') || 
                        window.location.pathname === '/' || 
                        window.location.pathname.endsWith('/');
    
    if (isLoginPage) {
        console.log('📄 Session recovery: On login page, skipping');
        return;
    }
    
    // Check if this is a fresh page load (not a navigation)
    const isFreshLoad = performance.getEntriesByType('navigation')[0]?.type === 'navigate';
    const hadSessionBefore = sessionStorage.getItem('had_session') === 'true';
    const currentSessionId = localStorage.getItem('sessionId');
    
    console.log('🔍 Session recovery check:', {
        isFreshLoad,
        hadSessionBefore,
        hasSession: !!currentSessionId,
        navigationType: performance.getEntriesByType('navigation')[0]?.type
    });
    
    // Store that we have a session (for next page load detection)
    if (currentSessionId) {
        sessionStorage.setItem('had_session', 'true');
    }
    
    // Set flag when page is intentionally unloaded (navigation, refresh, or page change)
    const setNavigationFlag = function() {
        const timestamp = Date.now().toString();
        sessionStorage.setItem('page_navigation', timestamp);
        sessionStorage.setItem('last_known_session', localStorage.getItem('sessionId') || '');
        console.log('🚪 Navigation flag set at:', new Date(timestamp).toLocaleTimeString());
    };
    
    // Use multiple events to catch all scenarios
    window.addEventListener('beforeunload', setNavigationFlag);
    
    // For mobile: visibilitychange works better
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            setNavigationFlag();
        }
    });
    
    // For page hide (mobile)
    window.addEventListener('pagehide', setNavigationFlag);
    
    // Check for browser closure on page load
    function checkSessionRecovery() {
        const navigationTime = sessionStorage.getItem('page_navigation');
        const lastKnownSession = sessionStorage.getItem('last_known_session');
        const currentSession = localStorage.getItem('sessionId');
        const isLoggedIn = localStorage.getItem('loggedIn') === 'true';
        const isGuest = localStorage.getItem('isGuest') === 'true';
        
        // Skip for guest users
        if (isGuest) {
            console.log('👤 Guest user - skipping session recovery');
            return;
        }
        
        let isRecentNavigation = false;
        let navigationAge = null;
        
        if (navigationTime) {
            navigationAge = Date.now() - parseInt(navigationTime);
            isRecentNavigation = navigationAge < 3000; // 3 seconds threshold (reduced from 5)
            console.log(`📊 Navigation flag age: ${navigationAge}ms, recent: ${isRecentNavigation}`);
        }
        
        // DETECT BROWSER CLOSURE:
        // Condition 1: We had a session before (lastKnownSession exists)
        // Condition 2: We still have a session now
        // Condition 3: No recent navigation flag (browser was closed)
        // Condition 4: This is a fresh page load (not a refresh)
        const isBrowserClosure = hadSessionBefore && 
                                 currentSession && 
                                 !isRecentNavigation && 
                                 navigationTime === null &&
                                 isFreshLoad;
        
        // Also detect if session ID changed (possible from another device)
        const sessionChanged = lastKnownSession && currentSession && lastKnownSession !== currentSession;
        
        if (isBrowserClosure) {
            console.log('🔄 BROWSER CLOSURE DETECTED! Cleaning up old session...');
            showRecoveryMessage('Previous browser session detected. Cleaning up...');
            cleanupSession();
            return;
        }
        
        if (sessionChanged) {
            console.log('🔄 SESSION CHANGED DETECTED! Old session:', lastKnownSession, 'New:', currentSession);
            // This is normal after force logout, don't cleanup
            sessionStorage.removeItem('had_session');
            sessionStorage.removeItem('last_known_session');
        }
        
        // Clean up old navigation flags (older than 3 seconds)
        if (navigationTime && navigationAge > 3000) {
            sessionStorage.removeItem('page_navigation');
            sessionStorage.removeItem('last_known_session');
        }
        
        // Update stored session for next check
        if (currentSession) {
            sessionStorage.setItem('had_session', 'true');
            sessionStorage.setItem('last_known_session', currentSession);
        } else {
            sessionStorage.removeItem('had_session');
            sessionStorage.removeItem('last_known_session');
        }
        
        console.log('✅ Session recovery: No cleanup needed');
    }
    
    function showRecoveryMessage(message) {
        const msgDiv = document.createElement('div');
        msgDiv.innerHTML = `
            <div style="position: fixed; bottom: 20px; left: 20px; right: 20px; background: #ff7a00; color: white; padding: 12px; border-radius: 8px; text-align: center; z-index: 10000; font-size: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                <i class="fas fa-sync-alt"></i> ${message}
            </div>
        `;
        document.body.appendChild(msgDiv);
        setTimeout(() => msgDiv.remove(), 2000);
    }
    
    function cleanupSession() {
        const oldSessionId = localStorage.getItem('sessionId');
        
        // Clear localStorage session data
        localStorage.removeItem('sessionId');
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('staffName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('assignedBarangay');
        localStorage.removeItem('loginTime');
        
        // Clear cookie
        document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        
        // Clear session storage flags
        sessionStorage.removeItem('had_session');
        sessionStorage.removeItem('page_navigation');
        sessionStorage.removeItem('last_known_session');
        
        // Try to deactivate old session in database
        if (oldSessionId && window.supabaseClient) {
            window.supabaseClient
                .from('user_sessions')
                .update({ 
                    is_active: false, 
                    terminated_at: new Date().toISOString(), 
                    terminated_reason: 'browser_closed'
                })
                .eq('session_id', oldSessionId)
                .then(() => console.log('✅ Old session deactivated'))
                .catch(err => console.error('Failed to deactivate session:', err));
        }
        
        // Redirect to login
        setTimeout(() => {
            window.location.href = 'index.html?recovery=cleaned';
        }, 1500);
    }
    
    // Run check after page loads
    setTimeout(checkSessionRecovery, 300);
    
    // Also run on pageshow (for back/forward cache)
    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            console.log('Page restored from cache (bfcache)');
            setTimeout(checkSessionRecovery, 300);
        }
    });
})();