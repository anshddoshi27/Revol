import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import { checkIdempotency, storeIdempotency } from '@/lib/idempotency';
import { createPaymentIntent, getPaymentMethodFromSetupIntent, verifyConnectAccount } from '@/lib/stripe';
import { emitNotification } from '@/lib/notifications';
import { logBookingActionMetric, notifyAdminRequiresAction } from '@/lib/booking-action-metrics';

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
  const startTime = Date.now();
  let userId: string | null = null;
  let businessId: string | null = null;
  let actionStatus: 'success' | 'failed' | 'requires_action' | 'no_payment_method' | 'invalid_state' = 'failed';
  let errorMessage: string | undefined;
  let amountCents: number | undefined;
  let paymentIntentId: string | undefined;
  
  try {
    userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    businessId = await getCurrentBusinessId();
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
      // Log cached response as success (idempotent call)
      await logBookingActionMetric({
        action: 'no-show',
        status: 'success',
        bookingId: params.id,
        businessId,
        userId,
        amountCents: (cachedResponse as any).charge_amount,
        durationMs: Date.now() - startTime,
      });
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
      actionStatus = 'invalid_state';
      errorMessage = 'Booking is already marked as no-show';
      await logBookingActionMetric({
        action: 'no-show',
        status: 'invalid_state',
        bookingId: params.id,
        businessId,
        userId,
        errorMessage,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // Calculate no-show fee from policy snapshot FIRST
    // This allows us to handle $0 fees without requiring a payment record
    const policySnapshot = booking.policy_snapshot as any;
    let feeAmountCents = 0;

    console.log(`[no-show-booking] Calculating fee for booking ${booking.id}. Policy snapshot:`, policySnapshot);
    
    if (policySnapshot?.no_show_fee_type === 'amount') {
      feeAmountCents = policySnapshot.no_show_fee_amount_cents || 0;
    } else if (policySnapshot?.no_show_fee_type === 'percent') {
      const percent = policySnapshot.no_show_fee_percent || 0;
      const finalPriceCents = booking.final_price_cents || booking.price_cents || 0;
      feeAmountCents = Math.round((finalPriceCents * percent) / 100);
    } else if (!policySnapshot || !policySnapshot.no_show_fee_type) {
      // If no policy snapshot or fee type, default to $0
      console.log(`[no-show-booking] No policy snapshot or fee type found, defaulting to $0 fee`);
      feeAmountCents = 0;
    }
    
    // Ensure fee is a valid number
    if (isNaN(feeAmountCents) || feeAmountCents < 0) {
      console.warn(`[no-show-booking] Invalid fee calculated (${feeAmountCents}), defaulting to $0`);
      feeAmountCents = 0;
    }

    console.log(`[no-show-booking] Calculated no-show fee: $${(feeAmountCents / 100).toFixed(2)} (${feeAmountCents} cents)`);

    // If fee is 0, just update status without charging - no payment record needed
    if (feeAmountCents === 0) {
      console.log(`[no-show-booking] No-show fee is $0, updating status without payment for booking ${booking.id}`);
      const { error: updateError, data: updatedRows } = await supabase
        .from('bookings')
        .update({
          status: 'no_show',
          payment_status: 'none',
          last_money_action: 'no_show_fee',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .select('id');

      if (updateError) {
        console.error('[no-show-booking] Error updating booking status:', updateError);
        return NextResponse.json(
          { error: 'Failed to update booking status', details: updateError.message },
          { status: 500 }
        );
      }

      if (!updatedRows || updatedRows.length === 0) {
        console.error('[no-show-booking] Booking update affected 0 rows. Booking may have been deleted or user/business mismatch.');
        return NextResponse.json(
          { error: 'Booking not found or access denied. Unable to update booking status.' },
          { status: 404 }
        );
      }

      console.log(`[no-show-booking] Booking status updated successfully. Updated booking ID: ${updatedRows[0]?.id}`);

      actionStatus = 'success';
      amountCents = 0;

      const response = {
        status: 'NO_SHOW',
        charge_amount: 0,
        currency: 'usd',
        message: 'No-show fee is $0.00. Booking marked as no-show.',
        booking_status: 'no_show',
      };

      try {
        await storeIdempotency(userId, route, idempotencyKey, response);
      } catch (idempotencyError) {
        console.error('[no-show-booking] Error storing idempotency key (non-fatal):', idempotencyError);
      }

      await logBookingActionMetric({
        action: 'no-show',
        status: 'success',
        bookingId: params.id,
        businessId,
        userId,
        amountCents: 0,
        durationMs: Date.now() - startTime,
      });

      return NextResponse.json(response);
    }

    // Fee > 0, so we need a payment method - check for Stripe Connect account
    if (!booking.businesses?.stripe_connect_account_id) {
      actionStatus = 'failed';
      errorMessage = 'Business Stripe Connect account not configured';
      await logBookingActionMetric({
        action: 'no-show',
        status: 'failed',
        bookingId: params.id,
        businessId,
        userId,
        amountCents: feeAmountCents,
        errorMessage,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: errorMessage + '. Cannot charge no-show fee. Please configure Stripe Connect account in business settings.' },
        { status: 500 }
      );
    }

    // Verify Connect account has required capabilities before attempting charge
    const accountVerification = await verifyConnectAccount(booking.businesses.stripe_connect_account_id);
    if (!accountVerification.valid) {
      actionStatus = 'failed';
      errorMessage = accountVerification.error || 'Stripe Connect account not properly configured';
      await logBookingActionMetric({
        action: 'no-show',
        status: 'failed',
        bookingId: params.id,
        businessId,
        userId,
        amountCents: feeAmountCents,
        errorMessage,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { 
          error: errorMessage,
          connect_account_id: booking.businesses.stripe_connect_account_id,
          details_submitted: accountVerification.detailsSubmitted,
          charges_enabled: accountVerification.chargesEnabled,
          transfers_enabled: accountVerification.transfersEnabled,
        },
        { status: 500 }
      );
    }

    if (!booking.customers?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Customer does not have a Stripe customer ID. The booking may not have been created through the payment flow.' },
        { status: 400 }
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
      console.error('[no-show-booking] Error querying booking payments:', paymentQueryError);
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
      
      console.error(`[no-show-booking] No payment record with setup_intent_id found for booking ${booking.id}. Fee is ${feeAmountCents/100}. All payment records:`, allPayments);
      
      actionStatus = 'no_payment_method';
      errorMessage = `No-show fee is $${(feeAmountCents/100).toFixed(2)}, but no saved payment method found`;
      amountCents = feeAmountCents;
      
      await logBookingActionMetric({
        action: 'no-show',
        status: 'no_payment_method',
        bookingId: params.id,
        businessId,
        userId,
        amountCents,
        errorMessage,
        durationMs: Date.now() - startTime,
      });
      
      return NextResponse.json(
        { 
          error: errorMessage + '. Cannot charge fee without payment method.',
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
    let paymentIntentId: string;
    let clientSecret: string | undefined;
    let paymentStatus: string;
    let requiresAction: boolean;

    try {
      const paymentResult = await createPaymentIntent({
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
      
      paymentIntentId = paymentResult.paymentIntentId;
      clientSecret = paymentResult.clientSecret;
      paymentStatus = paymentResult.status;
      requiresAction = paymentResult.requiresAction || false;
    } catch (stripeError) {
      console.error('[no-show-booking] Error creating PaymentIntent:', stripeError);
      
      // Extract more detailed error information from Stripe error
      let errorDetails = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
      let userFriendlyError = 'Failed to create payment intent for no-show fee';
      
      // Check for common Stripe Connect account errors
      if (errorDetails.includes('transfers') || errorDetails.includes('crypto_transfers') || errorDetails.includes('legacy_payments')) {
        userFriendlyError = 'Stripe Connect account does not have transfers capability enabled. Please complete account setup in Stripe Dashboard to enable payment transfers.';
      } else if (errorDetails.includes('destination') || errorDetails.includes('account')) {
        userFriendlyError = 'Stripe Connect account configuration issue. Please verify your Stripe Connect account is properly set up and has all required capabilities enabled.';
      }
      
      actionStatus = 'failed';
      errorMessage = userFriendlyError;
      amountCents = feeAmountCents;
      
      await logBookingActionMetric({
        action: 'no-show',
        status: 'failed',
        bookingId: params.id,
        businessId,
        userId,
        amountCents,
        errorMessage: `${userFriendlyError} (Stripe: ${errorDetails})`,
        durationMs: Date.now() - startTime,
      });
      
      return NextResponse.json(
        { 
          error: userFriendlyError,
          details: errorDetails,
          stripe_error_type: stripeError instanceof Error ? stripeError.constructor.name : 'Unknown'
        },
        { status: 500 }
      );
    }

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

      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'no_show',
          payment_status: 'charged',
          last_money_action: 'no_show_fee',
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

      // Emit fee_charged notification (async, don't wait)
      emitNotification(businessId, 'fee_charged', booking.id, supabase, feeAmountCents).catch((err) => {
        console.error('Error emitting fee_charged notification:', err);
      });

      actionStatus = 'success';
      amountCents = feeAmountCents;
      paymentIntentId = paymentIntentId;

      const response = {
        status: 'CHARGED',
        charge_amount: feeAmountCents,
        currency: 'usd',
        stripe_payment_intent_id: paymentIntentId,
        receipt_url: `https://dashboard.stripe.com/payments/${paymentIntentId}`,
        booking_status: 'no_show',
      };

      await storeIdempotency(userId, route, idempotencyKey, response);
      
      await logBookingActionMetric({
        action: 'no-show',
        status: 'success',
        bookingId: params.id,
        businessId,
        userId,
        amountCents,
        paymentIntentId,
        durationMs: Date.now() - startTime,
      });
      
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

      actionStatus = 'requires_action';
      amountCents = feeAmountCents;
      paymentIntentId = paymentIntentId;

      const response = {
        status: 'REQUIRES_ACTION',
        charge_amount: feeAmountCents,
        currency: 'usd',
        stripe_payment_intent_id: paymentIntentId,
        message: 'Payment requires customer authentication. Send payment link to customer.',
        booking_status: 'no_show',
      };

      await storeIdempotency(userId, route, idempotencyKey, response);
      
      // Notify admin that customer authentication is required
      await notifyAdminRequiresAction({
        businessId,
        userId,
        bookingId: params.id,
        action: 'no-show',
        amountCents,
        paymentIntentId,
        customerEmail: booking.customers?.email,
        customerName: booking.customers?.name,
      });
      
      await logBookingActionMetric({
        action: 'no-show',
        status: 'requires_action',
        bookingId: params.id,
        businessId,
        userId,
        amountCents,
        paymentIntentId,
        durationMs: Date.now() - startTime,
      });
      
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
        message: 'Payment could not be processed. Booking marked as no-show, but fee charge failed.',
        booking_status: 'no_show',
      };

      actionStatus = 'failed';
      amountCents = feeAmountCents;
      paymentIntentId = paymentIntentId;
      errorMessage = 'Payment could not be processed';

      await storeIdempotency(userId, route, idempotencyKey, response);
      
      await logBookingActionMetric({
        action: 'no-show',
        status: 'failed',
        bookingId: params.id,
        businessId,
        userId,
        amountCents,
        paymentIntentId,
        errorMessage,
        durationMs: Date.now() - startTime,
      });
      
      return NextResponse.json(response, { status: 402 });
    }
  } catch (error) {
    console.error('Error in no-show booking:', error);
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log metric if we have minimum required info
    if (userId && businessId) {
      await logBookingActionMetric({
        action: 'no-show',
        status: 'failed',
        bookingId: params.id,
        businessId,
        userId,
        amountCents,
        paymentIntentId,
        errorMessage,
        durationMs: Date.now() - startTime,
      });
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}


