import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { cancelSubscription } from '@/lib/stripe';

/**
 * PUT /api/business/[businessId]/subscription
 * 
 * Updates subscription status (cancel, pause, activate)
 * 
 * Body: {
 *   action: 'cancel' | 'pause' | 'activate'
 * }
 */
export async function PUT(
  request: Request,
  { params }: { params: { businessId: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { businessId } = params;
    const body = await request.json();
    const { action } = body;

    if (!action || !['cancel', 'pause', 'activate'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be cancel, pause, or activate' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get business and verify ownership
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, user_id, stripe_subscription_id, subscription_status')
      .eq('id', businessId)
      .eq('user_id', userId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found or access denied' },
        { status: 404 }
      );
    }

    // Cancel subscription in Stripe if subscription exists
    if (action === 'cancel' && business.stripe_subscription_id) {
      try {
        await cancelSubscription(business.stripe_subscription_id);
        console.log(`[subscription] Canceled Stripe subscription ${business.stripe_subscription_id} for business ${businessId}`);
      } catch (stripeError) {
        console.error('[subscription] Error canceling Stripe subscription:', stripeError);
        // Continue to update database even if Stripe cancel fails
        // The webhook will handle the status update when Stripe processes the cancellation
      }
    }

    // Update subscription status in database
    let subscriptionStatus = business.subscription_status;
    if (action === 'cancel') {
      subscriptionStatus = 'canceled';
    } else if (action === 'pause') {
      subscriptionStatus = 'paused';
    } else if (action === 'activate') {
      subscriptionStatus = 'active';
    }

    const updateData: any = {
      subscription_status: subscriptionStatus,
      updated_at: new Date().toISOString(),
    };

    // If canceling, clear next_bill_at and deprovision subdomain
    if (action === 'cancel') {
      updateData.next_bill_at = null;
      updateData.subdomain = null; // Deprovision subdomain on cancel
    }

    const { error: updateError } = await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', businessId);

    if (updateError) {
      console.error('[subscription] Error updating subscription status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update subscription status', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscriptionStatus,
      message: `Subscription ${action}ed successfully`,
    });
  } catch (error) {
    console.error('[subscription] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

