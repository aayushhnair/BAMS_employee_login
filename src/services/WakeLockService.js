import LoggingService from './LoggingService';

/**
 * Wake Lock Service - Prevents screen from turning off while app is active
 * Uses Screen Wake Lock API to keep screen awake for location tracking and heartbeat
 */
class WakeLockService {
  constructor() {
    this.wakeLock = null;
    this.isSupported = 'wakeLock' in navigator;
    this.isActive = false;
  }

  /**
   * Request wake lock to keep screen active
   */
  async requestWakeLock() {
    if (!this.isSupported) {
      LoggingService.warn('Wake Lock API not supported in this browser');
      return false;
    }

    if (this.isActive && this.wakeLock) {
      LoggingService.info('Wake lock already active');
      return true;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.isActive = true;

      // Listen for wake lock release
      this.wakeLock.addEventListener('release', () => {
        LoggingService.info('Screen wake lock released');
        this.isActive = false;
      });

      LoggingService.info('✅ Screen wake lock acquired - screen will stay on');
      return true;

    } catch (err) {
      LoggingService.error('Failed to acquire wake lock:', err);
      this.isActive = false;
      return false;
    }
  }

  /**
   * Release wake lock
   */
  async releaseWakeLock() {
    if (!this.wakeLock) {
      return;
    }

    try {
      await this.wakeLock.release();
      this.wakeLock = null;
      this.isActive = false;
      LoggingService.info('Screen wake lock released manually');
    } catch (err) {
      LoggingService.error('Failed to release wake lock:', err);
    }
  }

  /**
   * Reacquire wake lock (e.g., after page visibility change)
   */
  async reacquireWakeLock() {
    if (this.isActive) {
      return true;
    }

    LoggingService.info('Reacquiring wake lock...');
    return await this.requestWakeLock();
  }

  /**
   * Setup visibility change listener to reacquire lock when page becomes visible
   */
  setupVisibilityListener() {
    if (!this.isSupported) {
      return;
    }

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        LoggingService.info('Page visible - checking wake lock status');
        
        // Reacquire wake lock if it was released
        if (!this.isActive) {
          await this.reacquireWakeLock();
        }
      }
    });

    LoggingService.info('Wake lock visibility listener setup complete');
  }

  /**
   * Get wake lock status
   */
  getStatus() {
    return {
      isSupported: this.isSupported,
      isActive: this.isActive
    };
  }
}

// Export singleton instance
const wakeLockService = new WakeLockService();
export default wakeLockService;
