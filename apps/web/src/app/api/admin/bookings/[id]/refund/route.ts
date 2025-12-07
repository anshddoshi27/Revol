import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import { checkIdempotency, storeIdempotency } from '@/lib/idempotency';
import { createRefund } from '@/lib/stripe';
import { emitNotification } from '@/lib/notifications';

/**
 * POST /api/admin/bookings/{id}/refund
 * 
 * Refunds a previous charge for a booking
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

    const route = `/admin/bookings/${params.id}/refund`;

    const cachedResponse = await checkIdempotency(userId, route, idempotencyKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    const supabase = await createServerClient();

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
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

    // Find the previous charged payment
    const { data: chargedPayment, error: paymentError } = await supabase
      .from('booking_payments')
      .select('*')
      .eq('booking_id', booking.id)
      .eq('status', 'charged')
      .in('money_action', ['completed_charge', 'no_show_fee', 'cancel_fee'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (paymentError || !chargedPayment || !chargedPayment.stripe_payment_intent_id) {
      const response = {
        status: 'NO_CHARGE',
        message: 'No previous charge found to refund',
        refund_amount: 0,
        currency: 'usd',
      };

      await storeIdempotency(userId, route, idempotencyKey, response);
      return NextResponse.json(response, { status: 400 });
    }

    // Create refund in Stripe
    const { refundId, amount } = await createRefund(chargedPayment.stripe_payment_intent_id);

    // Create refund payment record
    await supabase
      .from('booking_payments')
      .insert({
        user_id: userId,
        business_id: businessId,
        booking_id: booking.id,
        stripe_refund_id: refundId,
        stripe_payment_intent_id: chargedPayment.stripe_payment_intent_id,
        amount_cents: amount,
        money_action: 'refund',
        status: 'refunded',
        currency: 'usd',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    // Update booking status
    await supabase
      .from('bookings')
      .update({
        status: 'refunded',
        payment_status: 'refunded',
        last_money_action: 'refund',
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    // Emit refunded notification (async, don't wait)
    emitNotification(businessId, 'refunded', booking.id, supabase, amount).catch((err) => {
      console.error('Error emitting refunded notification:', err);
    });

    // Handle gift card balance restoration (if amount-type and business setting enabled)
    // Get business setting for restore_gift_card_on_refund
    const { data: business } = await supabase
      .from('businesses')
      .select('restore_gift_card_on_refund')
      .eq('id', businessId)
      .single();

    if (
      business?.restore_gift_card_on_refund &&
      booking.gift_card_id &&
      booking.gift_card_amount_applied_cents > 0
    ) {
      const { data: giftCard } = await supabase
        .from('gift_cards')
        .select('discount_type, current_balance_cents')
        .eq('id', booking.gift_card_id)
        .single();

      if (giftCard && giftCard.discount_type === 'amount') {
        const newBalance = giftCard.current_balance_cents + booking.gift_card_amount_applied_cents;

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
            delta_cents: booking.gift_card_amount_applied_cents,
            reason: 'refund_restore',
            created_at: new Date().toISOString(),
          });
      }
    }

    const response = {
      status: 'REFUNDED',
      refund_amount: amount,
      currency: 'usd',
      stripe_refund_id: refundId,
      receipt_url: `https://dashboard.stripe.com/refunds/${refundId}`,
    };

    await storeIdempotency(userId, route, idempotencyKey, response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in refund booking:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


