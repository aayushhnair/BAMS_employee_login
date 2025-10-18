/**
 * NotificationService - Browser notification management for critical events
 * Displays system notifications for logout events and GPS accuracy warnings
 */
class NotificationService {
  constructor() {
    this.permission = 'default';
    this.enabled = false;
    this.notificationQueue = [];
  }

  /**
   * Initialize notification service and request permission
   */
  async init() {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.warn('❌ Browser does not support notifications');
      this.enabled = false;
      return false;
    }

    // Check current permission
    this.permission = Notification.permission;

    if (this.permission === 'granted') {
      this.enabled = true;
      console.log('✅ Notification permission already granted');
      return true;
    } else if (this.permission === 'denied') {
      this.enabled = false;
      console.warn('❌ Notification permission denied by user');
      return false;
    } else {
      // Request permission
      try {
        const result = await Notification.requestPermission();
        this.permission = result;
        this.enabled = result === 'granted';
        
        if (this.enabled) {
          console.log('✅ Notification permission granted');
          // Show welcome notification
          this.showWelcomeNotification();
        } else {
          console.warn('❌ Notification permission denied');
        }
        
        return this.enabled;
      } catch (error) {
        console.error('Failed to request notification permission:', error);
        this.enabled = false;
        return false;
      }
    }
  }

  /**
   * Show welcome notification after permission granted
   */
  showWelcomeNotification() {
    if (!this.enabled) return;

    try {
      const notification = new Notification('WorkSens Notifications Active', {
        body: 'You\'ll be alerted for session timeouts and GPS issues',
        icon: '/assets/logo192.png',
        badge: '/assets/logo192.png',
        tag: 'welcome',
        requireInteraction: false,
        silent: false
      });

      // Auto-close after 3 seconds
      setTimeout(() => {
        notification.close();
      }, 3000);
    } catch (error) {
      console.error('Failed to show welcome notification:', error);
    }
  }

  /**
   * Show logout notification (CRITICAL)
   * @param {string} reason - Logout reason
   * @param {string} source - Source of logout (heartbeat, api_interceptor, manual)
   */
  showLogoutNotification(reason, source = 'system') {
    if (!this.enabled) {
      console.log('🔔 Notification disabled - would have shown logout alert');
      return;
    }

    const titles = {
      heartbeat: '🚨 WorkSens: Session Timeout',
      api_interceptor: '🚨 WorkSens: Session Invalidated',
      manual: '👋 WorkSens: Logged Out',
      system: '⚠️ WorkSens: Auto Logout'
    };

    const title = titles[source] || titles.system;
    const body = reason || 'Your session has ended. Please login again.';

    try {
      const notification = new Notification(title, {
        body: body,
        icon: '/assets/logo192.png',
        badge: '/assets/logo192.png',
        tag: 'logout',
        requireInteraction: true, // CRITICAL: User must acknowledge
        silent: false,
        vibrate: [200, 100, 200], // Vibrate pattern for mobile
        actions: [
          {
            action: 'relogin',
            title: 'Login Again'
          }
        ]
      });

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
        // Reload page to show login screen
        window.location.reload();
      };

      console.log(`🔔 Logout notification shown: ${title} - ${body}`);
    } catch (error) {
      console.error('Failed to show logout notification:', error);
    }
  }

  /**
   * Show GPS accuracy warning (when accuracy decreases while logged in)
   * @param {number} accuracy - Current accuracy in meters
   * @param {string} status - Accuracy status (excellent, good, fair, poor)
   */
  showGPSAccuracyWarning(accuracy, status) {
    if (!this.enabled) {
      console.log(`🔔 Notification disabled - would have shown GPS warning (${accuracy}m)`);
      return;
    }

    // Only show for poor accuracy
    if (status !== 'poor' && accuracy < 100) {
      return;
    }

    const title = '📡 WorkSens: GPS Accuracy Warning';
    let body = '';
    let requireInteraction = false;

    if (accuracy > 1000) {
      body = `GPS signal very poor (${Math.round(accuracy)}m). Move to clear sky area.`;
      requireInteraction = true; // CRITICAL warning
    } else if (accuracy > 500) {
      body = `GPS accuracy decreased to ${Math.round(accuracy)}m. Signal may be weak.`;
      requireInteraction = true;
    } else if (accuracy > 100) {
      body = `GPS accuracy: ${Math.round(accuracy)}m. Consider moving outdoors.`;
      requireInteraction = false;
    } else {
      return; // Don't spam for acceptable accuracy
    }

    try {
      const notification = new Notification(title, {
        body: body,
        icon: '/assets/logo192.png',
        badge: '/assets/logo192.png',
        tag: 'gps-accuracy', // Replaces previous GPS notifications
        requireInteraction: requireInteraction,
        silent: accuracy < 500, // Only vibrate for critical accuracy issues
        vibrate: accuracy > 500 ? [200, 100, 200] : undefined
      });

      // Auto-close after 5 seconds for non-critical warnings
      if (!requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      console.log(`🔔 GPS accuracy notification shown: ${accuracy}m (${status})`);
    } catch (error) {
      console.error('Failed to show GPS accuracy notification:', error);
    }
  }

  /**
   * Show heartbeat failure notification (connection lost)
   */
  showHeartbeatFailureNotification(message) {
    if (!this.enabled) {
      console.log('🔔 Notification disabled - would have shown heartbeat failure');
      return;
    }

    try {
      const notification = new Notification('💔 WorkSens: Connection Lost', {
        body: message || 'Server connection lost. You have been logged out.',
        icon: '/assets/logo192.png',
        badge: '/assets/logo192.png',
        tag: 'heartbeat-failure',
        requireInteraction: true, // CRITICAL: User must acknowledge
        silent: false,
        vibrate: [300, 100, 300, 100, 300]
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        window.location.reload();
      };

      console.log('🔔 Heartbeat failure notification shown');
    } catch (error) {
      console.error('Failed to show heartbeat failure notification:', error);
    }
  }

  /**
   * Show network offline notification
   */
  showOfflineNotification() {
    if (!this.enabled) return;

    try {
      const notification = new Notification('🌐 WorkSens: Network Offline', {
        body: 'Internet connection lost. Heartbeat may fail.',
        icon: '/assets/logo192.png',
        badge: '/assets/logo192.png',
        tag: 'network-offline',
        requireInteraction: false,
        silent: true
      });

      // Auto-close after 3 seconds
      setTimeout(() => {
        notification.close();
      }, 3000);
    } catch (error) {
      console.error('Failed to show offline notification:', error);
    }
  }

  /**
   * Show network online notification
   */
  showOnlineNotification() {
    if (!this.enabled) return;

    try {
      const notification = new Notification('✅ WorkSens: Network Restored', {
        body: 'Internet connection restored.',
        icon: '/assets/logo192.png',
        badge: '/assets/logo192.png',
        tag: 'network-online',
        requireInteraction: false,
        silent: true
      });

      // Auto-close after 2 seconds
      setTimeout(() => {
        notification.close();
      }, 2000);
    } catch (error) {
      console.error('Failed to show online notification:', error);
    }
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get current permission status
   */
  getPermission() {
    return this.permission;
  }

  /**
   * Request permission again (if previously denied, user must enable in browser settings)
   */
  async requestPermission() {
    return await this.init();
  }

  /**
   * Test notification (for debugging)
   */
  showTestNotification() {
    if (!this.enabled) {
      console.log('🔔 Notification disabled - enable in browser settings');
      return;
    }

    try {
      const notification = new Notification('🧪 WorkSens: Test Notification', {
        body: 'This is a test notification. If you see this, notifications are working!',
        icon: '/assets/logo192.png',
        badge: '/assets/logo192.png',
        tag: 'test',
        requireInteraction: false,
        silent: false
      });

      setTimeout(() => {
        notification.close();
      }, 4000);

      console.log('🔔 Test notification shown');
    } catch (error) {
      console.error('Failed to show test notification:', error);
    }
  }
}

// Export singleton instance
const notificationService = new NotificationService();
export default notificationService;
