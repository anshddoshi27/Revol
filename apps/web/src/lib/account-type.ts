/**
 * Account type utilities
 * 
 * Determines account type based on notifications_enabled flag:
 * - Basic Plan: notifications_enabled = true ($14.99/month) - only available plan
 * - Pro Plan: coming soon (disabled)
 */

export type AccountType = 'basic' | 'pro';

export interface AccountPlan {
  type: AccountType;
  name: string;
  price: number;
  notificationsEnabled: boolean;
  features: {
    smsNotifications: boolean;
    emailNotifications: boolean;
    notificationTemplates: boolean;
    automatedReminders: boolean;
  };
}

/**
 * Get account plan details based on notifications_enabled flag
 */
export function getAccountPlan(notificationsEnabled: boolean | null | undefined): AccountPlan {
  // Basic Plan is the only available plan and it has notifications enabled
  // Basic Plan = notifications_enabled = true
  
  return {
    type: 'basic',
    name: 'Basic Plan',
    price: 14.99,
    notificationsEnabled: true,
    features: {
      smsNotifications: false, // SMS not available in v1
      emailNotifications: true,
      notificationTemplates: true,
      automatedReminders: true,
    },
  };
}

/**
 * Check if account has notifications feature enabled
 * Basic Plan now has notifications enabled, so this should always return true
 */
export function hasNotificationsFeature(notificationsEnabled: boolean | null | undefined): boolean {
  // Basic Plan has notifications enabled, so return true
  return true;
}

/**
 * Get subscription price ID environment variable name based on account type
 * Basic Plan (only available plan) uses the with_notifications price ID
 */
export function getPriceIdEnvVar(notificationsEnabled: boolean | null | undefined): string {
  // Basic Plan now has notifications, so use WITH_NOTIFICATIONS price ID
  return 'STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS';
}


