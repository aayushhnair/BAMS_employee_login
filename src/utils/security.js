import DOMPurify from 'dompurify';

/**
 * Sanitizes user input to prevent XSS attacks
 * @param {string} input - The user input to sanitize
 * @returns {string} - Sanitized input
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') {
    return '';
  }
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [] 
  }).trim();
};

/**
 * Validates username format
 * @param {string} username - Username to validate
 * @returns {object} - { isValid: boolean, error: string }
 */
export const validateUsername = (username) => {
  const sanitized = sanitizeInput(username);
  
  if (!sanitized || sanitized.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }
  
  if (sanitized.length > 50) {
    return { isValid: false, error: 'Username must not exceed 50 characters' };
  }
  
  // Allow alphanumeric, underscore, hyphen, dot, and @ for email format
  const usernameRegex = /^[a-zA-Z0-9._@-]+$/;
  if (!usernameRegex.test(sanitized)) {
    return { isValid: false, error: 'Username contains invalid characters' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validates password format
 * @param {string} password - Password to validate
 * @returns {object} - { isValid: boolean, error: string }
 */
export const validatePassword = (password) => {
  if (typeof password !== 'string') {
    return { isValid: false, error: 'Invalid password format' };
  }
  
  if (password.length < 4) {
    return { isValid: false, error: 'Password must be at least 4 characters' };
  }
  
  if (password.length > 100) {
    return { isValid: false, error: 'Password must not exceed 100 characters' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validates session token format
 * @param {string} token - Session token to validate
 * @returns {boolean} - True if valid format
 */
export const validateSessionToken = (token) => {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Session tokens should be UUIDs or similar secure random strings
  // Adjust regex based on your actual token format
  const tokenRegex = /^[a-zA-Z0-9-_]{20,}$/;
  return tokenRegex.test(token);
};

/**
 * Rate limiting helper - tracks login attempts
 * Simple client-side implementation (server-side is critical for security)
 */
class RateLimiter {
  constructor() {
    this.attempts = [];
    this.maxAttempts = 5;
    this.windowMs = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Check if action is allowed
   * @param {string} action - Action identifier (e.g., 'login')
   * @returns {object} - { allowed: boolean, remainingAttempts: number, resetTime: Date }
   */
  checkLimit(action = 'login') {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Remove old attempts
    this.attempts = this.attempts.filter(attempt => 
      attempt.timestamp > windowStart && attempt.action === action
    );
    
    const remainingAttempts = this.maxAttempts - this.attempts.length;
    
    if (this.attempts.length >= this.maxAttempts) {
      const oldestAttempt = this.attempts[0];
      const resetTime = new Date(oldestAttempt.timestamp + this.windowMs);
      
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime
      };
    }
    
    return {
      allowed: true,
      remainingAttempts,
      resetTime: null
    };
  }

  /**
   * Record an attempt
   * @param {string} action - Action identifier
   */
  recordAttempt(action = 'login') {
    this.attempts.push({
      action,
      timestamp: Date.now()
    });
  }

  /**
   * Reset attempts for an action
   * @param {string} action - Action identifier
   */
  reset(action = 'login') {
    this.attempts = this.attempts.filter(attempt => attempt.action !== action);
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Escapes HTML entities to prevent XSS in text content
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
export const escapeHtml = (str) => {
  if (typeof str !== 'string') return '';
  
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };
  
  return str.replace(/[&<>"'\/]/g, char => htmlEntities[char]);
};

/**
 * Generates a secure random string for CSRF tokens or similar
 * @param {number} length - Length of the random string
 * @returns {string} - Random string
 */
export const generateSecureToken = (length = 32) => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};
