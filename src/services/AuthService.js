import axios from 'axios';
import LoggingService from './LoggingService';

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
        LoggingService.info(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          data: config.data ? { ...config.data, password: '***' } : undefined
        });
        return config;
      },
      (error) => {
        LoggingService.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging AND login_status checking
    this.api.interceptors.response.use(
      (response) => {
        LoggingService.info(`API Response: ${response.status}`, response.data);
        
        // CRITICAL: Check login_status in EVERY response
        if (response.data && response.data.login_status === false) {
          LoggingService.error('🚨 CRITICAL: API returned login_status:false - Session invalidated by server!');
          
          // Trigger global logout event
          const logoutEvent = new CustomEvent('forceLogout', {
            detail: {
              reason: response.data.message || response.data.error || 'Session invalidated by server',
              source: 'api_interceptor',
              endpoint: response.config.url
            }
          });
          window.dispatchEvent(logoutEvent);
          
          // Still return response to allow normal error handling
          return response;
        }
        
        // Only force logout for explicit server signals
        try {
          const resp = response.data || {};
          if (resp.login_status === false || resp.force_logout === true) {
            const logoutEvent = new CustomEvent('forceLogout', {
              detail: {
                reason: resp.message || resp.error || 'Session invalidated by server',
                source: 'api_response_force',
                endpoint: response.config.url
              }
            });
            window.dispatchEvent(logoutEvent);
          }
        } catch (e) {}

        return response;
      },
      (error) => {
        LoggingService.error('API Response Error:', error.response?.data || error.message);
        
        // CRITICAL: Check login_status even in error responses
        if (error.response?.data?.login_status === false) {
          LoggingService.error('🚨 CRITICAL: Error response has login_status:false - Session invalidated!');
          
          // Trigger global logout event
          const logoutEvent = new CustomEvent('forceLogout', {
            detail: {
              reason: error.response.data.message || error.response.data.error || 'Session invalidated by server',
              source: 'api_interceptor_error',
              endpoint: error.config?.url
            }
          });
          window.dispatchEvent(logoutEvent);
        }
        
        // Only trigger logout for explicit auth-related statuses or server signal
        try {
          const status = error.response?.status;
          const data = error.response?.data || {};

          const shouldForceLogout = (
            data && (data.login_status === false || data.force_logout === true)
          ) || [401, 403, 419, 440].includes(status);

          if (shouldForceLogout) {
            const logoutEvent = new CustomEvent('forceLogout', {
              detail: {
                reason: (data && (data.message || data.error)) || error.message || 'Authentication error',
                source: 'api_interceptor_error_force',
                endpoint: error.config?.url
              }
            });
            window.dispatchEvent(logoutEvent);
          }
        } catch (e) {}

        return Promise.reject(error);
      }
    );

    // Convenience: try to extend or revalidate an existing session
    this.extendSession = async (sessionId) => {
      // Servers may implement a dedicated extend endpoint; fallback to verifySession
      try {
        const resp = await this.verifySession(sessionId);
        return { ok: resp.valid === true, data: resp };
      } catch (e) {
        return { ok: false, error: 'Failed to extend session' };
      }
    };
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
      // Expected errors during auto-logout (session already invalid)
      const status = error.response?.status;
      if (status === 401 || status === 400) {
        // Session already invalid on server - this is expected during forced logout
        console.log('Logout: Session already invalidated on server (expected)');
        return { ok: true, alreadyInvalidated: true };
      }
      
      // Unexpected errors
      console.warn('Logout request failed (continuing with local cleanup):', error.message);
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

      // Preserve server-provided body if it matches our schema
      if (data && typeof data === 'object' && ('ok' in data || 'error' in data)) {
        return data;
      }

      switch (status) {
        case 401:
          return {
            ok: false,
            error: (data && data.error) || 'Invalid credentials'
          };
        case 403:
          return {
            ok: false,
            error: (data && data.error) || 'Access denied'
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
            error: (data && data.error) || `Server error (${status})`
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