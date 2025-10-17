import AuthService from './AuthService';
import LocationService from './LocationService';
import { HEARTBEAT_INTERVAL_MS } from '../config/constants';

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
  }

  /**
   * Start heartbeat service
   */
  start(sessionId, deviceId, onFailure) {
    if (this.isActive) {
      console.warn('Heartbeat service already active');
      return;
    }

    this.sessionId = sessionId;
    this.deviceId = deviceId;
    this.onFailureCallback = onFailure;
    this.isActive = true;
    this.failureCount = 0;

    console.log('Starting heartbeat service...');

    // Send initial heartbeat
    this.sendHeartbeat();

    // Setup periodic heartbeat
    this.intervalId = setInterval(() => {
      this.sendHeartbeat();
    }, this.interval);

    // Monitor network status
    this.setupNetworkMonitoring();

    console.log(`Heartbeat service started with ${this.interval / 60000} minute interval`);
  }

  /**
   * Stop heartbeat service
   */
  stop() {
    if (!this.isActive) {
      return;
    }

    console.log('Stopping heartbeat service...');

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

    // Remove network event listeners
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    console.log('Heartbeat service stopped');
  }

  /**
   * Send heartbeat to server
   */
  async sendHeartbeat() {
    if (!this.isActive || !this.sessionId || !this.deviceId) {
      console.warn('Heartbeat service not properly initialized');
      return;
    }

    try {
      // Fetch fresh location for this heartbeat
      console.log('Fetching fresh location for heartbeat...');
      let location;
      try {
        location = await LocationService.forceUpdate();
      } catch (error) {
        console.warn('Failed to get fresh location, using cached:', error);
        location = LocationService.getCurrentLocation();
      }
      
      if (!location) {
        console.warn('No location available for heartbeat');
        this.handleHeartbeatFailure('No location data');
        return;
      }

      // Check if we're online
      if (!this.isOnline) {
        console.log('Offline - queueing heartbeat');
        this.queueHeartbeat(location);
        return;
      }

      console.log('Sending heartbeat with fresh location...');
      const response = await AuthService.sendHeartbeat(this.sessionId, this.deviceId, location);

      if (response.ok) {
        this.handleHeartbeatSuccess();
      } else {
        this.handleHeartbeatFailure(response.error || 'Heartbeat failed');
      }

    } catch (error) {
      console.error('Heartbeat error:', error);
      this.handleHeartbeatFailure(error.message);
    }
  }

  /**
   * Handle successful heartbeat
   */
  handleHeartbeatSuccess() {
    this.failureCount = 0;
    this.lastHeartbeat = new Date();
    console.log('Heartbeat successful at', this.lastHeartbeat.toLocaleTimeString());

    // Process any queued heartbeats when back online
    if (this.queuedHeartbeats.length > 0) {
      this.processQueuedHeartbeats();
    }
  }

  /**
   * Handle heartbeat failure
   */
  handleHeartbeatFailure(reason) {
    this.failureCount++;
    console.error(`Heartbeat failed (${this.failureCount}/${this.maxFailures}):`, reason);

    if (this.failureCount >= this.maxFailures) {
      console.error('Maximum heartbeat failures reached - triggering auto-logout');
      
      if (this.onFailureCallback) {
        this.onFailureCallback('Network connectivity lost - multiple heartbeat failures');
      }
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

    console.log(`Processing ${this.queuedHeartbeats.length} queued heartbeats...`);

    // Send only the most recent queued heartbeat
    const latestHeartbeat = this.queuedHeartbeats[this.queuedHeartbeats.length - 1];
    
    try {
      const response = await AuthService.sendHeartbeat(
        latestHeartbeat.sessionId,
        latestHeartbeat.deviceId,
        latestHeartbeat.location
      );

      if (response.ok) {
        console.log('Queued heartbeat sent successfully');
      } else {
        console.error('Failed to send queued heartbeat:', response.error);
      }
    } catch (error) {
      console.error('Error sending queued heartbeat:', error);
    }

    // Clear the queue
    this.queuedHeartbeats = [];
  }

  /**
   * Setup network monitoring
   */
  setupNetworkMonitoring() {
    this.handleOnline = () => {
      console.log('Network connection restored');
      this.isOnline = true;
      this.failureCount = 0; // Reset failure count when back online
      
      // Send immediate heartbeat when connection is restored
      setTimeout(() => {
        this.sendHeartbeat();
      }, 1000); // Wait 1 second after coming online
    };

    this.handleOffline = () => {
      console.log('Network connection lost');
      this.isOnline = false;
    };

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  /**
   * Force immediate heartbeat
   */
  forceHeartbeat() {
    if (this.isActive) {
      console.log('Forcing immediate heartbeat...');
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
    if (!this.lastHeartbeat) {
      return 0;
    }

    const nextHeartbeat = new Date(this.lastHeartbeat.getTime() + this.interval);
    const now = new Date();
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