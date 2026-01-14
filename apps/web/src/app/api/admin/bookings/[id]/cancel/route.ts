import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import { checkIdempotency, storeIdempotency } from '@/lib/idempotency';
import { createPaymentIntent, getPaymentMethodFromSetupIntent } from '@/lib/stripe';
import { emitNotification } from '@/lib/notifications';

/**
 * POST /api/admin/bookings/{id}/cancel
 * 
 * Charges cancellation fee for a booking
 * Requires X-Idempotency-Key header
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const idempotencyKey = request.headers.get('X-Idempotency-Key');
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'X-Idempotency-Key header is required' },
        { status: 400 }
      );
    }

    const route = `/admin/bookings/${params.id}/cancel`;

    const cachedResponse = await checkIdempotency(userId, route, idempotencyKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    const supabase = await createServerClient();

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services:service_id (*),
        customers:customer_id (*),
        businesses:business_id (
          stripe_connect_account_id
        )
      `)
      .eq('id', params.id)
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Booking is already cancelled' },
        { status: 400 }
      );
    }

    // Calculate cancellation fee from policy snapshot FIRST
    // This allows us to handle $0 fees without requiring a payment record
    const policySnapshot = booking.policy_snapshot as any;
    let feeAmountCents = 0;

    if (policySnapshot?.cancel_fee_type === 'amount') {
      feeAmountCents = policySnapshot.cancel_fee_amount_cents || 0;
    } else if (policySnapshot?.cancel_fee_type === 'percent') {
      const percent = policySnapshot.cancel_fee_percent || 0;
      feeAmountCents = Math.round((booking.final_price_cents * percent) / 100);
    }

    // If fee is 0, just update status without charging - no payment record needed
    if (feeAmountCents === 0) {
      console.log(`[cancel-booking] Cancellation fee is $0, updating status without payment for booking ${booking.id}`);
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          payment_status: 'none',
          last_money_action: 'cancel_fee',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .select('id');

      if (updateError) {
        console.error('[cancel-booking] Error updating booking status:', updateError);
        return NextResponse.json(
          { error: 'Failed to update booking status', details: updateError.message },
          { status: 500 }
        );
      }

      const response = {
        status: 'CANCELLED',
        charge_amount: 0,
        currency: 'usd',
        message: 'Cancellation fee is $0.00. Booking cancelled.',
        booking_status: 'cancelled',
      };

      try {
        await storeIdempotency(userId, route, idempotencyKey, response);
      } catch (idempotencyError) {
        console.error('Error storing idempotency key (non-fatal):', idempotencyError);
      }

      return NextResponse.json(response);
    }

    // Fee > 0, so we need a payment method - check for Stripe Connect account
    if (!booking.businesses?.stripe_connect_account_id) {
      return NextResponse.json(
        { error: 'Business Stripe Connect account not configured. Cannot charge cancellation fee.' },
        { status: 500 }
      );
    }

    // Get payment method from SetupIntent
    // Check for any payment record with a setup_intent_id
    // Valid payment_status enum values: 'none', 'card_saved', 'charge_pending', 'charged', 'refunded', 'failed'
    // The webhook updates status to 'card_saved' when SetupIntent succeeds, but it might not have processed yet
    // So we check for 'none' (initial state) or 'card_saved' (webhook processed)
    const { data: setupPayment, error: paymentQueryError } = await supabase
      .from('booking_payments')
      .select('stripe_setup_intent_id')
      .eq('booking_id', booking.id)
      .not('stripe_setup_intent_id', 'is', null)
      .in('status', ['none', 'card_saved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentQueryError) {
      console.error('[cancel-booking] Error querying booking payments:', paymentQueryError);
      return NextResponse.json(
        { error: 'Failed to check payment status', details: paymentQueryError.message },
        { status: 500 }
      );
    }

    if (!setupPayment?.stripe_setup_intent_id) {
      // Log all payment records for debugging
      const { data: allPayments } = await supabase
        .from('booking_payments')
        .select('id, status, stripe_setup_intent_id, money_action, created_at')
        .eq('booking_id', booking.id);
      
      console.error(`[cancel-booking] No payment record with setup_intent_id found for booking ${booking.id}. Fee is ${feeAmountCents/100}. All payment records:`, allPayments);
      
      return NextResponse.json(
        { 
          error: `Cancellation fee is $${(feeAmountCents/100).toFixed(2)}, but no saved payment method found for this booking. Cannot charge fee without payment method.`,
          booking_id: booking.id,
          fee_amount_cents: feeAmountCents,
          has_payment_records: (allPayments?.length ?? 0) > 0,
          payment_records_count: allPayments?.length ?? 0
        },
        { status: 400 }
      );
    }

    const paymentMethodId = await getPaymentMethodFromSetupIntent(setupPayment.stripe_setup_intent_id);
    if (!paymentMethodId) {
      return NextResponse.json(
        { 
          error: 'Payment method not yet available. The customer may need to complete the payment setup first. Please check if the SetupIntent was completed successfully.',
          setup_intent_id: setupPayment.stripe_setup_intent_id
        },
        { status: 400 }
      );
    }

    const platformFeeCents = Math.round(feeAmountCents * 0.01);

    // Create PaymentIntent (off-session charge for saved card)
    const { paymentIntentId, status: paymentStatus, requiresAction } = await createPaymentIntent({
      amount: feeAmountCents,
      customerId: booking.customers.stripe_customer_id!,
      paymentMethodId,
      connectAccountId: booking.businesses.stripe_connect_account_id,
      applicationFee: platformFeeCents,
      offSession: true, // Off-session charge for saved payment method
      metadata: {
        booking_id: booking.id,
        business_id: businessId,
        money_action: 'cancel_fee',
      },
    });

    // Handle payment status
    if (paymentStatus === 'succeeded') {
      await supabase
        .from('booking_payments')
        .insert({
          user_id: userId,
          business_id: businessId,
          booking_id: booking.id,
          stripe_payment_intent_id: paymentIntentId,
          amount_cents: feeAmountCents,
          money_action: 'cancel_fee',
          status: 'charged',
          application_fee_cents: platformFeeCents,
          net_amount_cents: feeAmountCents - platformFeeCents,
          currency: 'usd',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          payment_status: 'charged',
          last_money_action: 'cancel_fee',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (updateError) {
        console.error('Error updating booking status:', updateError);
        return NextResponse.json(
          { error: 'Failed to update booking status', details: updateError.message },
          { status: 500 }
        );
      }

      // Emit booking_cancelled notification (async, don't wait)
      emitNotification(businessId, 'booking_cancelled', booking.id, supabase).catch((err) => {
        console.error('Error emitting booking_cancelled notification:', err);
      });

      // Also emit fee_charged if fee > 0
      if (feeAmountCents > 0) {
        emitNotification(businessId, 'fee_charged', booking.id, supabase, feeAmountCents).catch((err) => {
          console.error('Error emitting fee_charged notification:', err);
        });
      }

      const response = {
        status: 'CHARGED',
        charge_amount: feeAmountCents,
        currency: 'usd',
        stripe_payment_intent_id: paymentIntentId,
        receipt_url: `https://dashboard.stripe.com/payments/${paymentIntentId}`,
        booking_status: 'cancelled',
      };

      await storeIdempotency(userId, route, idempotencyKey, response);
      return NextResponse.json(response);

    } else if (requiresAction || paymentStatus === 'requires_action' || paymentStatus === 'requires_payment_method') {
      // Payment requires customer action
      await supabase
        .from('booking_payments')
        .insert({
          user_id: userId,
          business_id: businessId,
          booking_id: booking.id,
          stripe_payment_intent_id: paymentIntentId,
          amount_cents: feeAmountCents,
          money_action: 'cancel_fee',
          status: 'charge_pending',
          currency: 'usd',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          payment_status: 'charge_pending',
          last_money_action: 'cancel_fee',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      const response = {
        status: 'REQUIRES_ACTION',
        charge_amount: feeAmountCents,
        currency: 'usd',
        stripe_payment_intent_id: paymentIntentId,
        message: 'Payment requires customer authentication. Send payment link to customer.',
      };

      await storeIdempotency(userId, route, idempotencyKey, response);
      return NextResponse.json(response);
    } else {
      // Payment failed
      await supabase
        .from('booking_payments')
        .insert({
          user_id: userId,
          business_id: businessId,
          booking_id: booking.id,
          stripe_payment_intent_id: paymentIntentId,
          amount_cents: feeAmountCents,
          money_action: 'cancel_fee',
          status: 'failed',
          currency: 'usd',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      const response = {
        status: 'FAILED',
        charge_amount: feeAmountCents,
        currency: 'usd',
        stripe_payment_intent_id: paymentIntentId,
        message: 'Payment could not be processed.',
      };

      await storeIdempotency(userId, route, idempotencyKey, response);
      return NextResponse.json(response, { status: 402 });
    }
  } catch (error) {
    console.error('Error in cancel booking:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


