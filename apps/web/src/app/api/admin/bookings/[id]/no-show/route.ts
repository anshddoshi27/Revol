import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import { checkIdempotency, storeIdempotency } from '@/lib/idempotency';
import { createPaymentIntent, getPaymentMethodFromSetupIntent } from '@/lib/stripe';
import { emitNotification } from '@/lib/notifications';

/**
 * POST /api/admin/bookings/{id}/no-show
 * 
 * Charges no-show fee for a booking
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

    const route = `/admin/bookings/${params.id}/no-show`;

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

    if (booking.status === 'no_show') {
      return NextResponse.json(
        { error: 'Booking is already marked as no-show' },
        { status: 400 }
      );
    }

    if (!booking.businesses?.stripe_connect_account_id) {
      return NextResponse.json(
        { error: 'Business Stripe Connect account not configured' },
        { status: 500 }
      );
    }

    // Get payment method
    const { data: setupPayment } = await supabase
      .from('booking_payments')
      .select('stripe_setup_intent_id')
      .eq('booking_id', booking.id)
      .eq('status', 'card_saved')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!setupPayment?.stripe_setup_intent_id) {
      return NextResponse.json(
        { error: 'No saved payment method found for this booking' },
        { status: 400 }
      );
    }

    const paymentMethodId = await getPaymentMethodFromSetupIntent(setupPayment.stripe_setup_intent_id);
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Failed to retrieve payment method' },
        { status: 500 }
      );
    }

    // Calculate no-show fee from policy snapshot
    const policySnapshot = booking.policy_snapshot as any;
    let feeAmountCents = 0;

    if (policySnapshot?.no_show_fee_type === 'amount') {
      feeAmountCents = policySnapshot.no_show_fee_amount_cents || 0;
    } else if (policySnapshot?.no_show_fee_type === 'percent') {
      const percent = policySnapshot.no_show_fee_percent || 0;
      feeAmountCents = Math.round((booking.final_price_cents * percent) / 100);
    }

    // If fee is 0, just update status without charging
    if (feeAmountCents === 0) {
      await supabase
        .from('bookings')
        .update({
          status: 'no_show',
          payment_status: 'none',
          last_money_action: 'no_show_fee',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      const response = {
        status: 'NO_SHOW',
        charge_amount: 0,
        currency: 'usd',
        message: 'No-show fee is $0.00',
      };

      await storeIdempotency(userId, route, idempotencyKey, response);
      return NextResponse.json(response);
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
        money_action: 'no_show_fee',
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
          money_action: 'no_show_fee',
          status: 'charged',
          application_fee_cents: platformFeeCents,
          net_amount_cents: feeAmountCents - platformFeeCents,
          currency: 'usd',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      await supabase
        .from('bookings')
        .update({
          status: 'no_show',
          payment_status: 'charged',
          last_money_action: 'no_show_fee',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      // Emit fee_charged notification (async, don't wait)
      emitNotification(businessId, 'fee_charged', booking.id, supabase, feeAmountCents).catch((err) => {
        console.error('Error emitting fee_charged notification:', err);
      });

      const response = {
        status: 'CHARGED',
        charge_amount: feeAmountCents,
        currency: 'usd',
        stripe_payment_intent_id: paymentIntentId,
        receipt_url: `https://dashboard.stripe.com/payments/${paymentIntentId}`,
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
          money_action: 'no_show_fee',
          status: 'charge_pending',
          currency: 'usd',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      await supabase
        .from('bookings')
        .update({
          status: 'no_show',
          payment_status: 'charge_pending',
          last_money_action: 'no_show_fee',
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
          money_action: 'no_show_fee',
          status: 'failed',
          currency: 'usd',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      await supabase
        .from('bookings')
        .update({
          status: 'no_show',
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
    console.error('Error in no-show booking:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


