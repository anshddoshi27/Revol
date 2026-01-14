export const stripeConfig = {
  publishableKey:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_placeholder",
  manualCapture: true,
  platformFeeBps: 100, // 1%
  supportedPaymentMethods: ["card"] as const,
};

export type StripeConfig = typeof stripeConfig;

