/**
 * Subscription utility functions
 */

/**
 * Get subscription plan name based on notifications_enabled flag
 * @param notificationsEnabled - Whether notifications are enabled
 * @returns Plan name: "Basic" or "Pro"
 */
export function getSubscriptionPlanName(notificationsEnabled: boolean | null | undefined): "Basic" | "Pro" {
  return notificationsEnabled === true ? "Pro" : "Basic";
}

/**
 * Get subscription plan price based on notifications_enabled flag
 * @param notificationsEnabled - Whether notifications are enabled
 * @returns Plan price in dollars: 11.99 for Basic, 21.99 for Pro
 */
export function getSubscriptionPlanPrice(notificationsEnabled: boolean | null | undefined): number {
  return notificationsEnabled === true ? 21.99 : 11.99;
}

/**
 * Get subscription plan display string
 * @param notificationsEnabled - Whether notifications are enabled
 * @returns Display string like "Pro Plan - $21.99/month" or "Basic Plan - $11.99/month"
 */
export function getSubscriptionPlanDisplay(notificationsEnabled: boolean | null | undefined): string {
  const planName = getSubscriptionPlanName(notificationsEnabled);
  const price = getSubscriptionPlanPrice(notificationsEnabled);
  return `${planName} Plan - $${price.toFixed(2)}/month`;
}


