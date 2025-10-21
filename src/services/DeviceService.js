/**
 * Device Service - Handles device ID generation and management
 * Device IDs are stored in localStorage for permanent identification
 */
class DeviceService {
  constructor() {
    this.deviceId = null;
    this.STORAGE_KEY = 'bams_device_id';
  }

  /**
   * Generate or retrieve device ID
   * Uses localStorage for persistent storage across sessions
   */
  async getDeviceId() {
    if (this.deviceId) {
      return { deviceId: this.deviceId };
    }

    try {
      // Try to get stored device ID from localStorage first
      const storedDeviceId = localStorage.getItem(this.STORAGE_KEY);
      
      if (storedDeviceId) {
        this.deviceId = storedDeviceId;
        console.log('Retrieved existing Device ID from localStorage');
        return { deviceId: this.deviceId };
      }

      // Try electron store as fallback (for backward compatibility)
      if (window.electronAPI?.storeGet) {
        const electronStoredId = await window.electronAPI.storeGet('deviceId');
        if (electronStoredId) {
          this.deviceId = electronStoredId;
          // Migrate to localStorage
          localStorage.setItem(this.STORAGE_KEY, this.deviceId);
          console.log('Migrated Device ID from electron store to localStorage');
          return { deviceId: this.deviceId };
        }
      }

      // Generate new device ID
      this.deviceId = await this.generateDeviceId();
      
      // Store device ID in localStorage
      localStorage.setItem(this.STORAGE_KEY, this.deviceId);
      
      // Also store in electron store if available
      if (window.electronAPI?.storeSet) {
        await window.electronAPI.storeSet('deviceId', this.deviceId);
      }
      
      console.log('Generated and stored new Device ID:', this.deviceId);
      return { deviceId: this.deviceId };
    } catch (error) {
      console.error('Error getting device ID:', error);
      throw new Error('Failed to generate device ID');
    }
  }

  /**
   * Generate a new unique device ID
   * Format: BAMS-[TIMESTAMP]-[RANDOM]
   */
  async generateDeviceId() {
    try {
      // Try to get hostname from electron API
      let hostname = 'DEVICE';
      if (window.electronAPI?.getDeviceInfo) {
        const deviceInfo = await window.electronAPI.getDeviceInfo();
        hostname = (deviceInfo.hostname || 'DEVICE')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .substring(0, 10);
      }

      // Generate timestamp component (base36 for shorter string)
      const timestamp = Date.now().toString(36).toUpperCase();
      
      // Generate random component
      const random = this.generateRandomString(6);
      
      // Format: HOSTNAME-TIMESTAMP-RANDOM
      return `${hostname}-${timestamp}-${random}`;
    } catch (error) {
      // Ultimate fallback: BAMS prefix + timestamp + random
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = this.generateRandomString(8);
      return `WorkSens-${timestamp}-${random}`;
    }
  }

  /**
   * Generate a cryptographically secure random string
   */
  generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    // Use crypto.getRandomValues for better randomness
    if (window.crypto && window.crypto.getRandomValues) {
      const randomValues = new Uint8Array(length);
      window.crypto.getRandomValues(randomValues);
      for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
      }
    } else {
      // Fallback to Math.random
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    
    return result;
  }

  /**
   * Get device information for display
   */
  async getDeviceInfo() {
    try {
      const deviceId = await this.getDeviceId();
      
      let deviceInfo = {
        hostname: 'Unknown',
        platform: 'Unknown',
        arch: 'Unknown'
      };

      if (window.electronAPI?.getDeviceInfo) {
        const electronInfo = await window.electronAPI.getDeviceInfo();
        deviceInfo = { ...deviceInfo, ...electronInfo };
      }
      
      return {
        ...deviceInfo,
        ...deviceId
      };
    } catch (error) {
      console.error('Error getting device info:', error);
      return {
        deviceId: 'ERROR-GENERATING-ID',
        hostname: 'unknown',
        platform: 'unknown',
        arch: 'unknown'
      };
    }
  }

  /**
   * Reset device ID (for debugging/testing only)
   */
  async resetDeviceId() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      if (window.electronAPI?.storeDelete) {
        await window.electronAPI.storeDelete('deviceId');
      }
      this.deviceId = null;
      console.log('Device ID reset');
      return await this.getDeviceId();
    } catch (error) {
      console.error('Error resetting device ID:', error);
      throw error;
    }
  }
}

// Export singleton instance
const deviceService = new DeviceService();
export default deviceService;