import { stripeConfig } from "@/config/stripe";

export const getStripePublishableKey = () => stripeConfig.publishableKey;

export const getPlatformFeePercentage = () =>
  stripeConfig.platformFeeBps / 10000;

export const isManualCaptureEnabled = () => stripeConfig.manualCapture;

