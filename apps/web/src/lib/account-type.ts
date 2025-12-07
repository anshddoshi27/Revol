/**
 * Account type utilities
 * 
 * Determines account type based on notifications_enabled flag:
 * - Basic Plan: notifications_enabled = false ($11.99/month)
 * - Pro Plan: notifications_enabled = true ($21.99/month)
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
  const isPro = notificationsEnabled === true;
  
  return {
    type: isPro ? 'pro' : 'basic',
    name: isPro ? 'Pro Plan' : 'Basic Plan',
    price: isPro ? 21.99 : 11.99,
    notificationsEnabled: isPro,
    features: {
      smsNotifications: isPro,
      emailNotifications: isPro,
      notificationTemplates: isPro,
      automatedReminders: isPro,
    },
  };
}

/**
 * Check if account has notifications feature enabled
 */
export function hasNotificationsFeature(notificationsEnabled: boolean | null | undefined): boolean {
  return notificationsEnabled === true;
}

/**
 * Get subscription price ID environment variable name based on account type
 */
export function getPriceIdEnvVar(notificationsEnabled: boolean | null | undefined): string {
  return notificationsEnabled === true
    ? 'STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS'
    : 'STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS';
}


