import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('STRIPE_SECRET_KEY not set - Stripe features will not work');
}

/**
 * Get Stripe client instance
 */
export function getStripeClient(): Stripe {
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: '2024-11-20.acacia',
  });
}

/**
 * Create a Stripe Connect Express account
 * Returns the account ID
 */
export async function createConnectAccount(userId: string, email: string): Promise<string> {
  const stripe = getStripeClient();

  const account = await stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      user_id: userId,
    },
  });

  return account.id;
}

/**
 * Create an Account Link for Stripe Connect onboarding
 * Returns the URL to redirect the user to
 */
export async function createAccountLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  const stripe = getStripeClient();

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });

  return accountLink.url;
}

/**
 * Create or retrieve a Stripe Customer
 */
export async function createOrGetCustomer(
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<string> {
  const stripe = getStripeClient();

  // Search for existing customer by email
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: metadata || {},
  });

  return customer.id;
}

/**
 * Create a SetupIntent to save a card without charging
 */
export async function createSetupIntent(
  customerId: string,
  metadata?: Record<string, string>
): Promise<{ setupIntentId: string; clientSecret: string }> {
  const stripe = getStripeClient();

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    metadata: metadata || {},
  });

  return {
    setupIntentId: setupIntent.id,
    clientSecret: setupIntent.client_secret!,
  };
}

/**
 * Create a subscription for the business owner ($11.99/mo)
 * Includes 7-day trial period as per app design
 */
export async function createSubscription(
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>,
  paymentMethodId?: string // Optional: if owner already has payment method ready
): Promise<{ subscriptionId: string; status: string; current_period_end?: number; trial_end?: number }> {
  const stripe = getStripeClient();

  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price: priceId }],
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: metadata || {},
    // 7-day trial period as per app design
    trial_period_days: 7,
  };

  // If payment method is provided, attach it; otherwise subscription will be incomplete
  if (paymentMethodId) {
    subscriptionParams.default_payment_method = paymentMethodId;
    subscriptionParams.payment_behavior = 'default_incomplete';
  } else {
    // Subscription will be incomplete until payment method is added
    subscriptionParams.payment_behavior = 'default_incomplete';
  }

  const subscription = await stripe.subscriptions.create(subscriptionParams);

  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    current_period_end: subscription.current_period_end,
    trial_end: subscription.trial_end,
  };
}

/**
 * Create a PaymentIntent with Connect destination charge
 * This charges the customer and sends funds to the connected account
 * Supports off-session charges for saved payment methods
 * 
 * Returns the PaymentIntent with status information
 */
export async function createPaymentIntent(params: {
  amount: number; // in cents
  customerId: string;
  paymentMethodId: string;
  connectAccountId: string;
  applicationFee: number; // platform fee in cents (1% of amount)
  metadata?: Record<string, string>;
  offSession?: boolean; // If true, attempts off-session charge (for saved cards)
}): Promise<{ 
  paymentIntentId: string; 
  clientSecret: string;
  status: string;
  requiresAction?: boolean;
}> {
  const stripe = getStripeClient();
  const { amount, customerId, paymentMethodId, connectAccountId, applicationFee, metadata, offSession = false } = params;

  // Create PaymentIntent on platform account with Connect destination
  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount,
    currency: 'usd',
    customer: customerId,
    payment_method: paymentMethodId,
    on_behalf_of: connectAccountId,
    transfer_data: {
      destination: connectAccountId,
    },
    application_fee_amount: applicationFee,
    metadata: metadata || {},
  };

  // For off-session charges, set confirmation method and off_session flag
  if (offSession) {
    paymentIntentParams.confirmation_method = 'automatic';
    paymentIntentParams.confirm = true;
    paymentIntentParams.off_session = true;
    paymentIntentParams.payment_method_options = {
      card: {
        request_three_d_secure: 'automatic',
      },
    };
  } else {
    paymentIntentParams.confirmation_method = 'manual';
    paymentIntentParams.confirm = true;
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret || '',
    status: paymentIntent.status,
    requiresAction: paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_payment_method',
  };
}

/**
 * Create a refund for a PaymentIntent
 */
export async function createRefund(
  paymentIntentId: string,
  amount?: number // optional amount to refund (partial refund), if not provided, full refund
): Promise<{ refundId: string; amount: number }> {
  const stripe = getStripeClient();

  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: paymentIntentId,
  };

  if (amount !== undefined) {
    refundParams.amount = amount;
  }

  const refund = await stripe.refunds.create(refundParams);

  return {
    refundId: refund.id,
    amount: refund.amount,
  };
}

/**
 * Get payment method from a SetupIntent
 */
export async function getPaymentMethodFromSetupIntent(
  setupIntentId: string
): Promise<string | null> {
  const stripe = getStripeClient();

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

  if (typeof setupIntent.payment_method === 'string') {
    return setupIntent.payment_method;
  }

  if (setupIntent.payment_method) {
    return setupIntent.payment_method.id;
  }

  return null;
}

/**
 * Verify a Connect account is active
 */
export async function verifyConnectAccount(accountId: string): Promise<boolean> {
  try {
    const stripe = getStripeClient();
    const account = await stripe.accounts.retrieve(accountId);

    return account.details_submitted && account.charges_enabled;
  } catch (error) {
    console.error('Error verifying Connect account:', error);
    return false;
  }
}

