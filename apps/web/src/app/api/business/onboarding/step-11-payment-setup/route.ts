import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import {
  createConnectAccount,
  createAccountLink,
  verifyConnectAccount,
  createOrGetCustomer,
  createSubscription,
} from '@/lib/stripe';

/**
 * POST /api/business/onboarding/step-11-payment-setup
 * 
 * Sets up Stripe Connect account and subscription
 * 
 * Body: {
 *   connectAccountId?: string,  // If returning from Stripe onboarding
 *   email: string,
 *   returnUrl?: string,
 *   refreshUrl?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business not found. Complete step 1 first.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { connectAccountId, email, returnUrl, refreshUrl } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get business info including notifications_enabled
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, stripe_connect_account_id, stripe_customer_id, stripe_subscription_id, notifications_enabled')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    let accountId = business.stripe_connect_account_id || connectAccountId;

    // If account ID provided (returning from Stripe), verify it
    if (connectAccountId) {
      const isValid = await verifyConnectAccount(connectAccountId);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Stripe Connect account verification failed. Please complete onboarding.' },
          { status: 400 }
        );
      }
      accountId = connectAccountId;

      // Save the verified account ID
      await supabase
        .from('businesses')
        .update({
          stripe_connect_account_id: accountId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessId);
    }

    // If no account ID yet, create one and get Account Link
    if (!accountId) {
      accountId = await createConnectAccount(userId, email);

      // Save the account ID (will be verified after onboarding completes)
      await supabase
        .from('businesses')
        .update({
          stripe_connect_account_id: accountId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessId);

      // Create Account Link for onboarding
      const defaultReturnUrl = returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding/payment-setup`;
      const defaultRefreshUrl = refreshUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding/payment-setup`;

      const accountLinkUrl = await createAccountLink(accountId, defaultReturnUrl, defaultRefreshUrl);

      return NextResponse.json({
        success: true,
        accountLinkUrl,
        connectAccountId: accountId,
        message: 'Please complete Stripe Connect onboarding',
      });
    }

    // Verify account is ready
    const isVerified = await verifyConnectAccount(accountId);
    if (!isVerified) {
      const defaultReturnUrl = returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding/payment-setup`;
      const defaultRefreshUrl = refreshUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding/payment-setup`;

      const accountLinkUrl = await createAccountLink(accountId, defaultReturnUrl, defaultRefreshUrl);

      return NextResponse.json({
        success: false,
        accountLinkUrl,
        connectAccountId: accountId,
        message: 'Please complete Stripe Connect onboarding',
      });
    }

    // Create or get Stripe Customer for subscription
    let customerId = business.stripe_customer_id;
    if (!customerId) {
      customerId = await createOrGetCustomer(email, business.name || 'Business Owner', {
        business_id: businessId,
        user_id: userId,
      });

      await supabase
        .from('businesses')
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessId);
    }

    // Create subscription if not exists
    // Note: Subscription will be in 'incomplete' or 'trialing' state until owner adds payment method
    // The frontend should handle collecting payment method for the subscription
    let subscriptionId = business.stripe_subscription_id;
    
    // Select the correct Stripe price ID based on notifications_enabled
    // Larger value = with SMS/email notifications, smaller value = without
    const notificationsEnabled = business.notifications_enabled !== false; // Default to true if null
    const priceIdWithNotifications = process.env.STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS || process.env.NEXT_PUBLIC_STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS;
    const priceIdWithoutNotifications = process.env.STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS || process.env.NEXT_PUBLIC_STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS;
    
    // Fallback to single price ID if separate ones not configured
    const fallbackPriceId = process.env.STRIPE_PLAN_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_PLAN_PRICE_ID;
    
    const stripePriceId = notificationsEnabled 
      ? (priceIdWithNotifications || fallbackPriceId)
      : (priceIdWithoutNotifications || fallbackPriceId);

    if (!subscriptionId && stripePriceId) {
      try {
        // Add metadata to subscription so webhooks can find the business
        // Note: paymentMethodId can be passed if owner already provided it in the request
        const bodyPaymentMethodId = body.paymentMethodId;
        const subscription = await createSubscription(
          customerId,
          stripePriceId,
          {
            business_id: businessId,
            user_id: userId,
          },
          bodyPaymentMethodId
        );

        subscriptionId = subscription.subscriptionId;

        // Calculate next_bill_at from current_period_end (or trial_end if in trial)
        // For trial, next_bill_at is when trial ends
        const nextBillAt = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        // Determine subscription status
        // 'trialing' = trial, 'active' = active, 'incomplete' = needs payment method
        let subscriptionStatus = 'trial';
        if (subscription.status === 'active') {
          subscriptionStatus = 'active';
        } else if (subscription.status === 'trialing') {
          subscriptionStatus = 'trial';
        } else if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
          subscriptionStatus = 'trial'; // Treat incomplete as trial until payment method added
        }

        await supabase
          .from('businesses')
          .update({
            stripe_subscription_id: subscriptionId,
            stripe_price_id: stripePriceId,
            subscription_status: subscriptionStatus,
            trial_ends_at: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            next_bill_at: nextBillAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', businessId);
      } catch (subscriptionError) {
        console.error('Error creating subscription:', subscriptionError);
        // Continue - subscription can be created later
      }
    }

    return NextResponse.json({
      success: true,
      connectAccountId: accountId,
      subscriptionId: subscriptionId || null,
      message: 'Payment setup completed successfully',
    });
  } catch (error) {
    console.error('Error in step-11-payment-setup:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


