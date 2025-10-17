import axios from 'axios';

/**
 * Authentication Service - Handles login, logout, and session management
 */
class AuthService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';
    this.timeout = 10000; // 10 seconds
    this.retryAttempts = 3;
    
    // Setup axios instance
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.api.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          data: config.data ? { ...config.data, password: '***' } : undefined
        });
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.api.interceptors.response.use(
      (response) => {
        console.log(`API Response: ${response.status}`, response.data);
        return response;
      },
      (error) => {
        console.error('API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Login user with credentials and location
   */
  async login({ username, password, deviceId, location }) {
    try {
      if (!location) {
        throw new Error('Location is required for login');
      }

      const loginData = {
        username: username.trim(),
        password: password,
        deviceId: deviceId,
        location: {
          lat: location.lat,
          lon: location.lon,
          accuracy: location.accuracy,
          ts: location.ts || new Date().toISOString()
        }
      };

      const response = await this.api.post('/api/auth/login', loginData);
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'Login failed');
    }
  }

  /**
   * Logout user
   */
  async logout(sessionId, deviceId, location) {
    try {
      const logoutData = {
        sessionId: sessionId,
        deviceId: deviceId,
        location: location ? {
          lat: location.lat,
          lon: location.lon,
          accuracy: location.accuracy,
          ts: new Date().toISOString()
        } : null
      };

      const response = await this.api.post('/api/auth/logout', logoutData);
      
      return response.data;
    } catch (error) {
      console.error('Logout error:', error);
      // Don't throw error for logout - always allow local cleanup
      return { ok: false, error: 'Logout request failed but session cleared locally' };
    }
  }

  /**
   * Verify session is still valid
   * Returns session data including timeSinceLastHeartbeatMs for accurate countdown
   */
  async verifySession(sessionId) {
    try {
      const response = await this.api.post('/api/auth/verify-session', {
        sessionId: sessionId
      });
      
      // Return full response data including timeSinceLastHeartbeatMs
      if (response.data.ok === true) {
        return {
          valid: true,
          session: response.data.session,
          user: response.data.user,
          expiresIn: response.data.expiresIn
        };
      }
      
      return { valid: false };
    } catch (error) {
      console.error('Session verification failed:', error);
      return { valid: false };
    }
  }

  /**
   * Send heartbeat to maintain session
   */
  async sendHeartbeat(sessionId, deviceId, location) {
    try {
      if (!location) {
        throw new Error('Location is required for heartbeat');
      }

      const heartbeatData = {
        sessionId: sessionId,
        deviceId: deviceId,
        location: {
          lat: location.lat,
          lon: location.lon,
          accuracy: location.accuracy,
          ts: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      const response = await this.api.post('/api/heartbeat', heartbeatData);
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'Heartbeat failed');
    }
  }

  /**
   * Handle API errors with retry logic
   */
  async handleError(error, defaultMessage = 'API request failed') {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          return {
            ok: false,
            error: data.error || 'Invalid credentials'
          };
        case 403:
          return {
            ok: false,
            error: data.error || 'Access denied'
          };
        case 404:
          return {
            ok: false,
            error: 'Service not found. Please check server configuration.'
          };
        case 500:
          return {
            ok: false,
            error: 'Server error. Please try again later.'
          };
        default:
          return {
            ok: false,
            error: data.error || `Server error (${status})`
          };
      }
    } else if (error.request) {
      // Network error
      return {
        ok: false,
        error: 'Network error. Please check your internet connection.'
      };
    } else {
      // Other error
      return {
        ok: false,
        error: error.message || defaultMessage
      };
    }
  }

  /**
   * Check network connectivity
   */
  async checkConnectivity() {
    try {
      const response = await this.api.get('/api/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update API base URL
   */
  updateBaseURL(newBaseURL) {
    this.baseURL = newBaseURL;
    this.api.defaults.baseURL = newBaseURL;
  }

  /**
   * Set authentication timeout
   */
  setTimeout(timeout) {
    this.timeout = timeout;
    this.api.defaults.timeout = timeout;
  }

  /**
   * Get current API configuration
   */
  getConfig() {
    return {
      baseURL: this.baseURL,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts
    };
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;