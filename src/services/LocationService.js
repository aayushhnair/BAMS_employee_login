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
   * Get location with GPS forcing - uses watchPosition for better accuracy
   */
  getLocationOnce() {
    if (!navigator.geolocation) {
      const error = new Error('Geolocation is not supported by this browser');
      this.handleError(error);
      return;
    }

    // More aggressive options to force GPS
    const options = {
      enableHighAccuracy: true,  // Force GPS over WiFi/cell tower
      timeout: 45000,            // 45 seconds for GPS acquisition
      maximumAge: 0              // Never use cached position
    };

    // Use watchPosition briefly to force GPS initialization, then stop
    // This is a trick to ensure GPS is actually used
    let watchId = navigator.geolocation.watchPosition(
      (position) => {
        // Stop watching after first accurate position
        if (position.coords.accuracy < 100 || Date.now() - startTime > 30000) {
          navigator.geolocation.clearWatch(watchId);
          this.handlePosition(position);
        }
      },
      (error) => {
        navigator.geolocation.clearWatch(watchId);
        this.handleError(error);
      },
      options
    );

    const startTime = Date.now();
    
    // Fallback: if no good position in 30 seconds, use what we have
    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      if (!this.currentLocation) {
        // Try one more time with getCurrentPosition
        navigator.geolocation.getCurrentPosition(
          (position) => this.handlePosition(position),
          (error) => this.handleError(error),
          options
        );
      }
    }, 30000);

    console.log('Location service: Acquiring GPS fix (forcing high accuracy)...');
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
   * Force location update with GPS (use this for heartbeat and login)
   * ENHANCED: More aggressive GPS forcing for rural areas
   */
  forceUpdate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      // ULTRA-AGGRESSIVE OPTIONS for rural GPS
      const options = {
        enableHighAccuracy: true,  // Must use GPS
        timeout: 90000,            // 90 seconds timeout (longer for rural areas)
        maximumAge: 0              // Never use cache
      };

      console.log('🛰️ Acquiring GPS fix (ULTRA high-accuracy mode for rural areas)...');
      console.log('⏱️ This may take up to 60 seconds for accurate GPS lock...');
      const startTime = Date.now();
      let bestPosition = null;
      let bestAccuracy = Infinity;

      // Use watchPosition to force GPS, collect multiple readings
      let watchId = navigator.geolocation.watchPosition(
        (position) => {
          const elapsed = Date.now() - startTime;
          const acc = position.coords.accuracy;
          
          // Track best position
          if (acc < bestAccuracy) {
            bestPosition = position;
            bestAccuracy = acc;
          }
          
          console.log(`📡 GPS update: ${acc.toFixed(0)}m accuracy after ${(elapsed/1000).toFixed(1)}s (best: ${bestAccuracy.toFixed(0)}m)`);
          
          // Accept if accuracy is EXCELLENT (< 50m) OR we've waited 60 seconds
          if (acc < 50) {
            console.log('✅ EXCELLENT GPS lock achieved!');
            navigator.geolocation.clearWatch(watchId);
            this.handlePosition(position);
            
            console.log('✅ GPS locked:', {
              lat: position.coords.latitude.toFixed(6),
              lon: position.coords.longitude.toFixed(6),
              accuracy: Math.round(acc) + 'm',
              time: (elapsed/1000).toFixed(1) + 's',
              source: 'GPS satellites'
            });
            
            resolve(this.currentLocation);
          } else if (elapsed > 60000) {
            // After 60 seconds, use best position we got
            console.log('⏰ 60s elapsed - using best available position');
            navigator.geolocation.clearWatch(watchId);
            
            if (bestPosition) {
              this.handlePosition(bestPosition);
              console.log(`⚠️ Using best position: ${bestAccuracy.toFixed(0)}m accuracy`);
              
              if (bestAccuracy > 1000) {
                console.warn('🚨 WARNING: Accuracy is very poor! Browser may be using WiFi/Cell tower triangulation instead of GPS.');
                console.warn('💡 SOLUTIONS:');
                console.warn('   1. Check device GPS is enabled in system settings');
                console.warn('   2. Grant location permission at SYSTEM level (not just browser)');
                console.warn('   3. Move outdoors with clear sky view');
                console.warn('   4. Wait 2-3 minutes for GPS to acquire satellites');
                console.warn('   5. Try Chrome instead of other browsers (better GPS support)');
              }
              
              resolve(this.currentLocation);
            } else {
              reject(new Error('GPS timeout - no position acquired'));
            }
          }
        },
        (error) => {
          navigator.geolocation.clearWatch(watchId);
          console.error('❌ GPS error:', error.message);
          
          if (error.code === 1) {
            console.error('🚫 Location permission denied! Grant permission and refresh.');
          } else if (error.code === 2) {
            console.error('📡 Position unavailable - GPS hardware may not be working.');
          } else if (error.code === 3) {
            console.error('⏰ Request timeout - GPS taking too long to acquire signal.');
          }
          
          this.handleError(error);
          reject(error);
        },
        options
      );

      // Ultimate timeout fallback after 75 seconds
      setTimeout(() => {
        if (watchId) {
          console.log('⏰ 75s timeout reached - stopping GPS acquisition');
          navigator.geolocation.clearWatch(watchId);
          
          if (bestPosition) {
            this.handlePosition(bestPosition);
            console.log(`⚠️ Using best position from ${bestAccuracy.toFixed(0)}m accuracy`);
            resolve(this.currentLocation);
          } else if (this.currentLocation) {
            console.log('⚠️ Using cached position (very old)');
            resolve(this.currentLocation);
          } else {
            reject(new Error('GPS timeout - no position acquired'));
          }
        }
      }, 75000);
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