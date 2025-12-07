import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';

/**
 * GET /api/cron/subscription-health
 * 
 * Syncs Stripe subscription status with database
 * Should be called daily
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    // Get all businesses with Stripe subscriptions
    const { data: businesses, error: fetchError } = await supabase
      .from('businesses')
      .select('id, user_id, stripe_subscription_id, subscription_status')
      .not('stripe_subscription_id', 'is', null)
      .is('deleted_at', null);

    if (fetchError) {
      console.error('Error fetching businesses:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch businesses', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: 'No subscriptions to sync',
      });
    }

    const stripe = getStripeClient();
    let synced = 0;
    let updated = 0;
    let deprovisioned = 0;

    for (const business of businesses) {
      try {
        if (!business.stripe_subscription_id) continue;

        const subscription = await stripe.subscriptions.retrieve(business.stripe_subscription_id);

        // Map Stripe status to our status
        let newStatus = business.subscription_status;
        if (subscription.status === 'active') {
          newStatus = 'active';
        } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
          newStatus = 'paused';
        } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
          newStatus = 'canceled';
        }

        // Prepare update object
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        // Update status if changed
        if (newStatus !== business.subscription_status) {
          updateData.subscription_status = newStatus;
        }

        // Update next_bill_at from Stripe subscription current_period_end
        if (subscription.current_period_end) {
          updateData.next_bill_at = new Date(subscription.current_period_end * 1000).toISOString();
        }

        // If subscription is canceled, soft delete business and deprovision subdomain
        if (newStatus === 'canceled' && business.subscription_status !== 'canceled') {
          updateData.deleted_at = new Date().toISOString();
          // Note: Actual subdomain deprovisioning would require DNS/domain management
          // For now, we just mark the business as deleted
          // In production, you'd call a domain management service here
          deprovisioned++;
        }

        // If Stripe says active but DB says canceled, reactivate
        if (subscription.status === 'active' && business.subscription_status === 'canceled') {
          updateData.subscription_status = 'active';
          updateData.deleted_at = null; // Reactivate
        }

        // Perform update if there are changes
        if (Object.keys(updateData).length > 1) { // More than just updated_at
          await supabase
            .from('businesses')
            .update(updateData)
            .eq('id', business.id);

          if (newStatus !== business.subscription_status) {
            updated++;
          }
        } else if (updateData.next_bill_at) {
          // Only next_bill_at changed
          await supabase
            .from('businesses')
            .update(updateData)
            .eq('id', business.id);
        }

        synced++;
      } catch (error) {
        console.error(`Error syncing subscription for business ${business.id}:`, error);
        // Continue with other businesses
      }
    }

    return NextResponse.json({
      checked: synced,
      updated,
      deprovisioned,
      message: `Synced ${synced} subscription(s), updated ${updated}, deprovisioned ${deprovisioned}`,
    });
  } catch (error) {
    console.error('Error in subscription health cron:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


