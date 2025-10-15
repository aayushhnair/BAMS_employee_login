/**
 * Location Service - Handles HTML5 geolocation with on-demand updates
 * Only fetches location when needed (login, heartbeat) - no continuous polling
 */
class LocationService {
  constructor() {
    this.currentLocation = null;
    this.lastUpdate = null;
    this.updateCallback = null;
    this.errorCallback = null;
  }

  /**
   * Initialize location service with callback
   */
  init(onLocationUpdate, onLocationError) {
    this.updateCallback = onLocationUpdate;
    this.errorCallback = onLocationError;
    // Get initial position once, don't start watching
    this.getLocationOnce();
  }

  /**
   * Get location once without watching
   */
  getLocationOnce() {
    if (!navigator.geolocation) {
      const error = new Error('Geolocation is not supported by this browser');
      this.handleError(error);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000, // 15 seconds timeout
      maximumAge: 0 // Don't use cached location, get fresh one
    };

    // Get current position only
    navigator.geolocation.getCurrentPosition(
      (position) => this.handlePosition(position),
      (error) => this.handleError(error),
      options
    );

    console.log('Location service: Getting location once');
  }

  /**
   * Stop watching for location changes (deprecated - kept for compatibility)
   */
  stopWatching() {
    // No-op since we're not watching anymore
    console.log('Location service stopped');
  }

  /**
   * Handle successful position update
   */
  handlePosition(position) {
    const location = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
      ts: new Date(position.timestamp).toISOString()
    };

    this.currentLocation = location;
    this.lastUpdate = new Date();

    console.log('Location updated:', {
      lat: location.lat.toFixed(6),
      lon: location.lon.toFixed(6),
      accuracy: Math.round(location.accuracy)
    });

    // Call update callback
    if (this.updateCallback) {
      this.updateCallback(location);
    }
  }

  /**
   * Handle location error
   */
  handleError(error) {
    let errorMessage = 'Unknown location error';
    let errorCode = 'UNKNOWN_ERROR';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied by user';
        errorCode = 'PERMISSION_DENIED';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable';
        errorCode = 'POSITION_UNAVAILABLE';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        errorCode = 'TIMEOUT';
        break;
      default:
        errorMessage = error.message || errorMessage;
        errorCode = 'GEOLOCATION_ERROR';
        break;
    }

    console.error('Location error:', errorMessage, error);

    // Call error callback
    if (this.errorCallback) {
      this.errorCallback({
        code: errorCode,
        message: errorMessage,
        originalError: error
      });
    }
  }

  /**
   * Get current location
   */
  getCurrentLocation() {
    return this.currentLocation;
  }

  /**
   * Get last update time
   */
  getLastUpdateTime() {
    return this.lastUpdate;
  }

  /**
   * Check if location is fresh (within last 2 minutes)
   */
  isLocationFresh() {
    if (!this.lastUpdate) return false;
    const now = new Date();
    const diff = now - this.lastUpdate;
    return diff < 120000; // 2 minutes
  }

  /**
   * Get location accuracy status
   */
  getAccuracyStatus() {
    if (!this.currentLocation) {
      return { status: 'no_location', message: 'No location data' };
    }

    const accuracy = this.currentLocation.accuracy;
    
    if (accuracy <= 10) {
      return { status: 'excellent', message: 'Excellent GPS signal' };
    } else if (accuracy <= 50) {
      return { status: 'good', message: 'Good GPS signal' };
    } else if (accuracy <= 100) {
      return { status: 'fair', message: 'Fair GPS signal' };
    } else {
      return { status: 'poor', message: 'Poor GPS signal' };
    }
  }

  /**
   * Force location update (use this for heartbeat and login)
   */
  forceUpdate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Force fresh location
      };

      console.log('Location service: Fetching fresh location for heartbeat/login');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.handlePosition(position);
          resolve(this.currentLocation);
        },
        (error) => {
          this.handleError(error);
          reject(error);
        },
        options
      );
    });
  }

  /**
   * Set update interval (deprecated - kept for compatibility)
   */
  setUpdateInterval(interval) {
    // No-op since we don't poll anymore
  }

  /**
   * Get formatted location string
   */
  getFormattedLocation() {
    if (!this.currentLocation) {
      return 'Location not available';
    }

    return `${this.currentLocation.lat.toFixed(6)}, ${this.currentLocation.lon.toFixed(6)}`;
  }

  /**
   * Check if user is within a specific area
   */
  isWithinArea(centerLat, centerLon, radiusMeters) {
    if (!this.currentLocation) {
      return false;
    }

    const distance = this.calculateDistance(
      this.currentLocation.lat,
      this.currentLocation.lon,
      centerLat,
      centerLon
    );

    return distance <= radiusMeters;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Cleanup service
   */
  cleanup() {
    // No watching to stop since we don't poll
    this.updateCallback = null;
    this.errorCallback = null;
    this.currentLocation = null;
    this.lastUpdate = null;
  }
}

// Export singleton instance
const locationService = new LocationService();
export default locationService;