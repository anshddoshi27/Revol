import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import { checkIdempotency, storeIdempotency } from '@/lib/idempotency';
import { createPaymentIntent, getPaymentMethodFromSetupIntent, verifyConnectAccount } from '@/lib/stripe';
import { emitNotification } from '@/lib/notifications';
import { logBookingActionMetric, notifyAdminRequiresAction } from '@/lib/booking-action-metrics';

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
      // Log cached response as success (idempotent call)
      await logBookingActionMetric({
        action: 'complete',
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
      actionStatus = 'invalid_state';
      errorMessage = 'Booking is already completed';
      await logBookingActionMetric({
        action: 'complete',
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

    // Calculate amount FIRST (similar to fee-first logic for no-show/cancel)
    // This allows us to handle $0 bookings without requiring Stripe
    amountCents = booking.final_price_cents || booking.price_cents || 0;
    console.log(`[complete-booking] Calculating amount for booking ${booking.id}. Amount: $${(amountCents / 100).toFixed(2)} (${amountCents} cents)`);

    // If amount is $0, just update status without charging - no Stripe needed
    if (amountCents === 0) {
      console.log(`[complete-booking] Booking amount is $0, updating status without payment for booking ${booking.id}`);
      const { error: updateError, data: updatedRows } = await supabase
        .from('bookings')
        .update({
          status: 'completed',
          payment_status: 'none',
          last_money_action: 'completed_charge',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .select('id');

      if (updateError) {
        console.error('[complete-booking] Error updating booking status:', updateError);
        actionStatus = 'failed';
        errorMessage = 'Failed to update booking status';
        await logBookingActionMetric({
          action: 'complete',
          status: 'failed',
          bookingId: params.id,
          businessId,
          userId,
          amountCents: 0,
          errorMessage: updateError.message,
          durationMs: Date.now() - startTime,
        });
        return NextResponse.json(
          { error: errorMessage, details: updateError.message },
          { status: 500 }
        );
      }

      if (!updatedRows || updatedRows.length === 0) {
        console.error('[complete-booking] Booking update affected 0 rows. Booking may have been deleted or user/business mismatch.');
        actionStatus = 'failed';
        errorMessage = 'Booking not found or access denied';
        await logBookingActionMetric({
          action: 'complete',
          status: 'failed',
          bookingId: params.id,
          businessId,
          userId,
          amountCents: 0,
          errorMessage,
          durationMs: Date.now() - startTime,
        });
        return NextResponse.json(
          { error: errorMessage + '. Unable to update booking status.' },
          { status: 404 }
        );
      }

      console.log(`[complete-booking] Booking status updated successfully. Updated booking ID: ${updatedRows[0]?.id}`);

      actionStatus = 'success';
      amountCents = 0;

      const response = {
        status: 'COMPLETED',
        charge_amount: 0,
        currency: 'usd',
        message: 'Booking amount is $0.00. Booking marked as completed.',
        booking_status: 'completed',
      };

      try {
        await storeIdempotency(userId, route, idempotencyKey, response);
      } catch (idempotencyError) {
        console.error('[complete-booking] Error storing idempotency key (non-fatal):', idempotencyError);
      }

      await logBookingActionMetric({
        action: 'complete',
        status: 'success',
        bookingId: params.id,
        businessId,
        userId,
        amountCents: 0,
        durationMs: Date.now() - startTime,
      });

      return NextResponse.json(response);
    }

    // Amount > $0, so we need Stripe Connect account
    if (!booking.businesses?.stripe_connect_account_id) {
      actionStatus = 'failed';
      errorMessage = 'Business Stripe Connect account not configured';
      await logBookingActionMetric({
        action: 'complete',
        status: 'failed',
        bookingId: params.id,
        businessId,
        userId,
        amountCents,
        errorMessage,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: errorMessage + `. Booking amount is $${(amountCents / 100).toFixed(2)}. Please configure Stripe Connect account in business settings to charge customers.` },
        { status: 500 }
      );
    }

    // Verify Connect account has required capabilities before attempting charge
    const accountVerification = await verifyConnectAccount(booking.businesses.stripe_connect_account_id);
    if (!accountVerification.valid) {
      actionStatus = 'failed';
      errorMessage = accountVerification.error || 'Stripe Connect account not properly configured';
      await logBookingActionMetric({
        action: 'complete',
        status: 'failed',
        bookingId: params.id,
        businessId,
        userId,
        amountCents,
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
      actionStatus = 'no_payment_method';
      errorMessage = 'Customer does not have a Stripe customer ID';
      await logBookingActionMetric({
        action: 'complete',
        status: 'no_payment_method',
        bookingId: params.id,
        businessId,
        userId,
        amountCents,
        errorMessage,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: errorMessage + '. The booking may not have been created through the payment flow.' },
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
      console.error('Error querying booking payments:', paymentQueryError);
      return NextResponse.json(
        { error: 'Failed to check payment status', details: paymentQueryError.message },
        { status: 500 }
      );
    }

    if (!setupPayment?.stripe_setup_intent_id) {
      // Log all payment records for this booking to help debug
      const { data: allPayments } = await supabase
        .from('booking_payments')
        .select('id, status, stripe_setup_intent_id, money_action, created_at')
        .eq('booking_id', booking.id);
      
      console.error(`[complete-booking] No payment record with setup_intent_id found for booking ${booking.id}. All payment records:`, allPayments);
      
      actionStatus = 'no_payment_method';
      errorMessage = 'No saved payment method found for this booking';
      amountCents = booking.final_price_cents || booking.price_cents || 0;
      
      await logBookingActionMetric({
        action: 'complete',
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
          error: errorMessage + '. Please ensure the payment setup was completed during booking creation.',
          booking_id: booking.id,
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

    // Amount is already calculated above, but ensure it's valid
    if (isNaN(amountCents) || amountCents < 0) {
      console.warn(`[complete-booking] Invalid amount calculated (${amountCents}), defaulting to $0`);
      amountCents = 0;
    }

    // Platform fee (1% of amount)
    const platformFeeCents = Math.round(amountCents * 0.01);

    // Create PaymentIntent (off-session charge for saved card)
    let paymentIntentIdLocal: string;
    let clientSecret: string | undefined;
    let paymentStatus: string;
    let requiresAction: boolean;
    
    try {
      const paymentResult = await createPaymentIntent({
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
      
        paymentIntentIdLocal = paymentResult.paymentIntentId;
        paymentIntentId = paymentResult.paymentIntentId;
        clientSecret = paymentResult.clientSecret;
        paymentStatus = paymentResult.status;
        requiresAction = paymentResult.requiresAction || false;
    } catch (stripeError) {
      console.error('[complete-booking] Error creating PaymentIntent:', stripeError);
      
      // Extract more detailed error information from Stripe error
      let errorDetails = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
      let userFriendlyError = 'Failed to create payment intent for booking completion';
      
      // Check for common Stripe Connect account errors
      if (errorDetails.includes('transfers') || errorDetails.includes('crypto_transfers') || errorDetails.includes('legacy_payments')) {
        userFriendlyError = 'Stripe Connect account does not have transfers capability enabled. Please complete account setup in Stripe Dashboard to enable payment transfers.';
      } else if (errorDetails.includes('destination') || errorDetails.includes('account')) {
        userFriendlyError = 'Stripe Connect account configuration issue. Please verify your Stripe Connect account is properly set up and has all required capabilities enabled.';
      }
      
      actionStatus = 'failed';
      errorMessage = userFriendlyError;
      
      await logBookingActionMetric({
        action: 'complete',
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
      try {
        // Payment succeeded - create booking payment record
        console.log(`[complete-booking] Payment succeeded for booking ${booking.id}, creating payment record...`);
        const { error: paymentError, data: insertedPayment } = await supabase
          .from('booking_payments')
          .insert({
            user_id: userId,
            business_id: businessId,
            booking_id: booking.id,
            stripe_payment_intent_id: paymentIntentIdLocal,
            amount_cents: amountCents,
            money_action: 'completed_charge',
            status: 'charged',
            application_fee_cents: platformFeeCents,
            net_amount_cents: amountCents - platformFeeCents,
            currency: 'usd',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select();

        if (paymentError) {
          console.error('[complete-booking] Error creating payment record:', paymentError);
          console.error('[complete-booking] Payment record insert details:', {
            user_id: userId,
            business_id: businessId,
            booking_id: booking.id,
            stripe_payment_intent_id: paymentIntentId,
            amount_cents: amountCents,
          });
          return NextResponse.json(
            { error: 'Failed to record payment', details: paymentError.message },
            { status: 500 }
          );
        }

        console.log(`[complete-booking] Payment record created successfully:`, insertedPayment?.[0]?.id || 'no id returned');

        // Update booking status
        console.log(`[complete-booking] Updating booking status to completed for booking ${booking.id}...`);
        const { error: updateError, data: updatedRows } = await supabase
          .from('bookings')
          .update({
            status: 'completed',
            payment_status: 'charged',
            last_money_action: 'completed_charge',
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.id)
          .eq('user_id', userId)
          .eq('business_id', businessId)
          .is('deleted_at', null)
          .select('id');

        if (updateError) {
          console.error('[complete-booking] Error updating booking status:', updateError);
          console.error('[complete-booking] Update details:', {
            booking_id: booking.id,
            user_id: userId,
            business_id: businessId,
            status: 'completed',
            payment_status: 'charged',
          });
          return NextResponse.json(
            { error: 'Failed to update booking status', details: updateError.message },
            { status: 500 }
          );
        }

        if (!updatedRows || updatedRows.length === 0) {
          console.error('[complete-booking] Booking update affected 0 rows. Booking may have been deleted or user/business mismatch.');
          return NextResponse.json(
            { error: 'Booking not found or access denied. Unable to update booking status.' },
            { status: 404 }
          );
        }

        console.log(`[complete-booking] Booking status updated successfully. Updated booking ID: ${updatedRows[0]?.id}`);

        // Emit booking_completed notification (async, don't wait)
        emitNotification(businessId, 'booking_completed', booking.id, supabase).catch((err) => {
          console.error('Error emitting booking_completed notification:', err);
        });

        // Handle gift card balance deduction (if amount-type gift card was used)
        // Only deduct when payment succeeds - per spec: "no money moves until charge succeeds"
        // Wrap in try-catch so gift card errors don't fail the entire operation
        if (booking.gift_card_id && booking.gift_card_amount_applied_cents > 0) {
          try {
            const { data: giftCard, error: giftCardError } = await supabase
              .from('gift_cards')
              .select('discount_type, current_balance_cents')
              .eq('id', booking.gift_card_id)
              .single();

            if (giftCardError) {
              console.error('Error fetching gift card for deduction:', giftCardError);
              // Continue anyway - gift card deduction is secondary to payment completion
            } else if (giftCard && giftCard.discount_type === 'amount') {
              // Deduct from balance and write ledger
              const newBalance = Math.max(0, giftCard.current_balance_cents - booking.gift_card_amount_applied_cents);

              const { error: giftUpdateError } = await supabase
                .from('gift_cards')
                .update({
                  current_balance_cents: newBalance,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', booking.gift_card_id);

              if (giftUpdateError) {
                console.error('Error updating gift card balance:', giftUpdateError);
                // Continue anyway
              }

              const { error: ledgerError } = await supabase
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

              if (ledgerError) {
                console.error('Error creating gift card ledger entry:', ledgerError);
                // Continue anyway - ledger is for audit, payment is what matters
              }
            }
          } catch (giftCardErr) {
            console.error('Error processing gift card deduction:', giftCardErr);
            // Continue anyway - gift card is secondary to payment completion
          }
        }

        // Return success response with updated booking status
        const response = {
          status: 'CHARGED',
          charge_amount: amountCents,
          currency: 'usd',
          stripe_payment_intent_id: paymentIntentIdLocal,
          receipt_url: `https://dashboard.stripe.com/payments/${paymentIntentIdLocal}`,
          booking_status: 'completed',
        };

        // Store idempotency - wrap in try-catch so idempotency errors don't fail the response
        try {
          await storeIdempotency(userId, route, idempotencyKey, response);
        } catch (idempotencyError) {
          console.error('Error storing idempotency key (non-fatal):', idempotencyError);
          // Continue anyway - idempotency is for preventing duplicates, payment already succeeded
        }

        actionStatus = 'success';
        paymentIntentId = paymentIntentIdLocal;

        await logBookingActionMetric({
          action: 'complete',
          status: 'success',
          bookingId: params.id,
          businessId,
          userId,
          amountCents,
          paymentIntentId,
          durationMs: Date.now() - startTime,
        });

        console.log(`[complete-booking] Returning success response for booking ${booking.id}`);
        return NextResponse.json(response);
      } catch (dbError) {
        console.error('[complete-booking] Unexpected error during payment record/status update:', dbError);
        console.error('[complete-booking] Error stack:', dbError instanceof Error ? dbError.stack : 'No stack trace');
        return NextResponse.json(
          { 
            error: 'Failed to complete booking after payment',
            details: dbError instanceof Error ? dbError.message : 'Unknown database error'
          },
          { status: 500 }
        );
      }
    } else if (requiresAction || paymentStatus === 'requires_action' || paymentStatus === 'requires_payment_method') {
      // Payment requires customer action (3DS, etc.)
      // Store payment intent but mark as pending
      const { error: paymentInsertError } = await supabase
        .from('booking_payments')
        .insert({
          user_id: userId,
          business_id: businessId,
          booking_id: booking.id,
          stripe_payment_intent_id: paymentIntentIdLocal,
          amount_cents: amountCents,
          money_action: 'completed_charge',
          status: 'charge_pending',
          application_fee_cents: platformFeeCents,
          net_amount_cents: amountCents - platformFeeCents,
          currency: 'usd',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (paymentInsertError) {
        console.error('[complete-booking] Error inserting payment record for requires_action:', paymentInsertError);
        // Continue anyway - we can still return the response
      }

      const { error: bookingUpdateError } = await supabase
        .from('bookings')
        .update({
          payment_status: 'charge_pending',
          last_money_action: 'completed_charge',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (bookingUpdateError) {
        console.error('[complete-booking] Error updating booking for requires_action:', bookingUpdateError);
        // Continue anyway
      }

      actionStatus = 'requires_action';
      paymentIntentId = paymentIntentIdLocal;

      const response = {
        status: 'REQUIRES_ACTION',
        charge_amount: amountCents,
        currency: 'usd',
        stripe_payment_intent_id: paymentIntentIdLocal,
        client_secret: clientSecret,
        message: 'Payment requires customer authentication. Send payment link to customer.',
        booking_status: 'pending',
      };

      try {
        await storeIdempotency(userId, route, idempotencyKey, response);
      } catch (idempotencyError) {
        console.error('Error storing idempotency key for requires_action (non-fatal):', idempotencyError);
      }

      // Notify admin that customer authentication is required
      await notifyAdminRequiresAction({
        businessId,
        userId,
        bookingId: params.id,
        action: 'complete',
        amountCents,
        paymentIntentId: paymentIntentIdLocal,
        customerEmail: booking.customers?.email,
        customerName: booking.customers?.name,
      });

      await logBookingActionMetric({
        action: 'complete',
        status: 'requires_action',
        bookingId: params.id,
        businessId,
        userId,
        amountCents,
        paymentIntentId: paymentIntentIdLocal,
        durationMs: Date.now() - startTime,
      });

      return NextResponse.json(response);
    } else {
      // Payment failed
      const { error: paymentInsertError } = await supabase
        .from('booking_payments')
        .insert({
          user_id: userId,
          business_id: businessId,
          booking_id: booking.id,
          stripe_payment_intent_id: paymentIntentIdLocal,
          amount_cents: amountCents,
          money_action: 'completed_charge',
          status: 'failed',
          currency: 'usd',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (paymentInsertError) {
        console.error('[complete-booking] Error inserting payment record for failed payment:', paymentInsertError);
      }

      const { error: bookingUpdateError } = await supabase
        .from('bookings')
        .update({
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (bookingUpdateError) {
        console.error('[complete-booking] Error updating booking for failed payment:', bookingUpdateError);
      }

      actionStatus = 'failed';
      paymentIntentId = paymentIntentIdLocal;
      errorMessage = 'Payment could not be processed';

      const errorResponse = {
        error: 'Payment failed',
        status: 'FAILED',
        charge_amount: amountCents,
        currency: 'usd',
        stripe_payment_intent_id: paymentIntentIdLocal,
        message: 'Payment could not be processed. Please try again or contact customer.',
      };

      try {
        await storeIdempotency(userId, route, idempotencyKey, errorResponse);
      } catch (idempotencyError) {
        console.error('Error storing idempotency key for failed payment (non-fatal):', idempotencyError);
      }

      await logBookingActionMetric({
        action: 'complete',
        status: 'failed',
        bookingId: params.id,
        businessId,
        userId,
        amountCents,
        paymentIntentId: paymentIntentIdLocal,
        errorMessage,
        durationMs: Date.now() - startTime,
      });

      return NextResponse.json(errorResponse, { status: 402 });
    }
  } catch (error) {
    console.error('Error in complete booking:', error);
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log metric if we have minimum required info
    if (userId && businessId) {
      await logBookingActionMetric({
        action: 'complete',
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


