import React, { useState, useEffect } from 'react';
import './App.css';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import DeviceService from './services/DeviceService';
import LocationService from './services/LocationService';
import AuthService from './services/AuthService';
import HeartbeatService from './services/HeartbeatService';
import WakeLockService from './services/WakeLockService';
import LoggingService from './services/LoggingService';
import NotificationService from './services/NotificationService';
import { HEARTBEAT_INTERVAL_MS } from './config/constants';
import SessionExpiryModal from './components/SessionExpiryModal';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [deviceId, setDeviceId] = useState('');
  const [location, setLocation] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [nextHeartbeatTime, setNextHeartbeatTime] = useState(null); // NEW: Track next heartbeat time
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [heartbeatResponse, setHeartbeatResponse] = useState(null);
  const [logoutMessage, setLogoutMessage] = useState(''); // Track auto-logout message
  const [runtimeTimerId, setRuntimeTimerId] = useState(null);
  const [expiryModalVisible, setExpiryModalVisible] = useState(false);
  const [expiryTimeLeft, setExpiryTimeLeft] = useState(0);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize logging
      LoggingService.init();
      LoggingService.info('WorkSens Employee Client starting...');

      // Initialize notifications (request permission)
      await NotificationService.init();
      LoggingService.info('NotificationService initialized');

      // Initialize device ID
      const deviceInfo = await DeviceService.getDeviceId();
      setDeviceId(deviceInfo.deviceId);
      LoggingService.info(`Device ID: ${deviceInfo.deviceId}`);

      // Initialize location service
      LocationService.init((newLocation) => {
        setLocation(newLocation);
        
        // Check GPS accuracy and show notification if poor
        if (isLoggedIn && newLocation && newLocation.accuracy) {
          const accuracyStatus = LocationService.getAccuracyStatus();
          if (accuracyStatus.status === 'poor' || newLocation.accuracy > 100) {
            NotificationService.showGPSAccuracyWarning(newLocation.accuracy, accuracyStatus.status);
          }
        }
      });

      // Check if user is already logged in
      // Check for saved session in localStorage (web app)
      const savedSessionStr = localStorage.getItem('userSession');
      if (savedSessionStr) {
        try {
          const savedSession = JSON.parse(savedSessionStr);
          if (savedSession && savedSession.sessionId) {
            // Verify session is still valid and get heartbeat timing
            const sessionData = await AuthService.verifySession(savedSession.sessionId);
            if (sessionData.valid) {
              setUser(sessionData.user || savedSession.user);
              setSessionId(savedSession.sessionId);
              setIsLoggedIn(true);
              
              // Calculate next heartbeat time from server data
              if (sessionData.session && sessionData.session.timeSinceLastHeartbeatMs !== undefined) {
                const remainingMs = HEARTBEAT_INTERVAL_MS - sessionData.session.timeSinceLastHeartbeatMs;
                const nextHeartbeat = new Date(Date.now() + remainingMs);
                setNextHeartbeatTime(nextHeartbeat);
                LoggingService.info(`Next heartbeat in ${Math.floor(remainingMs / 1000)}s`);
              } else {
                // Fallback if server doesn't provide timing
                const nextHeartbeat = new Date(Date.now() + HEARTBEAT_INTERVAL_MS);
                setNextHeartbeatTime(nextHeartbeat);
              }
              
              // Start heartbeat service with auto-logout callback
              HeartbeatService.start(savedSession.sessionId, deviceInfo.deviceId, (reason) => {
                handleAutoLogout(reason);
              });

                      // Start per-window runtime timer (10 hours) to force logout if window runs too long
                      try {
                        startSharedRuntimeTimer(savedSession.sessionId);
                      } catch (e) {}
              
              // Acquire wake lock for restored session
              const wakeLockAcquired = await WakeLockService.requestWakeLock();
              if (wakeLockAcquired) {
                LoggingService.info('Screen wake lock active - device will stay awake');
              }
              
              // Setup wake lock visibility listener
              WakeLockService.setupVisibilityListener();
              
              LoggingService.info('Restored previous session');
            } else {
              // Clear invalid session
              localStorage.removeItem('userSession');
              LoggingService.info('Previous session expired, cleared');
            }
          }
        } catch (error) {
          LoggingService.error('Failed to parse saved session:', error);
          localStorage.removeItem('userSession');
        }
      }

      // Setup system event listeners
      setupSystemEventListeners();

    } catch (error) {
      LoggingService.error('Failed to initialize app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupSystemEventListeners = () => {
    // CRITICAL: Global forceLogout event listener (triggered by API interceptor)
    window.addEventListener('forceLogout', (event) => {
      LoggingService.error('🚨 FORCE LOGOUT EVENT RECEIVED:', event.detail);
      
      // Show notification for logout
      NotificationService.showLogoutNotification(
        event.detail.reason,
        event.detail.source
      );
      
      // Trigger immediate auto-logout
      handleAutoLogout({
        message: event.detail.reason,
        source: event.detail.source,
        endpoint: event.detail.endpoint
      });
    });

    // Handle window/tab close (web app)
    window.addEventListener('beforeunload', (e) => {
      if (isLoggedIn && sessionId) {
        LoggingService.info('Window close triggered - auto logout');
        handleAutoLogout('Window closed');
        // Note: Modern browsers may not show custom messages
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Handle visibility change (tab hidden/shown)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        LoggingService.info('Tab hidden');
      } else {
        LoggingService.info('Tab visible');
      }
    });

    // Heartbeat events from HeartbeatService
    window.addEventListener('heartbeat:success', (e) => {
      try {
        const ts = e.detail && e.detail.timestamp ? new Date(e.detail.timestamp) : new Date();
        setLastHeartbeat(ts);
        setHeartbeatResponse(e.detail && e.detail.response ? e.detail.response : { ok: true });

        // Update next heartbeat time based on configured interval
        const next = new Date(Date.now() + HEARTBEAT_INTERVAL_MS);
        setNextHeartbeatTime(next);
        // Extra safety: if server indicates login_status:false in the response, force logout
        try {
          const resp = e.detail && e.detail.response ? e.detail.response : null;
          if (resp && resp.login_status === false) {
            LoggingService.error('heartbeat:success contained login_status:false - forcing logout');
            handleAutoLogout(resp);
          }
        } catch (ex) {}
      } catch (err) {
        // ignore
      }
    });

    window.addEventListener('heartbeat:failure', (e) => {
      try {
        setHeartbeatResponse({ ok: false, detail: e.detail });
        // mark nextHeartbeatTime as null to show immediate attention
        setNextHeartbeatTime(null);
        // Force an immediate auto-logout based on the failure detail
        try {
          LoggingService.error('heartbeat:failure received - forcing auto-logout', e.detail);
          // Pass the server response or detail object if available
          const payload = e.detail && (e.detail.response || e.detail) ? (e.detail.response || e.detail) : 'Heartbeat failure';
          handleAutoLogout(payload);
        } catch (ex) {
          // still ensure session cleared
          try { handleAutoLogout('Heartbeat failure'); } catch(e){}
        }
      } catch (err) {}
    });

    // Handle online/offline events
    window.addEventListener('offline', () => {
      LoggingService.info('Network disconnected');
      NotificationService.showOfflineNotification();
    });

    window.addEventListener('online', () => {
      LoggingService.info('Network reconnected');
      NotificationService.showOnlineNotification();
    });
  };

  const handleAutoLogout = async (reason) => {
    // reason may be a string or an object (server payload)
    let message = '';
    let source = 'system';
    
    try {
      if (typeof reason === 'string') {
        message = reason;
      } else if (reason && typeof reason === 'object') {
        // Extract source for notification categorization
        source = reason.source || 'system';
        
        // If server sent a structured response (e.g., { login_status: false, message: '', error: '' })
        if (reason.login_status === false) {
          message = reason.message || reason.error || 'Session invalidated by server';
        } else {
          message = reason.message || reason.error || JSON.stringify(reason);
        }
      } else {
        message = 'Session ended. Please login again.';
      }

      // Show notification FIRST (before clearing session)
      NotificationService.showLogoutNotification(message, source);

      // If not logged in client-side, still clear session state and show message
      try {
        // Best-effort call to logout API to invalidate server-side session
        if (sessionId) {
          await AuthService.logout(sessionId, deviceId, location);
          LoggingService.info(`Auto logout API call completed: ${message}`);
        }
      } catch (err) {
        LoggingService.warn('Auto logout API call failed (continuing):', err);
      }

    } catch (e) {
      LoggingService.error('Error processing auto-logout reason:', e);
      message = 'Session ended. Please login again.';
      NotificationService.showLogoutNotification(message, 'error');
    } finally {
      // Always clear local session and inform UI
      setLogoutMessage(message);
      await clearSession();
    }
  };

  const handleLogin = async (loginData) => {
    try {
      // DON'T set App-level isLoading - let LoginScreen handle its own loading state
      // setIsLoading(true); // REMOVED - this causes full-page navigation
      
      // Fetch fresh location for login
      let freshLocation = location;
      try {
        LoggingService.info('Fetching fresh location for login...');
        freshLocation = await LocationService.forceUpdate();
      } catch (error) {
        LoggingService.warn('Failed to get fresh location, using cached', error);
      }
      
      const response = await AuthService.login({
        ...loginData,
        deviceId,
        location: freshLocation
      });

      if (response.ok) {
        setUser(response.user);
        setSessionId(response.sessionId);
        setIsLoggedIn(true);

  // Set initial heartbeat time from configured interval
  const nextHeartbeat = new Date(Date.now() + HEARTBEAT_INTERVAL_MS);
  setNextHeartbeatTime(nextHeartbeat);
        LoggingService.info('Next heartbeat set for login');

        // Save session to localStorage (web app)
        try {
          localStorage.setItem('userSession', JSON.stringify({
            sessionId: response.sessionId,
            user: response.user,
            loginTime: new Date().toISOString()
          }));
        } catch (error) {
          LoggingService.error('Failed to save session to localStorage:', error);
        }

        // Start heartbeat service with auto-logout callback
        HeartbeatService.start(response.sessionId, deviceId, (reason) => {
          handleAutoLogout(reason);
        });
        
        // Acquire wake lock to prevent screen from turning off
        const wakeLockAcquired = await WakeLockService.requestWakeLock();
        if (wakeLockAcquired) {
          LoggingService.info('Screen wake lock active - device will stay awake');
        }
        
        // Setup wake lock visibility listener
        WakeLockService.setupVisibilityListener();
        
        // Clear any previous logout message on successful login
        setLogoutMessage('');

        // Start per-window runtime timer (10 hours) to force logout if window runs too long
        try {
          startSharedRuntimeTimer(response.sessionId);
        } catch (e) {}
        
        LoggingService.info(`Login successful for user: ${response.user.username}`);
        return { ok: true };
      } else {
        LoggingService.warn(`Login failed: ${response.error}`);
        return { ok: false, error: response.error };
      }
    } catch (error) {
      LoggingService.error('Login error:', error);
      return { ok: false, error: 'Network error. Please check your connection.' };
    }
    // No finally block needed - LoginScreen manages its own loading state
  };

  // Keep nextHeartbeatTime updated by polling HeartbeatService.getTimeUntilNext()
  useEffect(() => {
    let pollId;
    if (isLoggedIn) {
      const update = () => {
        try {
          const ms = HeartbeatService.getTimeUntilNext();
          if (ms !== undefined && ms !== null) {
            setNextHeartbeatTime(new Date(Date.now() + ms));
          }
        } catch (err) {
          // ignore
        }
      };

      update();
      pollId = setInterval(update, 1000);
    }

    return () => {
      if (pollId) clearInterval(pollId);
    };
  }, [isLoggedIn]);

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      
      const result = await AuthService.logout(sessionId, deviceId, location);
      if (result.alreadyInvalidated) {
        LoggingService.info('Manual logout: Session was already invalidated on server');
      } else if (result.ok) {
        LoggingService.info('Manual logout successful');
      } else {
        LoggingService.warn('Manual logout: Server request failed, cleared locally');
      }
      
    } catch (error) {
      // Shouldn't reach here since AuthService.logout catches errors
      LoggingService.warn('Unexpected logout error (cleared locally):', error);
    } finally {
      await clearSession();
      setIsLoading(false);
    }
  };

  const handleRefreshLocation = async () => {
    try {
      LoggingService.info('🔄 Manual GPS refresh requested');
      const newLocation = await LocationService.forceUpdate();
      setLocation(newLocation);
      LoggingService.info('✅ GPS location refreshed successfully');
      return { ok: true, location: newLocation };
    } catch (error) {
      LoggingService.error('❌ Failed to refresh GPS location:', error);
      return { ok: false, error: error.message };
    }
  };

  const clearSession = async () => {
    // Stop heartbeat service
    HeartbeatService.stop();
    
    // Release wake lock
    await WakeLockService.releaseWakeLock();
    LoggingService.info('Wake lock released on logout');
    
    // Clear stored session from localStorage (web app)
    try {
      localStorage.removeItem('userSession');
    } catch (error) {
      console.error('Failed to clear session from localStorage:', error);
    }

    // Clear runtime timer if set
    try {
      if (runtimeTimerId) {
        clearTimeout(runtimeTimerId);
        setRuntimeTimerId(null);
      }
    } catch (e) {}
    

  // --- Shared runtime timer across tabs using BroadcastChannel + localStorage ---
  const SHARED_TIMER_KEY = 'worksens:session:startTs';
  const SHARED_TIMER_TTL = 10 * 60 * 60 * 1000; // 10 hours
  const SHARED_WARNING_BEFORE_MS = 5 * 60 * 1000; // 5 minutes warning

  const bc = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('worksens_session') : null;

  const startSharedRuntimeTimer = (sessionId) => {
    try {
      const startTs = Date.now();
      localStorage.setItem(SHARED_TIMER_KEY, String(startTs));
      // notify other tabs
      if (bc) bc.postMessage({ type: 'session_start', startTs, sessionId });
      scheduleLocalWarnings(startTs);
    } catch (e) {
      LoggingService.warn('Failed to start shared runtime timer', e);
    }
  };

  const clearSharedRuntimeTimer = () => {
    try {
      localStorage.removeItem(SHARED_TIMER_KEY);
      if (bc) bc.postMessage({ type: 'session_clear' });
      setExpiryModalVisible(false);
      setExpiryTimeLeft(0);
    } catch (e) {}
  };

  const scheduleLocalWarnings = (startTs) => {
    try {
      // compute warning time and expiry
      const expiryTs = startTs + SHARED_TIMER_TTL;
      const warningTs = Math.max(startTs, expiryTs - SHARED_WARNING_BEFORE_MS);
      const now = Date.now();

      // clear existing
      if (runtimeTimerId) clearTimeout(runtimeTimerId);

      // time until warning
      const untilWarning = Math.max(0, warningTs - now);
      const warningId = setTimeout(() => {
        // show modal and countdown
        setExpiryModalVisible(true);
        startExpiryCountdown(expiryTs);
      }, untilWarning);

      setRuntimeTimerId(warningId);
    } catch (e) {
      LoggingService.warn('Failed to schedule local warnings', e);
    }
  };

  const startExpiryCountdown = (expiryTs) => {
    try {
      const tick = () => {
        const left = Math.max(0, Math.floor((expiryTs - Date.now()) / 1000));
        setExpiryTimeLeft(left);
        if (left <= 0) {
          // final logout
          NotificationService.showLogoutNotification('Session duration exceeded 10 hours. You will be logged out.', 'system');
          handleAutoLogout('Session duration exceeded 10 hours');
        }
      };

      tick();
      const interval = setInterval(tick, 1000);

      // store interval id in runtimeTimerId so clearSession removes it
      setRuntimeTimerId(interval);
    } catch (e) {}
  };

  // Listen for storage or broadcast events from other tabs
  useEffect(() => {
    const onStorage = (ev) => {
      if (ev.key === SHARED_TIMER_KEY) {
        const startTs = Number(ev.newValue || 0);
        if (startTs) {
          scheduleLocalWarnings(startTs);
        } else {
          // cleared
          if (runtimeTimerId) {
            clearTimeout(runtimeTimerId);
            setRuntimeTimerId(null);
          }
          setExpiryModalVisible(false);
        }
      }
    };

    const onBC = (msg) => {
      if (!msg || !msg.data) return;
      const d = msg.data;
      if (d.type === 'session_start') scheduleLocalWarnings(d.startTs);
      if (d.type === 'session_clear') {
        if (runtimeTimerId) clearTimeout(runtimeTimerId);
        setRuntimeTimerId(null);
        setExpiryModalVisible(false);
      }
    };

    window.addEventListener('storage', onStorage);
    if (bc) bc.addEventListener('message', onBC);

    return () => {
      window.removeEventListener('storage', onStorage);
      if (bc) bc.removeEventListener('message', onBC);
    };
  }, [runtimeTimerId]);

  const handleExtendSession = async () => {
    try {
      // attempt to extend using AuthService
      const res = await AuthService.extendSession(sessionId);
      if (res && res.ok) {
        // reset shared timer
        startSharedRuntimeTimer(sessionId);
        setExpiryModalVisible(false);
        NotificationService.showOnlineNotification();
        return true;
      } else {
        NotificationService.showLogoutNotification('Unable to extend session. You will be logged out.', 'system');
        handleAutoLogout('Unable to extend session');
        return false;
      }
    } catch (e) {
      NotificationService.showLogoutNotification('Unable to extend session. You will be logged out.', 'system');
      handleAutoLogout('Unable to extend session');
      return false;
    }
  };
    // Clear state
    setUser(null);
    setSessionId('');
    setIsLoggedIn(false);
    setNextHeartbeatTime(null);
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <h2>WorkSens Employee Client</h2>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="App">
        {!isLoggedIn ? (
          <LoginScreen
            deviceId={deviceId}
            onLogin={handleLogin}
            logoutMessage={logoutMessage}
            location={location}
            onRefreshLocation={handleRefreshLocation}
          />
        ) : (
          <Dashboard
            user={user}
            deviceId={deviceId}
            location={location}
            sessionId={sessionId}
            nextHeartbeatTime={nextHeartbeatTime}
            lastHeartbeat={lastHeartbeat}
            heartbeatResponse={heartbeatResponse}
            onLogout={handleLogout}
          />
        )}
        <SessionExpiryModal visible={expiryModalVisible} timeLeftSec={expiryTimeLeft} onExtend={handleExtendSession} onDismiss={() => setExpiryModalVisible(false)} />
      </div>
    </ErrorBoundary>
  );
}

export default App;