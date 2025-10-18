/**
 * Logging Service - Comprehensive logging with file rotation and error tracking
 */
class LoggingService {
  constructor() {
    this.isInitialized = false;
    this.logLevel = 'info'; // debug, info, warn, error
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxFiles = 5;
    this.logBuffer = [];
    this.bufferSize = 100;
    this.flushInterval = 5000; // 5 seconds
    this.flushTimer = null;
  }

  /**
   * Initialize logging service
   */
  init(options = {}) {
    if (this.isInitialized) {
      return;
    }

    this.logLevel = options.level || process.env.REACT_APP_LOG_LEVEL || 'info';
    this.maxLogSize = options.maxSize || this.maxLogSize;
    this.maxFiles = options.maxFiles || this.maxFiles;

    // PRODUCTION MODE: Disable ALL console logs
    this.enableConsoleLogs = false; // Force disable in production
    
    // Disable all console methods in production
    this.disableConsoleInProduction();

    // Start periodic flush (silent in production)
    this.startPeriodicFlush();

    this.isInitialized = true;
    // Silent initialization in production
  }

  /**
   * Disable all console output in production
   */
  disableConsoleInProduction() {
    // Preserve original console for internal use only
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    // Replace ALL console methods with no-ops (silent)
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.error = noop;
    console.debug = noop;
  }

  /**
   * Setup enhanced console logging (DISABLED IN PRODUCTION)
   */
  setupConsoleLogging() {
    // Preserve original console methods
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    // Override console methods to include timestamps and structured logging
    console.log = (...args) => {
      this.logToBuffer('info', args);
      this.originalConsole.log(this.formatMessage('INFO', args));
    };

    console.info = (...args) => {
      this.logToBuffer('info', args);
      this.originalConsole.info(this.formatMessage('INFO', args));
    };

    console.warn = (...args) => {
      this.logToBuffer('warn', args);
      this.originalConsole.warn(this.formatMessage('WARN', args));
    };

    console.error = (...args) => {
      this.logToBuffer('error', args);
      this.originalConsole.error(this.formatMessage('ERROR', args));
    };

    console.debug = (...args) => {
      this.logToBuffer('debug', args);
      if (this.shouldLog('debug')) {
        this.originalConsole.debug(this.formatMessage('DEBUG', args));
      }
    };
  }

  /**
   * Format log message with timestamp and level
   */
  formatMessage(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    return `[${timestamp}] [${level}] ${message}`;
  }

  /**
   * Add log entry to buffer
   */
  logToBuffer(level, args) {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '),
      args: args,
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    this.logBuffer.push(logEntry);

    // Keep buffer size manageable
    if (this.logBuffer.length > this.bufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.bufferSize);
    }

    // Immediate flush for errors
    if (level === 'error') {
      this.flushBuffer();
    }
  }

  /**
   * Check if we should log at this level
   */
  shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Start periodic buffer flush
   */
  startPeriodicFlush() {
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.flushInterval);
  }

  /**
   * Flush log buffer (store logs if needed)
   */
  async flushBuffer() {
    if (this.logBuffer.length === 0) {
      return;
    }

    try {
      // In Electron environment, we could store logs to file
      if (window.electronAPI) {
        await window.electronAPI.storeSet('recentLogs', this.logBuffer);
      }

      // Keep only recent logs in memory
      this.logBuffer = this.logBuffer.slice(-20);
    } catch (error) {
      this.originalConsole.error('Failed to flush log buffer:', error);
    }
  }

  /**
   * Public logging methods
   */
  debug(...args) {
    this.logToBuffer('debug', args);
    if (this.shouldLog('debug')) {
      this.originalConsole.debug(this.formatMessage('DEBUG', args));
    }
  }

  info(...args) {
    this.logToBuffer('info', args);
    if (this.enableConsoleLogs && this.originalConsole) {
      this.originalConsole.info(this.formatMessage('INFO', args));
    }
  }

  warn(...args) {
    this.logToBuffer('warn', args);
    if (this.enableConsoleLogs && this.originalConsole) {
      this.originalConsole.warn(this.formatMessage('WARN', args));
    }
  }

  error(...args) {
    this.logToBuffer('error', args);
    if (this.enableConsoleLogs && this.originalConsole) {
      this.originalConsole.error(this.formatMessage('ERROR', args));
    }
  }

  /**
   * Log API calls
   */
  logApiCall(method, url, data, response) {
    const logData = {
      type: 'API_CALL',
      method: method.toUpperCase(),
      url: url,
      requestData: data ? { ...data, password: data.password ? '***' : undefined } : undefined,
      responseStatus: response?.status,
      responseData: response?.data,
      timestamp: new Date().toISOString()
    };

    this.info('API Call:', logData);
  }

  /**
   * Log user actions
   */
  logUserAction(action, details = {}) {
    const logData = {
      type: 'USER_ACTION',
      action: action,
      details: details,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    this.info('User Action:', logData);
  }

  /**
   * Log performance metrics
   */
  logPerformance(metric, value, unit = 'ms') {
    const logData = {
      type: 'PERFORMANCE',
      metric: metric,
      value: value,
      unit: unit,
      timestamp: new Date().toISOString()
    };

    this.debug('Performance:', logData);
  }

  /**
   * Log system events
   */
  logSystemEvent(event, details = {}) {
    const logData = {
      type: 'SYSTEM_EVENT',
      event: event,
      details: details,
      timestamp: new Date().toISOString()
    };

    this.info('System Event:', logData);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count = 50) {
    return this.logBuffer.slice(-count);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level) {
    return this.logBuffer.filter(log => log.level === level.toUpperCase());
  }

  /**
   * Export logs for debugging
   */
  exportLogs() {
    const logs = {
      exportTime: new Date().toISOString(),
      logLevel: this.logLevel,
      bufferSize: this.logBuffer.length,
      logs: this.logBuffer,
      systemInfo: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        platform: window.electronAPI?.platform || 'unknown',
        appVersion: process.env.REACT_APP_VERSION || '1.0.0'
      }
    };

    return JSON.stringify(logs, null, 2);
  }

  /**
   * Set log level
   */
  setLogLevel(level) {
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      this.logLevel = level;
      this.info(`Log level changed to: ${level}`);
    } else {
      this.warn('Invalid log level:', level);
    }
  }

  /**
   * Cleanup logging service
   */
  cleanup() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Restore original console methods
    if (this.originalConsole) {
      console.log = this.originalConsole.log;
      console.info = this.originalConsole.info;
      console.warn = this.originalConsole.warn;
      console.error = this.originalConsole.error;
      console.debug = this.originalConsole.debug;
    }

    // Final flush
    this.flushBuffer();

    this.isInitialized = false;
  }
}

// Export singleton instance
const loggingService = new LoggingService();
export default loggingService;