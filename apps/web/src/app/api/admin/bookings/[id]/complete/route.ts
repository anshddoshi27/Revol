import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import { checkIdempotency, storeIdempotency } from '@/lib/idempotency';
import { createPaymentIntent, getPaymentMethodFromSetupIntent } from '@/lib/stripe';
import { emitNotification } from '@/lib/notifications';

/**
 * POST /api/admin/bookings/{id}/complete
 * 
 * Charges the full amount for a completed booking
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

    // Get idempotency key from header
    const idempotencyKey = request.headers.get('X-Idempotency-Key');
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'X-Idempotency-Key header is required' },
        { status: 400 }
      );
    }

    const route = `/admin/bookings/${params.id}/complete`;

    // Check idempotency
    const cachedResponse = await checkIdempotency(userId, route, idempotencyKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    const supabase = await createServerClient();

    // Get booking with related data
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

    // Validate booking can be completed
    if (booking.status === 'completed') {
      return NextResponse.json(
        { error: 'Booking is already completed' },
        { status: 400 }
      );
    }

    if (!booking.businesses?.stripe_connect_account_id) {
      return NextResponse.json(
        { error: 'Business Stripe Connect account not configured' },
        { status: 500 }
      );
    }

    // Get payment method from SetupIntent
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

    // Calculate amount and platform fee (1%)
    const amountCents = booking.final_price_cents;
    const platformFeeCents = Math.round(amountCents * 0.01);

    // Create PaymentIntent (off-session charge for saved card)
    const { paymentIntentId, clientSecret, status: paymentStatus, requiresAction } = await createPaymentIntent({
      amount: amountCents,
      customerId: booking.customers.stripe_customer_id!,
      paymentMethodId,
      connectAccountId: booking.businesses.stripe_connect_account_id,
      applicationFee: platformFeeCents,
      offSession: true, // Off-session charge for saved payment method
      metadata: {
        booking_id: booking.id,
        business_id: businessId,
        money_action: 'completed_charge',
      },
    });

    // Handle payment status
    if (paymentStatus === 'succeeded') {
      // Payment succeeded - create booking payment record
      const { error: paymentError } = await supabase
        .from('booking_payments')
        .insert({
          user_id: userId,
          business_id: businessId,
          booking_id: booking.id,
          stripe_payment_intent_id: paymentIntentId,
          amount_cents: amountCents,
          money_action: 'completed_charge',
          status: 'charged',
          application_fee_cents: platformFeeCents,
          net_amount_cents: amountCents - platformFeeCents,
          currency: 'usd',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (paymentError) {
        console.error('Error creating payment record:', paymentError);
        return NextResponse.json(
          { error: 'Failed to record payment', details: paymentError.message },
          { status: 500 }
        );
      }

      // Update booking status
      await supabase
        .from('bookings')
        .update({
          status: 'completed',
          payment_status: 'charged',
          last_money_action: 'completed_charge',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      // Emit booking_completed notification (async, don't wait)
      emitNotification(businessId, 'booking_completed', booking.id, supabase).catch((err) => {
        console.error('Error emitting booking_completed notification:', err);
      });

      // Handle gift card balance deduction (if amount-type gift card was used)
      // Only deduct when payment succeeds - per spec: "no money moves until charge succeeds"
      if (booking.gift_card_id && booking.gift_card_amount_applied_cents > 0) {
        const { data: giftCard } = await supabase
          .from('gift_cards')
          .select('discount_type, current_balance_cents')
          .eq('id', booking.gift_card_id)
          .single();

        if (giftCard && giftCard.discount_type === 'amount') {
          // Deduct from balance and write ledger
          const newBalance = Math.max(0, giftCard.current_balance_cents - booking.gift_card_amount_applied_cents);

          await supabase
            .from('gift_cards')
            .update({
              current_balance_cents: newBalance,
              updated_at: new Date().toISOString(),
            })
            .eq('id', booking.gift_card_id);

          await supabase
            .from('gift_card_ledger')
            .insert({
              user_id: userId,
              business_id: businessId,
              gift_card_id: booking.gift_card_id,
              booking_id: booking.id,
              delta_cents: -booking.gift_card_amount_applied_cents,
              reason: 'redemption',
              created_at: new Date().toISOString(),
            });
        }
      }
    } else if (requiresAction || paymentStatus === 'requires_action' || paymentStatus === 'requires_payment_method') {
      // Payment requires customer action (3DS, etc.)
      // Store payment intent but mark as pending
      await supabase
        .from('booking_payments')
        .insert({
          user_id: userId,
          business_id: businessId,
          booking_id: booking.id,
          stripe_payment_intent_id: paymentIntentId,
          amount_cents: amountCents,
          money_action: 'completed_charge',
          status: 'charge_pending',
          application_fee_cents: platformFeeCents,
          net_amount_cents: amountCents - platformFeeCents,
          currency: 'usd',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      await supabase
        .from('bookings')
        .update({
          payment_status: 'charge_pending',
          last_money_action: 'completed_charge',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      return NextResponse.json({
        status: 'REQUIRES_ACTION',
        charge_amount: amountCents,
        currency: 'usd',
        stripe_payment_intent_id: paymentIntentId,
        client_secret: clientSecret,
        message: 'Payment requires customer authentication. Send payment link to customer.',
      });
    } else {
      // Payment failed
      await supabase
        .from('booking_payments')
        .insert({
          user_id: userId,
          business_id: businessId,
          booking_id: booking.id,
          stripe_payment_intent_id: paymentIntentId,
          amount_cents: amountCents,
          money_action: 'completed_charge',
          status: 'failed',
          currency: 'usd',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      await supabase
        .from('bookings')
        .update({
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      return NextResponse.json(
        { 
          error: 'Payment failed', 
          status: paymentStatus,
          stripe_payment_intent_id: paymentIntentId,
          message: 'Payment could not be processed. Please try again or contact customer.',
        },
        { status: 402 }
      );
    }

    const response = {
      status: 'CHARGED',
      charge_amount: amountCents,
      currency: 'usd',
      stripe_payment_intent_id: paymentIntentId,
      receipt_url: `https://dashboard.stripe.com/payments/${paymentIntentId}`,
    };

    // Store idempotency
    await storeIdempotency(userId, route, idempotencyKey, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in complete booking:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


