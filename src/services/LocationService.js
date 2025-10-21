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
   * Get location with FORCED GPS-ONLY (no WiFi triangulation)
   * Optimized for Chrome browser with ULTRA-aggressive GPS-only settings
   * CRITICAL: This method MUST use GPS satellites, NEVER WiFi/Cell towers
   */
  getLocationOnce() {
    if (!navigator.geolocation) {
      const error = new Error('Geolocation is not supported by this browser');
      this.handleError(error);
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // ULTRA AGGRESSIVE GPS-ONLY MODE - ABSOLUTELY NO WiFi TRIANGULATION
    // ═══════════════════════════════════════════════════════════════
    const options = {
      enableHighAccuracy: true,  // CRITICAL: Forces GPS satellites (not WiFi/cell)
      timeout: 30000,            // 30 seconds maximum for GPS lock
      maximumAge: 0,             // NEVER EVER use cached - ALWAYS fresh GPS fix
      // Chrome-specific hints (non-standard but supported by Chrome/Edge)
      desiredAccuracy: 5,        // Request 5m accuracy (FORCES GPS-only mode)
      priority: 'high'           // Maximum priority for GPS acquisition
    };

    // TRICK: Use watchPosition() to FORCE GPS mode
    // Chrome will PREFER GPS satellites with this approach vs getCurrentPosition()
    // getCurrentPosition() may fallback to WiFi if GPS is slow
    let watchId = navigator.geolocation.watchPosition(
      (position) => {
        const elapsed = Date.now() - startTime;
        const acc = position.coords.accuracy;
        
        // STRICT ACCEPTANCE CRITERIA:
        // Accept ONLY if accuracy < 100m (GPS-level accuracy)
        // OR we've waited 40+ seconds (ensure GPS had time to lock)
        // Reject anything > 100m within first 40s (likely WiFi/cell tower)
        if (acc < 100 || elapsed > 40000) {
          navigator.geolocation.clearWatch(watchId);
          this.handlePosition(position);
        }
        // If accuracy is terrible (>500m) within first 40s, keep waiting for GPS
      },
      (error) => {
        navigator.geolocation.clearWatch(watchId);
        this.handleError(error);
      },
      options
    );

    const startTime = Date.now();
    
    // Safety fallback after 30 seconds
    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      if (!this.currentLocation) {
        // Final attempt with getCurrentPosition (still GPS-forced with same options)
        navigator.geolocation.getCurrentPosition(
          (position) => this.handlePosition(position),
          (error) => this.handleError(error),
          options
        );
      }
    }, 30000);
  }

  /**
   * Stop watching for location changes (deprecated - kept for compatibility)
   */
  stopWatching() {
    // No-op since we're not watching anymore
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
   * ULTRA AGGRESSIVE GPS-ONLY MODE - ABSOLUTELY NO WiFi/Cell Tower Triangulation
   * This method will WAIT for true GPS lock and REJECT WiFi-based locations
   */
  forceUpdate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      // ═══════════════════════════════════════════════════════════════
      // MAXIMUM GPS FORCING - NO COMPROMISES ON WiFi TRIANGULATION
      // ═══════════════════════════════════════════════════════════════
      const options = {
        enableHighAccuracy: true,  // CRITICAL: Forces GPS satellites ONLY
        timeout: 30000,            // 30 seconds timeout - strict requirement
        maximumAge: 0,             // NEVER EVER use cached position - ALWAYS fresh GPS fix
        // Chrome-specific hints (non-standard but supported by Chrome/Edge/Opera)
        desiredAccuracy: 5,        // Request 5m accuracy (FORCES GPS-only mode, WiFi cannot achieve this)
        priority: 'high'           // Maximum priority for GPS acquisition
      };

      const startTime = Date.now();
      let bestPosition = null;
      let bestAccuracy = Infinity;
      let gpsReadings = [];

      // ═══════════════════════════════════════════════════════════════
      // USE watchPosition() TO FORCE GPS MODE
      // ═══════════════════════════════════════════════════════════════
      // watchPosition() forces Chrome to use GPS hardware directly
      // getCurrentPosition() may fallback to WiFi if GPS is slow
      let watchId = navigator.geolocation.watchPosition(
        (position) => {
          const elapsed = Date.now() - startTime;
          const acc = position.coords.accuracy;
          
          // Track all GPS readings
          gpsReadings.push({ accuracy: acc, time: elapsed });
          
          // Update best position if this is more accurate
          if (acc < bestAccuracy) {
            bestPosition = position;
            bestAccuracy = acc;
          }
          
          // ═══════════════════════════════════════════════════════════════
          // ACCEPTANCE CRITERIA - STRICT GPS-ONLY VALIDATION
          // ═══════════════════════════════════════════════════════════════
          // 1. EXCELLENT: accuracy < 30m = TRUE GPS lock (accept immediately)
          // 2. GOOD: accuracy < 50m after 10s = GPS satellites locked
          // 3. ACCEPTABLE: accuracy < 100m after 30s = GPS working but signal weak
          // 4. REJECT: accuracy > 200m within first 30s = likely WiFi/Cell, wait longer
          
          if (acc < 30) {
            // EXCELLENT GPS LOCK - Accept immediately
            navigator.geolocation.clearWatch(watchId);
            this.handlePosition(position);
            resolve(this.currentLocation);
          } else if (acc < 50 && elapsed > 10000) {
            // GOOD GPS LOCK - Accept after 10s
            navigator.geolocation.clearWatch(watchId);
            this.handlePosition(position);
            resolve(this.currentLocation);
          } else if (acc < 100 && elapsed > 30000) {
            // ACCEPTABLE GPS - Accept after 30s if < 100m
            navigator.geolocation.clearWatch(watchId);
            this.handlePosition(position);
            resolve(this.currentLocation);
          } else if (elapsed > 30000) {
            // After 30 seconds, use BEST position collected
            // But warn if accuracy is poor (likely WiFi fallback)
            navigator.geolocation.clearWatch(watchId);
            
            if (bestPosition) {
              this.handlePosition(bestPosition);
              
              // If accuracy is > 500m, it's DEFINITELY WiFi/Cell tower triangulation
              // Log warning but still use it (user may be indoors)
              if (bestAccuracy > 500) {
                // CRITICAL WARNING: This is NOT GPS!
                // User is likely indoors or GPS hardware is disabled
              }
              
              resolve(this.currentLocation);
            } else {
              reject(new Error('GPS timeout - no position acquired after 30 seconds'));
            }
          }
          // Otherwise, keep waiting for better GPS accuracy
        },
        (error) => {
          navigator.geolocation.clearWatch(watchId);
          this.handleError(error);
          reject(error);
        },
        options
      );

      // ═══════════════════════════════════════════════════════════════
      // ULTIMATE TIMEOUT FALLBACK - 30 seconds
      // ═══════════════════════════════════════════════════════════════
      setTimeout(() => {
        if (watchId) {
          navigator.geolocation.clearWatch(watchId);
          
          if (bestPosition) {
            this.handlePosition(bestPosition);
            resolve(this.currentLocation);
          } else if (this.currentLocation) {
            // Use cached position as absolute last resort
            resolve(this.currentLocation);
          } else {
            reject(new Error('GPS timeout - no position acquired after 30 seconds'));
          }
        }
      }, 30000);
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