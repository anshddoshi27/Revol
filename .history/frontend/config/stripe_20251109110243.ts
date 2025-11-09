export const stripeConfig = {
  publishableKey: "pk_test_placeholder",
  connectClientId: "ca_placeholder",
  currency: "usd",
  platformFeePercent: 1
};

export type StripeConfig = typeof stripeConfig;

export function getStripePlaceholderMessage() {
  return "Stripe integration pending — configure keys once backend is ready.";
}

