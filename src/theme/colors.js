/**
 * WorkSens Brand Colors
 * Centralized theme color palette for consistent UI
 */

export const colors = {
  // Primary Brand Colors
  deepNavy: '#0A192F',
  platinumGray: '#E6E8EB',
  accentCyan: '#2BB3F3',
  mutedSilver: '#B0B8C1',

  // Semantic Colors (mapped to brand palette)
  primary: '#2BB3F3',       // Accent Cyan - Primary actions
  secondary: '#0A192F',     // Deep Navy - Secondary elements
  background: '#E6E8EB',    // Platinum Gray - Backgrounds
  text: '#0A192F',          // Deep Navy - Primary text
  textMuted: '#B0B8C1',     // Muted Silver - Secondary text
  
  // UI States
  success: '#10B981',       // Keep green for success states
  warning: '#2BB3F3',       // Use cyan instead of yellow/orange
  error: '#EF4444',         // Keep red only for critical errors (use sparingly)
  info: '#2BB3F3',          // Cyan for info states
  
  // Additional Shades
  deepNavyLight: '#112240',
  deepNavyDark: '#020C1B',
  cyanLight: '#5EC4F7',
  cyanDark: '#1A9AD6',
  silverLight: '#D1D5DB',
  silverDark: '#9CA3AF',
  
  // Transparent variants
  cyanAlpha10: 'rgba(43, 179, 243, 0.1)',
  cyanAlpha20: 'rgba(43, 179, 243, 0.2)',
  cyanAlpha30: 'rgba(43, 179, 243, 0.3)',
  navyAlpha10: 'rgba(10, 25, 47, 0.1)',
  navyAlpha20: 'rgba(10, 25, 47, 0.2)',
  navyAlpha80: 'rgba(10, 25, 47, 0.8)',
  
  // White/Black
  white: '#FFFFFF',
  black: '#000000',
};

// Export individual colors for convenience
export const {
  deepNavy,
  platinumGray,
  accentCyan,
  mutedSilver,
  primary,
  secondary,
  background,
  text,
  textMuted,
  success,
  warning,
  error,
  info,
} = colors;

export default colors;
