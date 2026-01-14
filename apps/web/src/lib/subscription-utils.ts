/**
 * Subscription utility functions
 */

/**
 * Get subscription plan name based on notifications_enabled flag
 * @param notificationsEnabled - Whether notifications are enabled
 * @returns Plan name: "Basic" (only available plan, has notifications) or "Pro" (coming soon)
 */
export function getSubscriptionPlanName(notificationsEnabled: boolean | null | undefined): "Basic" | "Pro" {
  // Basic Plan is the only available plan and it has notifications enabled
  return "Basic";
}

/**
 * Get subscription plan price based on notifications_enabled flag
 * @param notificationsEnabled - Whether notifications are enabled
 * @returns Plan price in dollars: 14.99 for Basic (with notifications), Pro is coming soon
 */
export function getSubscriptionPlanPrice(notificationsEnabled: boolean | null | undefined): number {
  // Basic Plan now has notifications enabled and costs $14.99/month
  // Pro Plan is coming soon (disabled)
  return 14.99;
}

/**
 * Get subscription plan display string
 * @param notificationsEnabled - Whether notifications are enabled
 * @returns Display string like "Basic Plan - $14.99/month"
 */
export function getSubscriptionPlanDisplay(notificationsEnabled: boolean | null | undefined): string {
  const planName = getSubscriptionPlanName(notificationsEnabled);
  const price = getSubscriptionPlanPrice(notificationsEnabled);
  return `${planName} Plan - $${price.toFixed(2)}/month`;
}


