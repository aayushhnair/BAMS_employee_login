/**
 * Application Constants
 * Centralized configuration from environment variables
 */

// Debug: Log environment variable
console.log('🔍 Environment Variable REACT_APP_HEARTBEAT_INTERVAL:', process.env.REACT_APP_HEARTBEAT_INTERVAL);

// Get heartbeat interval from environment variable (in milliseconds)
// Default to 30 minutes (1800000ms) if not set
export const HEARTBEAT_INTERVAL_MS = parseInt(
  process.env.REACT_APP_HEARTBEAT_INTERVAL || '1800000',
  10
);

console.log('✅ HEARTBEAT_INTERVAL_MS:', HEARTBEAT_INTERVAL_MS, 'ms');
console.log('✅ HEARTBEAT_INTERVAL_SECONDS:', Math.floor(HEARTBEAT_INTERVAL_MS / 1000), 'seconds');
console.log('✅ HEARTBEAT_INTERVAL_MINUTES:', Math.floor(HEARTBEAT_INTERVAL_MS / 60000), 'minutes');

// Convert to seconds for display
export const HEARTBEAT_INTERVAL_SECONDS = Math.floor(HEARTBEAT_INTERVAL_MS / 1000);

// Convert to minutes for display
export const HEARTBEAT_INTERVAL_MINUTES = Math.floor(HEARTBEAT_INTERVAL_MS / 60000);

// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';
export const API_TIMEOUT = parseInt(process.env.REACT_APP_API_TIMEOUT || '10000', 10);

// Location Configuration
export const LOCATION_TIMEOUT = parseInt(process.env.REACT_APP_LOCATION_TIMEOUT || '15000', 10);
export const LOCATION_HIGH_ACCURACY = process.env.REACT_APP_LOCATION_HIGH_ACCURACY === 'true';

// App Info
export const APP_NAME = process.env.REACT_APP_APP_NAME || 'BAMS Employee Client';
export const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';
export const COMPANY_NAME = process.env.REACT_APP_COMPANY_NAME || 'Bhishma Solutions';
