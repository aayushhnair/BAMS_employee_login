import AuthService from './AuthService';
import LocationService from './LocationService';
import { HEARTBEAT_INTERVAL_MS } from '../config/constants';
import LoggingService from './LoggingService';
import NotificationService from './NotificationService';

/**
 * Heartbeat Service - Sends periodic location updates to maintain session
 */
class HeartbeatService {
  constructor() {
    this.intervalId = null;
    this.sessionId = null;
    this.deviceId = null;
    this.isActive = false;
    this.interval = HEARTBEAT_INTERVAL_MS; // From environment configuration
    this.failureCount = 0;
    this.maxFailures = 3;
    this.onFailureCallback = null;
    this.lastHeartbeat = null;
    this.isOnline = navigator.onLine;
    this.queuedHeartbeats = [];
    this._timeoutId = null; // for scheduled heartbeat
    this.isSending = false;
    this.nextScheduledAt = null;
  }

  /**
   * Start heartbeat service
   */
  start(sessionId, deviceId, onFailure) {
    if (this.isActive) {
    LoggingService.warn('Heartbeat service already active');
      return;
    }

    this.sessionId = sessionId;
    this.deviceId = deviceId;
    this.onFailureCallback = onFailure;
    this.isActive = true;
    this.failureCount = 0;

    LoggingService.info('Starting heartbeat service...');

    // Restore lastHeartbeat from storage if present
    try {
      const last = localStorage.getItem('heartbeat:last');
      if (last) {
        this.lastHeartbeat = new Date(last);
      }
    } catch (e) {
      LoggingService.warn('Could not read persisted heartbeat timestamp', e);
    }

    // Send initial heartbeat and schedule subsequent ones using timer-based scheduling
    this.sendHeartbeat();

    // Setup network and visibility monitoring
    this.setupNetworkMonitoring();
    this.setupVisibilityMonitoring();
    LoggingService.info(`Heartbeat service started with ${this.interval / 60000} minute interval`);
  }

  /**
   * Stop heartbeat service
   */
  stop() {
    if (!this.isActive) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isActive = false;
    this.sessionId = null;
    this.deviceId = null;
    this.onFailureCallback = null;
    this.failureCount = 0;
    this.queuedHeartbeats = [];
    // Clear scheduled timer
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
      this.nextScheduledAt = null;
    }

    // Remove network and visibility event listeners
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Send heartbeat to server
   */
  async sendHeartbeat() {
    if (!this.isActive || !this.sessionId || !this.deviceId) {
      LoggingService.warn('Heartbeat service not properly initialized');
      return;
    }

    try {
      // Prevent concurrent sends
      if (this.isSending) {
        LoggingService.info('Heartbeat send already in progress - skipping duplicate call');
        return;
      }

      this.isSending = true;
  // Fetch fresh location for this heartbeat
  LoggingService.debug('Fetching fresh location for heartbeat...');
      let location;
      try {
        location = await LocationService.forceUpdate();
      } catch (error) {
  LoggingService.warn('Failed to get fresh location, using cached:', error);
        location = LocationService.getCurrentLocation();
      }
      
      if (!location) {
        LoggingService.warn('No location available for heartbeat');
        this.handleHeartbeatFailure('No location data');
        return;
      }

      // Check if we're online
      if (!this.isOnline) {
        LoggingService.info('Offline - queueing heartbeat');
        this.queueHeartbeat(location);
        return;
      }

      LoggingService.info('📡 Sending heartbeat with fresh location...');
      const response = await AuthService.sendHeartbeat(this.sessionId, this.deviceId, location);

  // Log full response for debugging
  LoggingService.info('Heartbeat API Response:', { ok: response.ok, statusCode: response.statusCode, message: response.message, error: response.error, login_status: response.login_status });

      // CRITICAL: Check login_status FIRST (before response.ok)
      // If login_status is explicitly false, user MUST be logged out immediately
      if (response && response.login_status === false) {
        LoggingService.error('🚨 CRITICAL: Server returned login_status:false - FORCING IMMEDIATE LOGOUT');
        
        // Stop service IMMEDIATELY
        this.stop();
        
        // Trigger IMMEDIATE logout via callback
        if (this.onFailureCallback) {
          this.onFailureCallback(response.message || response.error || 'Session invalidated by server');
        } else {
          LoggingService.error('🚨 CRITICAL ERROR: No failure callback! Cannot logout user!');
        }
        this.isSending = false;
        // Emit event for UI
        try { window.dispatchEvent(new CustomEvent('heartbeat:failure', { detail: { reason: 'login_status_false', response } })); } catch (e) {}
        return;
      }

      // CRITICAL: Check response.ok (any failure = immediate logout)
      if (response.ok === true) {
        this.handleHeartbeatSuccess(response);
      } else {
        // CRITICAL: Any non-ok response MUST trigger IMMEDIATE logout - NO EXCEPTIONS
        LoggingService.error('❌ CRITICAL: Heartbeat failed - response.ok is NOT true:', response);

        // Stop the service IMMEDIATELY
        this.stop();

        // Trigger IMMEDIATE logout via callback
        if (this.onFailureCallback) {
          const message = response.statusCode === 401 || response.message === 'Session expired'
            ? 'Session expired. Please login again.'
            : response.error || response.message || 'Server connection lost. Please login again.';

          LoggingService.error('🚨 Triggering IMMEDIATE auto-logout due to heartbeat failure');
          this.onFailureCallback(message);
        } else {
          LoggingService.error('🚨 CRITICAL ERROR: No failure callback registered! Cannot logout user!');
        }

        this.isSending = false;
        try { window.dispatchEvent(new CustomEvent('heartbeat:failure', { detail: { reason: 'response_not_ok', response } })); } catch (e) {}
        return;
      }
    } catch (error) {
      LoggingService.error('Heartbeat error:', error);
      this.handleHeartbeatFailure(error.message);
    } finally {
      this.isSending = false;
      // Schedule next heartbeat if service still active
      if (this.isActive) {
        this.scheduleNextHeartbeat();
      }
    }
  }

  /**
   * Handle successful heartbeat
   */
  handleHeartbeatSuccess(response) {
    this.failureCount = 0;
    this.lastHeartbeat = new Date();
    LoggingService.info('Heartbeat successful at', this.lastHeartbeat.toLocaleTimeString());

    // Persist last heartbeat time so UI can restore state after resume/reload
    try {
      localStorage.setItem('heartbeat:last', this.lastHeartbeat.toISOString());
    } catch (e) {
      LoggingService.warn('Could not persist last heartbeat', e);
    }

    // Emit success event for UI consumers
    try {
      window.dispatchEvent(new CustomEvent('heartbeat:success', { detail: { response, timestamp: this.lastHeartbeat } }));
    } catch (e) {}

    // Process any queued heartbeats when back online
    if (this.queuedHeartbeats.length > 0) {
      this.processQueuedHeartbeats();
    }
  }

  /**
   * Handle heartbeat failure - IMMEDIATE LOGOUT
   */
  handleHeartbeatFailure(reason) {
    LoggingService.error(`🚨 HEARTBEAT FAILURE - FORCING IMMEDIATE LOGOUT:`, reason);

    // CRITICAL: Stop service IMMEDIATELY
    this.stop();
    
    // Show notification for heartbeat failure
    const message = reason || 'Server connection lost. Please login again.';
    NotificationService.showHeartbeatFailureNotification(message);
    
    // CRITICAL: Trigger IMMEDIATE logout via callback
    if (this.onFailureCallback) {
      LoggingService.error('🚪 Calling onFailureCallback to force logout NOW');
      this.onFailureCallback(message);
    } else {
      LoggingService.error('🚨 CRITICAL ERROR: No failure callback! Cannot logout user!');
    }

    // Emit event for UI too
    try { window.dispatchEvent(new CustomEvent('heartbeat:failure', { detail: { reason: 'failure', message } })); } catch (e) {}
  }

  /**
   * Handle session expired - IMMEDIATE LOGOUT
   */
  handleSessionExpired() {
    LoggingService.error('⏱️ SESSION EXPIRED - FORCING IMMEDIATE LOGOUT');
    
    // Stop service IMMEDIATELY
    this.stop();
    
    // Show notification for session expiry
    NotificationService.showLogoutNotification('Session expired. Please login again.', 'heartbeat');
    
    // Trigger IMMEDIATE logout
    if (this.onFailureCallback) {
      LoggingService.error('🚪 Calling logout callback for session expiry');
      this.onFailureCallback('Session expired. Please login again.');
    } else {
      LoggingService.error('🚨 CRITICAL ERROR: No failure callback! Cannot logout user!');
    }
  }

  /**
   * Queue heartbeat for when connection is restored
   */
  queueHeartbeat(location) {
    const heartbeat = {
      timestamp: new Date().toISOString(),
      location: location,
      sessionId: this.sessionId,
      deviceId: this.deviceId
    };

  this.queuedHeartbeats.push(heartbeat);

    // Keep only last 5 queued heartbeats
    if (this.queuedHeartbeats.length > 5) {
      this.queuedHeartbeats = this.queuedHeartbeats.slice(-5);
    }
  }

  /**
   * Process queued heartbeats when back online
   */
  async processQueuedHeartbeats() {
    if (this.queuedHeartbeats.length === 0) {
      return;
    }

  LoggingService.info(`Processing ${this.queuedHeartbeats.length} queued heartbeats...`);

    // Send only the most recent queued heartbeat
    const latestHeartbeat = this.queuedHeartbeats[this.queuedHeartbeats.length - 1];
    
    try {
      const response = await AuthService.sendHeartbeat(
        latestHeartbeat.sessionId,
        latestHeartbeat.deviceId,
        latestHeartbeat.location
      );

      if (response.ok) {
        LoggingService.info('Queued heartbeat sent successfully');
      } else {
        LoggingService.error('Failed to send queued heartbeat:', response.error);
      }
    } catch (error) {
      LoggingService.error('Error sending queued heartbeat:', error);
    }

    // Clear the queue
    this.queuedHeartbeats = [];
  }

  /**
   * Setup network monitoring
   */
  setupNetworkMonitoring() {
    this.handleOnline = () => {
      LoggingService.info('Network connection restored');
      this.isOnline = true;
      this.failureCount = 0; // Reset failure count when back online

      // Send immediate heartbeat when connection is restored and flush queued
      setTimeout(() => {
        this.processQueuedHeartbeats();
        this.sendHeartbeat();
      }, 1000); // Wait 1 second after coming online
    };

    this.handleOffline = () => {
      LoggingService.info('Network connection lost');
      this.isOnline = false;
    };

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  /**
   * Setup visibilitychange handling so we can recover quickly when app becomes visible
   */
  setupVisibilityMonitoring() {
    this.handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        LoggingService.info('Document became visible - forcing heartbeat and flushing queued items');
        // Re-acquire wake lock if necessary by signaling other services via event
        // Force an immediate heartbeat
        this.processQueuedHeartbeats();
        this.sendHeartbeat();
      }
    };

    window.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Schedule next heartbeat using a corrected timer (avoids setInterval drift and throttling effects)
   */
  scheduleNextHeartbeat() {
    // Clear any existing timer
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
      this.nextScheduledAt = null;
    }

    if (!this.isActive) return;

    const now = Date.now();
    let delay = this.interval;

    if (this.lastHeartbeat) {
      const next = this.lastHeartbeat.getTime() + this.interval;
      delay = Math.max(0, next - now);
      this.nextScheduledAt = next;
    } else {
      this.nextScheduledAt = now + delay;
    }

    this._timeoutId = setTimeout(() => {
      this._timeoutId = null;
      this.nextScheduledAt = null;
      if (this.isActive) this.sendHeartbeat();
    }, delay);
  }

  /**
   * Force immediate heartbeat
   */
  forceHeartbeat() {
    if (this.isActive) {
      LoggingService.info('Forcing immediate heartbeat...');
      this.sendHeartbeat();
    }
  }

  /**
   * Set heartbeat interval
   */
  setInterval(intervalMs) {
    this.interval = intervalMs;
    
    if (this.isActive) {
      // Restart with new interval
      const sessionId = this.sessionId;
      const deviceId = this.deviceId;
      const onFailure = this.onFailureCallback;
      
      this.stop();
      this.start(sessionId, deviceId, onFailure);
    }
  }

  /**
   * Get heartbeat status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      lastHeartbeat: this.lastHeartbeat,
      failureCount: this.failureCount,
      maxFailures: this.maxFailures,
      interval: this.interval,
      isOnline: this.isOnline,
      queuedCount: this.queuedHeartbeats.length
    };
  }

  /**
   * Get time until next heartbeat
   */
  getTimeUntilNext() {
    // If we don't have a lastHeartbeat, estimate based on interval
    const now = new Date();
    if (!this.lastHeartbeat) {
      // If service is active, assume next is interval from now
      if (this.isActive) {
        return this.interval;
      }
      return this.interval; // fallback
    }

    const nextHeartbeat = new Date(this.lastHeartbeat.getTime() + this.interval);
    const timeUntil = nextHeartbeat - now;

    return Math.max(0, timeUntil);
  }

  /**
   * Check if heartbeat is overdue
   */
  isOverdue() {
    if (!this.lastHeartbeat) {
      return false;
    }

    const now = new Date();
    const timeSinceLastHeartbeat = now - this.lastHeartbeat;
    return timeSinceLastHeartbeat > (this.interval * 1.5); // 150% of interval
  }
}

// Export singleton instance
const heartbeatService = new HeartbeatService();
export default heartbeatService;