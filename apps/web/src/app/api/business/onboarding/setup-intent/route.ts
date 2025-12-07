import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import { createOrGetCustomer, createSetupIntent } from '@/lib/stripe';

/**
 * POST /api/business/onboarding/setup-intent
 * 
 * Creates a SetupIntent for collecting the owner's payment method for subscription
 * 
 * Returns: { clientSecret: string, setupIntentId: string }
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

    const supabase = await createServerClient();
    
    // Get business to find customer ID
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, stripe_customer_id, name')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Get user email for customer creation if needed
    let userEmail: string;
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!userError && user?.email) {
        userEmail = user.email;
      } else {
        userEmail = `user-${userId}@tithi.com`;
      }
    } catch (error) {
      userEmail = `user-${userId}@tithi.com`;
    }

    // Create or get Stripe Customer for subscription
    let customerId = business.stripe_customer_id;
    if (!customerId) {
      customerId = await createOrGetCustomer(userEmail, business.name || 'Business Owner', {
        business_id: businessId,
        user_id: userId,
      });

      // Save customer ID
      await supabase
        .from('businesses')
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessId);
    }

    // Create SetupIntent for subscription payment method
    const { setupIntentId, clientSecret } = await createSetupIntent(customerId, {
      business_id: businessId,
      user_id: userId,
      purpose: 'subscription',
    });

    return NextResponse.json({
      clientSecret,
      setupIntentId,
    });
  } catch (error) {
    console.error('Error creating setup intent:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


