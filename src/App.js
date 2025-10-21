import React, { useState, useEffect, Suspense } from 'react';
import './App.css';
import LoginScreen from './components/LoginScreen';
const Dashboard = React.lazy(() => import('./components/Dashboard'));
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
  const [nextHeartbeatTime, setNextHeartbeatTime] = useState(null);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [heartbeatResponse, setHeartbeatResponse] = useState(null);
  const [logoutMessage, setLogoutMessage] = useState('');

  // Shared runtime timer state
  const [runtimeTimerId, setRuntimeTimerId] = useState(null);
  const [expiryModalVisible, setExpiryModalVisible] = useState(false);
  const [expiryTimeLeft, setExpiryTimeLeft] = useState(0);

  // Constants for shared timer
  const SHARED_TIMER_KEY = 'worksens:session:startTs';
  const SHARED_TIMER_TTL = 10 * 60 * 60 * 1000; // 10 hours
  const SHARED_WARNING_BEFORE_MS = 5 * 60 * 1000; // 5 minutes warning
  const bc = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('worksens_session') : null;

  // Utility: start the shared runtime timer (broadcasts to other tabs)
  const startSharedRuntimeTimer = (sid) => {
    try {
      const startTs = Date.now();
      localStorage.setItem(SHARED_TIMER_KEY, String(startTs));
      if (bc) bc.postMessage({ type: 'session_start', startTs, sessionId: sid });
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
      if (runtimeTimerId) {
        try { clearTimeout(runtimeTimerId); } catch(e) {}
        setRuntimeTimerId(null);
      }
    } catch (e) {
      // ignore
    }
  };

  const scheduleLocalWarnings = (startTs) => {
    try {
      const expiryTs = startTs + SHARED_TIMER_TTL;
      const warningTs = Math.max(startTs, expiryTs - SHARED_WARNING_BEFORE_MS);
      const now = Date.now();

      // clear existing timer
      if (runtimeTimerId) {
        try { clearTimeout(runtimeTimerId); } catch(e) {}
        setRuntimeTimerId(null);
      }

      const untilWarning = Math.max(0, warningTs - now);
      const warningId = setTimeout(() => {
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
          NotificationService.showLogoutNotification('Session duration exceeded 10 hours. You will be logged out.', 'system');
          handleAutoLogout('Session duration exceeded 10 hours');
        }
      };

      tick();
      const interval = setInterval(tick, 1000);
      // hang the interval id on runtimeTimerId so clearSharedRuntimeTimer removes it
      setRuntimeTimerId(interval);
    } catch (e) {
      // ignore
    }
  };

  // Listen for storage/broadcast events
  useEffect(() => {
    const onStorage = (ev) => {
      if (ev.key === SHARED_TIMER_KEY) {
        const startTs = Number(ev.newValue || 0);
        if (startTs) scheduleLocalWarnings(startTs);
        else {
          if (runtimeTimerId) {
            try { clearTimeout(runtimeTimerId); } catch(e) {}
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
        if (runtimeTimerId) try { clearTimeout(runtimeTimerId); } catch(e) {}
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

  // Ensure handleExtendSession is always defined before modal renders
  const handleExtendSession = async () => {
    try {
      const res = await AuthService.extendSession(sessionId);
      if (res && res.ok) {
        startSharedRuntimeTimer(sessionId);
        setExpiryModalVisible(false);
        NotificationService.showOnlineNotification();
        return true;
      }
    } catch (e) {
      // ignore
    }
    NotificationService.showLogoutNotification('Unable to extend session. You will be logged out.', 'system');
    handleAutoLogout('Unable to extend session');
    return false;
  };

  // Initialize app (non-blocking) and wire heartbeat events
  useEffect(() => {
    const init = async () => {
      try {
        // minimal device init
        const id = await DeviceService.getDeviceId();
        setDeviceId(id);

        // async restore session if present
        try {
          const raw = localStorage.getItem('userSession');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.sessionId) {
              setSessionId(parsed.sessionId);
              setUser(parsed.user || null);
              setIsLoggedIn(true);
              // Start heartbeat listening
              HeartbeatService.start(parsed.sessionId, id, (reason) => handleAutoLogout(reason));
              startSharedRuntimeTimer(parsed.sessionId);
            }
          }
        } catch (e) {
          // ignore
        }

        // setup heartbeat event listeners
        window.addEventListener('heartbeat:success', (e) => {
          setLastHeartbeat(new Date());
          setHeartbeatResponse(e.detail || null);
        });

        window.addEventListener('heartbeat:failure', (e) => {
          const payload = e.detail && (e.detail.response || e.detail) ? (e.detail.response || e.detail) : 'Heartbeat failure';
          handleAutoLogout(payload);
        });

        // network handlers
        window.addEventListener('offline', () => {
          LoggingService.info('Network disconnected');
          NotificationService.showOfflineNotification();
        });

        window.addEventListener('online', () => {
          LoggingService.info('Network reconnected');
          NotificationService.showOnlineNotification();
        });

      } catch (e) {
        LoggingService.warn('Init failed', e);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    return () => {
      // cleanup global listeners when App unmounts
      try { window.removeEventListener('heartbeat:success', () => {}); } catch(e) {}
      try { window.removeEventListener('heartbeat:failure', () => {}); } catch(e) {}
      try { window.removeEventListener('offline', () => {}); } catch(e) {}
      try { window.removeEventListener('online', () => {}); } catch(e) {}
    };
  }, []);

  const handleAutoLogout = async (reason) => {
    let message = '';
    let source = 'system';

    try {
      if (typeof reason === 'string') {
        message = reason;
      } else if (reason && typeof reason === 'object') {
        source = reason.source || 'system';
        if (reason.login_status === false) {
          message = reason.message || reason.error || 'Session invalidated by server';
        } else {
          message = reason.message || reason.error || JSON.stringify(reason);
        }
      } else {
        message = 'Session ended. Please login again.';
      }

      NotificationService.showLogoutNotification(message, source);

      try {
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
      setLogoutMessage(message);
      await clearSession();
    }
  };

  const handleLogin = async (loginData) => {
    try {
      let freshLocation = location;
      try { freshLocation = await LocationService.forceUpdate(); } catch (e) { LoggingService.warn('Failed to get fresh location', e); }

      const response = await AuthService.login({ ...loginData, deviceId, location: freshLocation });
      if (response.ok) {
        setUser(response.user);
        setSessionId(response.sessionId);
        setIsLoggedIn(true);

        const nextHeartbeat = new Date(Date.now() + HEARTBEAT_INTERVAL_MS);
        setNextHeartbeatTime(nextHeartbeat);

        try {
          localStorage.setItem('userSession', JSON.stringify({ sessionId: response.sessionId, user: response.user, loginTime: new Date().toISOString() }));
        } catch (e) { LoggingService.warn('Failed to save session to localStorage', e); }

        HeartbeatService.start(response.sessionId, deviceId, (reason) => { handleAutoLogout(reason); });

        const wakeLockAcquired = await WakeLockService.requestWakeLock();
        if (wakeLockAcquired) LoggingService.info('Screen wake lock active - device will stay awake');
        WakeLockService.setupVisibilityListener();

        setLogoutMessage('');
        try { startSharedRuntimeTimer(response.sessionId); } catch (e) {}

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
  };

  useEffect(() => {
    let pollId;
    if (isLoggedIn) {
      const update = () => {
        try {
          const ms = HeartbeatService.getTimeUntilNext();
          if (ms !== undefined && ms !== null) setNextHeartbeatTime(new Date(Date.now() + ms));
        } catch (err) {}
      };
      update();
      pollId = setInterval(update, 1000);
    }
    return () => { if (pollId) clearInterval(pollId); };
  }, [isLoggedIn]);

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      const result = await AuthService.logout(sessionId, deviceId, location);
      if (result.alreadyInvalidated) LoggingService.info('Manual logout: Session was already invalidated on server');
      else if (result.ok) LoggingService.info('Manual logout successful');
      else LoggingService.warn('Manual logout: Server request failed, cleared locally');
    } catch (error) {
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
    HeartbeatService.stop();
    await WakeLockService.releaseWakeLock();
    LoggingService.info('Wake lock released on logout');
    try { localStorage.removeItem('userSession'); } catch (e) {}

    try { if (runtimeTimerId) { clearTimeout(runtimeTimerId); setRuntimeTimerId(null); } } catch (e) {}
    try { clearSharedRuntimeTimer(); } catch (e) {}

    setUser(null); setSessionId(''); setIsLoggedIn(false); setNextHeartbeatTime(null);
  };

  return (
    <div className="App">
      <ErrorBoundary>
        <Suspense fallback={<div>Loading...</div>}>
          {!isLoggedIn ? (
            <LoginScreen onLogin={handleLogin} isLoading={isLoading} />
          ) : (
            <Dashboard
              user={user}
              onLogout={handleLogout}
              onRefreshLocation={handleRefreshLocation}
              nextHeartbeatTime={nextHeartbeatTime}
              lastHeartbeat={lastHeartbeat}
            />
          )}

          <SessionExpiryModal
            visible={expiryModalVisible}
            secondsLeft={expiryTimeLeft}
            onExtend={typeof handleExtendSession === 'function' ? handleExtendSession : undefined}
            onDismiss={() => setExpiryModalVisible(false)}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

export default App;
    