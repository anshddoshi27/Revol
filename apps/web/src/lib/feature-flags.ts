/**
 * Feature Flags Configuration
 * 
 * Use this file to enable/disable features for different versions.
 * Set flags to false to disable features while keeping code intact for easy re-enable.
 * 
 * To re-enable a feature later, simply change the flag to true.
 */

/**
 * Feature: Notifications (SMS & Email)
 * 
 * When disabled:
 * - Notifications step is skipped in onboarding
 * - Notifications page is hidden in admin
 * - Pro Plan selection is disabled (shows "Coming Soon")
 * - All businesses default to Basic Plan
 * 
 * When enabled:
 * - Full notifications functionality available
 * - Pro Plan ($21.99/month) and Basic Plan ($13.99/month) available
 * - Users can configure email/SMS templates
 */
export const FEATURES = {
  /**
   * Enable/disable notifications feature (SMS & Email)
   * Set to false to disable for v2, true to enable
   */
  NOTIFICATIONS_ENABLED: true, // v1: Enabled
  
  /**
   * Show "Coming Soon" message for Pro Plan
   * When true, shows a "Coming Soon" message instead of allowing Pro Plan selection
   */
  NOTIFICATIONS_COMING_SOON: false, // v1: Not coming soon, fully enabled
} as const;

/**
 * Helper to check if notifications are enabled
 */
export function isNotificationsEnabled(): boolean {
  return FEATURES.NOTIFICATIONS_ENABLED === true;
}

/**
 * Helper to check if notifications should show "coming soon"
 */
export function isNotificationsComingSoon(): boolean {
  return FEATURES.NOTIFICATIONS_COMING_SOON === true;
}

/**
 * Get the effective notifications enabled state
 * If coming soon is enabled, always return false (disabled)
 */
export function getEffectiveNotificationsEnabled(): boolean {
  if (FEATURES.NOTIFICATIONS_COMING_SOON) {
    return false; // Coming soon means disabled
  }
  return FEATURES.NOTIFICATIONS_ENABLED;
}

