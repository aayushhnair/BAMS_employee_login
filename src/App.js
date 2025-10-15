import React, { useState, useEffect } from 'react';
import './App.css';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import DeviceService from './services/DeviceService';
import LocationService from './services/LocationService';
import AuthService from './services/AuthService';
import HeartbeatService from './services/HeartbeatService';
import LoggingService from './services/LoggingService';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [deviceId, setDeviceId] = useState('');
  const [location, setLocation] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize logging
      LoggingService.init();
      LoggingService.info('BAMS Employee Client starting...');

      // Initialize device ID
      const deviceInfo = await DeviceService.getDeviceId();
      setDeviceId(deviceInfo.deviceId);
      LoggingService.info(`Device ID: ${deviceInfo.deviceId}`);

      // Initialize location service
      LocationService.init((newLocation) => {
        setLocation(newLocation);
      });

      // Check if user is already logged in
      // Check for saved session in localStorage (web app)
      const savedSessionStr = localStorage.getItem('userSession');
      if (savedSessionStr) {
        try {
          const savedSession = JSON.parse(savedSessionStr);
          if (savedSession && savedSession.sessionId) {
            // Verify session is still valid
            const isValid = await AuthService.verifySession(savedSession.sessionId);
            if (isValid) {
              setUser(savedSession.user);
              setSessionId(savedSession.sessionId);
              setIsLoggedIn(true);
              
              // Start heartbeat service
              HeartbeatService.start(savedSession.sessionId, deviceInfo.deviceId);
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

    // Handle online/offline events
    window.addEventListener('offline', () => {
      LoggingService.info('Network disconnected');
    });

    window.addEventListener('online', () => {
      LoggingService.info('Network reconnected');
    });
  };

  const handleAutoLogout = async (reason) => {
    if (isLoggedIn && sessionId) {
      try {
        await AuthService.logout(sessionId, deviceId, location);
        LoggingService.info(`Auto logout successful: ${reason}`);
      } catch (error) {
        LoggingService.error(`Auto logout failed: ${reason}`, error);
      } finally {
        // Clear local state regardless of API call success
        await clearSession();
      }
    }
  };

  const handleLogin = async (loginData) => {
    try {
      setIsLoading(true);
      
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

        // Start heartbeat service
        HeartbeatService.start(response.sessionId, deviceId);
        
        LoggingService.info(`Login successful for user: ${response.user.username}`);
        return { success: true };
      } else {
        LoggingService.warn(`Login failed: ${response.error}`);
        return { success: false, error: response.error };
      }
    } catch (error) {
      LoggingService.error('Login error:', error);
      return { success: false, error: 'Network error. Please check your connection.' };
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      
      await AuthService.logout(sessionId, deviceId, location);
      LoggingService.info('Manual logout successful');
      
    } catch (error) {
      LoggingService.error('Logout error:', error);
    } finally {
      await clearSession();
      setIsLoading(false);
    }
  };

  const clearSession = async () => {
    // Stop heartbeat service
    HeartbeatService.stop();
    
    // Clear stored session from localStorage (web app)
    try {
      localStorage.removeItem('userSession');
    } catch (error) {
      console.error('Failed to clear session from localStorage:', error);
    }
    
    // Clear state
    setUser(null);
    setSessionId('');
    setIsLoggedIn(false);
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <h2>BAMS Employee Client</h2>
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
          />
        ) : (
          <Dashboard
            user={user}
            deviceId={deviceId}
            location={location}
            sessionId={sessionId}
            onLogout={handleLogout}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;