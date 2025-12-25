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
 * GET /api/business/onboarding/step-11-payment-setup
 * 
 * Retrieves payment setup configuration
 */
export async function GET(request: Request) {
  console.log('[step-11-payment-setup] API called - GET /api/business/onboarding/step-11-payment-setup');
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
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    const supabase = await createServerClient();
    const { data: business, error } = await supabase
      .from('businesses')
      .select('stripe_connect_account_id, stripe_subscription_id, subscription_status, trial_ends_at, next_bill_at, notifications_enabled')
      .eq('id', businessId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[step-11-payment-setup] Error fetching business:', error);
      return NextResponse.json(
        { error: 'Failed to fetch payment setup data' },
        { status: 500 }
      );
    }

    if (!business) {
      return NextResponse.json(
        { paymentSetup: null },
        { status: 200 }
      );
    }

    // Determine connect status
    let connectStatus: "not_started" | "in_progress" | "completed" = "not_started";
    if (business.stripe_connect_account_id) {
      // Check if account is fully onboarded by verifying with Stripe
      try {
        const { verifyConnectAccount } = await import('@/lib/stripe');
        const isValid = await verifyConnectAccount(business.stripe_connect_account_id);
        connectStatus = isValid ? "completed" : "in_progress";
      } catch {
        connectStatus = "in_progress";
      }
    }

    // Get accepted payment methods from payment_methods table if it exists
    let acceptedMethods: string[] = ['card']; // Default
    try {
      const { data: paymentMethods } = await supabase
        .from('payment_methods')
        .select('method')
        .eq('business_id', businessId)
        .eq('enabled', true);
      
      if (paymentMethods && paymentMethods.length > 0) {
        acceptedMethods = paymentMethods.map(pm => pm.method);
      }
    } catch (error) {
      // payment_methods table might not exist, use default
      console.log('[step-11-payment-setup] Could not fetch payment methods, using default');
    }

    // Get subscription status
    const subscriptionStatus = (business.subscription_status as "trial" | "active" | "paused" | "canceled") || "trial";

    // Get payment method ID from Stripe subscription if available
    let paymentMethodId: string | undefined;
    if (business.stripe_subscription_id) {
      try {
        const stripe = await import('stripe').then(m => new m.default(process.env.STRIPE_SECRET_KEY!));
        const subscription = await stripe.subscriptions.retrieve(business.stripe_subscription_id);
        if (subscription.default_payment_method) {
          const pm = typeof subscription.default_payment_method === 'string' 
            ? subscription.default_payment_method 
            : subscription.default_payment_method.id;
          paymentMethodId = pm;
        }
      } catch (error) {
        console.error('[step-11-payment-setup] Error fetching payment method from Stripe:', error);
      }
    }

    const paymentSetup = {
      connectStatus,
      acceptedMethods,
      subscriptionStatus,
      trialEndsAt: business.trial_ends_at || undefined,
      nextBillDate: business.next_bill_at || undefined,
      paymentMethodId,
    };

    return NextResponse.json({
      paymentSetup
    });
  } catch (error) {
    console.error('[step-11-payment-setup] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/business/onboarding/step-11-payment-setup
 * PUT /api/business/onboarding/step-11-payment-setup
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
  return handlePaymentSetup(request);
}

export async function PUT(request: Request) {
  return handlePaymentSetup(request);
}

async function handlePaymentSetup(request: Request) {
  console.log('[step-11-payment-setup] API called');
  try {
    // Try to get user ID - with better error handling
    let userId = await getCurrentUserId();
    
    // If getCurrentUserId fails, try to get it from Supabase client directly
    if (!userId) {
      console.log('[step-11-payment-setup] getCurrentUserId returned null, trying direct Supabase client...');
      try {
        const supabase = await createServerClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (user && !userError) {
          userId = user.id;
          console.log('[step-11-payment-setup] Got user ID from direct Supabase client:', userId);
        } else {
          console.error('[step-11-payment-setup] Direct Supabase client also failed:', userError);
        }
      } catch (error) {
        console.error('[step-11-payment-setup] Error getting user from Supabase client:', error);
      }
    }
    
    if (!userId) {
      console.error('[step-11-payment-setup] No user ID found - unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in again' },
        { status: 401 }
      );
    }
    console.log('[step-11-payment-setup] User authenticated:', userId);

    // Parse request body first (we need it to potentially create business)
    const body = await request.json();
    console.log('[step-11-payment-setup] Request body:', JSON.stringify(body, null, 2));
    
    let businessId = await getCurrentBusinessId();
    
    // If no business exists, try to create one from the request body
    // This handles cases where step 1 wasn't completed or the business was deleted
    if (!businessId) {
      console.log('[step-11-payment-setup] No business found, checking if we can create one from request body');
      
      // Check if we have business data in the request
      if (body.businessName || body.business?.businessName) {
        const businessName = body.businessName || body.business?.businessName || 'My Business';
        const industry = body.industry || body.business?.industry || 'other';
        
        console.log('[step-11-payment-setup] Creating business from request data:', { businessName, industry });
        
        const { createAdminClient } = await import('@/lib/db');
        const adminSupabase = createAdminClient();
        
        // First, ensure user exists in public.users table if it exists
        // This handles the case where foreign key references public.users instead of auth.users
        try {
          const { data: existingUser, error: checkUserError } = await adminSupabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();
          
          // If users table exists and user doesn't exist, create it
          if (!checkUserError && !existingUser) {
            console.log('[step-11-payment-setup] users table exists but user missing - creating user record');
            
            // Get user email from auth
            let userEmail: string;
            try {
              const { createServerClient } = await import('@/lib/db');
              const supabaseClient = await createServerClient();
              const { data: { user } } = await supabaseClient.auth.getUser();
              userEmail = user?.email || `user-${userId}@tithi.com`;
            } catch {
              userEmail = `user-${userId}@tithi.com`;
            }
            
            const { error: createUserError } = await adminSupabase
              .from('users')
              .insert({
                id: userId,
                email: userEmail,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            
            if (createUserError) {
              // If insert fails due to missing columns, try with just id
              if (createUserError.code === '42703' || createUserError.message?.includes('column')) {
                const { error: minimalError } = await adminSupabase
                  .from('users')
                  .insert({ id: userId });
                if (minimalError) {
                  console.warn('[step-11-payment-setup] Could not create user record:', minimalError);
                } else {
                  console.log('[step-11-payment-setup] Created minimal user record');
                }
              } else {
                console.warn('[step-11-payment-setup] Could not create user record:', createUserError);
              }
            } else {
              console.log('[step-11-payment-setup] User record created in users table');
            }
          } else if (checkUserError && checkUserError.code !== 'PGRST116') {
            console.warn('[step-11-payment-setup] Error checking users table:', checkUserError);
          }
        } catch (error) {
          // users table might not exist - that's okay
          console.log('[step-11-payment-setup] users table check failed (might not exist):', error);
        }
        
        try {
          const { data: newBusiness, error: createError } = await adminSupabase
            .from('businesses')
            .insert({
              user_id: userId,
              name: businessName,
              industry: industry,
              subdomain: `temp-${Date.now()}`,
              timezone: 'America/New_York',
            })
            .select('id')
            .single();
          
          if (createError || !newBusiness) {
            console.error('[step-11-payment-setup] Failed to create business:', createError);
            
            // Check if it's a foreign key constraint error
            if (createError?.code === '23503' && createError?.message?.includes('users')) {
              console.error('[step-11-payment-setup] FOREIGN KEY CONSTRAINT ERROR:');
              console.error('[step-11-payment-setup] The businesses.user_id foreign key references a non-existent users table.');
              console.error('[step-11-payment-setup] It should reference auth.users(id) instead.');
              console.error('[step-11-payment-setup] Run migration: supabase/migrations/20250104000000_fix_businesses_user_id_fkey.sql');
              
              return NextResponse.json(
                { 
                  error: 'Database configuration issue: Foreign key constraint needs to be fixed.',
                  details: 'The businesses table has a foreign key that incorrectly references a users table (which doesn\'t exist). It should reference auth.users(id) instead.',
                  code: 'FOREIGN_KEY_VIOLATION',
                  solution: {
                    important: 'Make sure you are in the TITHI2 Supabase project (not TITHI)',
                    quickFix: 'FIX_CONSTRAINT_TITHI2.sql (in project root)',
                    instructions: [
                      '1. Go to Supabase Dashboard and SELECT THE TITHI2 PROJECT',
                      '2. Navigate to SQL Editor',
                      '3. Open the file: FIX_CONSTRAINT_TITHI2.sql (in your project root)',
                      '4. Copy ALL the SQL from that file',
                      '5. Paste into SQL Editor and click Run',
                      '6. Check the output - it should show: referenced_schema = "auth" and referenced_table = "users"',
                      '7. If you see "✅ SUCCESS", the fix worked!'
                    ],
                    alternative: 'Or run: supabase db push (if you have Supabase CLI linked to TITHI2)'
                  }
                },
                { status: 500 }
              );
            }
            
            return NextResponse.json(
              { error: 'Business not found and could not be created. Please complete step 1 (Business) first.', details: createError?.message },
              { status: 400 }
            );
          }
          
          businessId = newBusiness.id;
          console.log('[step-11-payment-setup] Created business:', businessId);
        } catch (error) {
          console.error('[step-11-payment-setup] Error creating business:', error);
          return NextResponse.json(
            { error: 'Business not found. Please complete step 1 (Business) first to create your business profile.', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 400 }
          );
        }
      } else {
        console.error('[step-11-payment-setup] Business not found for user:', userId);
        return NextResponse.json(
          { error: 'Business not found. Please complete step 1 (Business) first to create your business profile.' },
          { status: 400 }
        );
      }
    }
    
    console.log('[step-11-payment-setup] Business ID:', businessId);
    
    // Frontend sends PaymentSetupConfig, but we also accept direct Stripe Connect params
    const { connectAccountId, email, returnUrl, refreshUrl, acceptedMethods: requestedMethods } = body;

    const supabase = await createServerClient();
    
    // Get user's email from session if not provided in body
    let userEmail = email;
    if (!userEmail) {
      try {
        // Try to get user from Supabase auth
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!userError && user?.email) {
          userEmail = user.email;
          console.log('[step-11-payment-setup] Got email from user session:', userEmail);
        } else {
          console.warn('[step-11-payment-setup] Could not get email from auth.getUser(), error:', userError);
          // Use a default email format as fallback (shouldn't happen in production)
          userEmail = `user-${userId}@tithi.com`;
          console.log('[step-11-payment-setup] Using fallback email:', userEmail);
        }
      } catch (error) {
        console.error('[step-11-payment-setup] Error getting email:', error);
        // Use a default email format as fallback
        userEmail = `user-${userId}@tithi.com`;
        console.log('[step-11-payment-setup] Using fallback email after error:', userEmail);
      }
    }

    if (!userEmail) {
      console.error('[step-11-payment-setup] No email found - cannot proceed');
      return NextResponse.json(
        { error: 'Email is required. Please ensure you are logged in with a valid email address.' },
        { status: 400 }
      );
    }

    // Get business info including notifications_enabled
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, stripe_connect_account_id, stripe_customer_id, stripe_subscription_id, notifications_enabled')
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
      accountId = await createConnectAccount(userId, userEmail);

      // Save the account ID (will be verified after onboarding completes)
      await supabase
        .from('businesses')
        .update({
          stripe_connect_account_id: accountId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessId);

      // Create Account Link for onboarding
      // Redirect to /onboarding (the actual onboarding page, not /onboarding/payment-setup)
      const defaultReturnUrl = returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding`;
      const defaultRefreshUrl = refreshUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding`;

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
      const defaultReturnUrl = returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding`;
      const defaultRefreshUrl = refreshUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding`;

      const accountLinkUrl = await createAccountLink(accountId, defaultReturnUrl, defaultRefreshUrl);

      return NextResponse.json({
        success: false,
        accountLinkUrl,
        connectAccountId: accountId,
        message: 'Please complete Stripe Connect onboarding',
      });
    }

    // Create or get Stripe Customer for subscription
    let customerId: string;
    if (business.stripe_customer_id) {
      customerId = business.stripe_customer_id;
    } else {
      const businessName = business.name || 'Business Owner';
      const newCustomerId = await createOrGetCustomer(userEmail, businessName, {
        business_id: businessId as string, // businessId is guaranteed to be string at this point
        user_id: userId,
      });
      customerId = newCustomerId;

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
    // 
    // Pricing:
    // - Basic Plan ($11.99/month): notifications_enabled = false
    //   → Uses STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS
    // - Pro Plan ($21.99/month): notifications_enabled = true
    //   → Uses STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS
    //
    // The user selects this in onboarding Step 8 (Notifications step)
    // which saves notifications_enabled to the businesses table.
    const notificationsEnabled = business.notifications_enabled === true; // Explicitly check for true
    const planType = notificationsEnabled ? 'Pro' : 'Basic';
    const planPrice = notificationsEnabled ? 21.99 : 11.99;
    
    console.log(`Creating subscription for business ${businessId}:`);
    console.log(`  - notifications_enabled: ${business.notifications_enabled}`);
    console.log(`  - Plan: ${planType} ($${planPrice}/month)`);
    
    const priceIdWithNotifications = process.env.STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS || process.env.NEXT_PUBLIC_STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS;
    const priceIdWithoutNotifications = process.env.STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS || process.env.NEXT_PUBLIC_STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS;
    
    // Fallback to single price ID if separate ones not configured
    const fallbackPriceId = process.env.STRIPE_PLAN_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_PLAN_PRICE_ID;
    
    const stripePriceId: string | undefined = notificationsEnabled 
      ? (priceIdWithNotifications || fallbackPriceId)
      : (priceIdWithoutNotifications || fallbackPriceId);
    
    console.log(`  - Selected Stripe Price ID: ${stripePriceId}`);
    console.log(`  - Price ID source: ${notificationsEnabled ? 'WITH_NOTIFICATIONS' : 'WITHOUT_NOTIFICATIONS'}`);

    if (!subscriptionId) {
      if (!stripePriceId) {
        console.error('No Stripe price ID configured. Please set STRIPE_PLAN_PRICE_ID or STRIPE_PLAN_PRICE_ID_WITH/WITHOUT_NOTIFICATIONS');
        return NextResponse.json(
          { 
            error: 'Subscription price not configured. Please contact support.',
            details: 'Missing Stripe price ID in environment variables'
          },
          { status: 500 }
        );
      }
      try {
        // Add metadata to subscription so webhooks can find the business
        // Note: paymentMethodId can be passed if owner already provided it in the request
        const bodyPaymentMethodId = body.paymentMethodId;
        const subscription = await createSubscription(
          customerId,
          stripePriceId as string, // Already checked for null above
          {
            business_id: businessId as string, // businessId is guaranteed to be string at this point
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

        // Save subscription details including the price ID and plan type
        const { error: updateError } = await supabase
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
        
        if (updateError) {
          console.error('Error saving subscription to database:', updateError);
          throw updateError;
        }
        
        // Verify the subscription was saved correctly
        const { data: verifiedBusiness, error: verifyError } = await supabase
          .from('businesses')
          .select('stripe_subscription_id, stripe_price_id, notifications_enabled, subscription_status')
          .eq('id', businessId)
          .single();
        
        if (verifyError) {
          console.error('Error verifying subscription save:', verifyError);
        } else {
          console.log('Subscription saved successfully:');
          console.log(`  - Subscription ID: ${verifiedBusiness.stripe_subscription_id}`);
          console.log(`  - Price ID: ${verifiedBusiness.stripe_price_id}`);
          console.log(`  - Notifications enabled: ${verifiedBusiness.notifications_enabled}`);
          console.log(`  - Status: ${verifiedBusiness.subscription_status}`);
          console.log(`  - Plan: ${verifiedBusiness.notifications_enabled ? 'Pro ($21.99/month)' : 'Basic ($11.99/month)'}`);
        }
      } catch (subscriptionError) {
        console.error('Error creating subscription:', subscriptionError);
        return NextResponse.json(
          { 
            error: 'Failed to create subscription',
            details: subscriptionError instanceof Error ? subscriptionError.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    }

    // Save accepted payment methods if provided
    if (requestedMethods && Array.isArray(requestedMethods) && requestedMethods.length > 0) {
      try {
        // First, disable all existing payment methods for this business
        await supabase
          .from('payment_methods')
          .update({ enabled: false })
          .eq('business_id', businessId);

        // Then, insert or update the requested methods
        const methodsToSave = requestedMethods.map((method: string) => ({
          business_id: businessId,
          user_id: userId,
          method: method === 'wallets' ? 'apple_pay' : method, // Map 'wallets' to specific methods
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        // If 'wallets' is in the list, also add google_pay
        if (requestedMethods.includes('wallets')) {
          methodsToSave.push({
            business_id: businessId,
            user_id: userId,
            method: 'google_pay',
            enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        // Always ensure 'card' is enabled
        if (!requestedMethods.includes('card')) {
          methodsToSave.push({
            business_id: businessId,
            user_id: userId,
            method: 'card',
            enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        // Upsert payment methods
        const { error: paymentMethodsError } = await supabase
          .from('payment_methods')
          .upsert(methodsToSave, {
            onConflict: 'business_id,method',
            ignoreDuplicates: false,
          });

        if (paymentMethodsError) {
          console.error('[step-11-payment-setup] Error saving payment methods:', paymentMethodsError);
          // Don't fail the request if payment methods save fails
        } else {
          console.log('[step-11-payment-setup] Saved payment methods:', methodsToSave.map(m => m.method));
        }
      } catch (error) {
        // payment_methods table might not exist, log and continue
        console.log('[step-11-payment-setup] Could not save payment methods (table might not exist):', error);
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


