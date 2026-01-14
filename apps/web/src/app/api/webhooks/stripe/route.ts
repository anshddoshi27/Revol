import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';

/**
 * POST /api/webhooks/stripe
 * 
 * Handles Stripe webhook events
 * 
 * Events handled:
 * - customer.subscription.updated
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 * - charge.refunded
 * - setup_intent.succeeded
 */
export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient(); // Use admin client to bypass RLS for webhooks

  try {
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const metadata = subscription.metadata;

        if (metadata.business_id || metadata.user_id) {
          // For trial subscriptions, next_bill_at is trial_end; otherwise current_period_end
          const nextBillAt = subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null;

          const isCanceled = subscription.status === 'canceled' || subscription.status === 'unpaid';
          
          // Map Stripe subscription status to our app status
          let subscriptionStatus = 'trial';
          if (subscription.status === 'active') {
            subscriptionStatus = 'active';
          } else if (subscription.status === 'trialing') {
            subscriptionStatus = 'trial';
          } else if (subscription.status === 'past_due') {
            subscriptionStatus = 'paused'; // Past due is treated as paused
          } else if (isCanceled) {
            subscriptionStatus = 'canceled';
          } else if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
            subscriptionStatus = 'trial'; // Incomplete = still in trial until payment method added
          }
          
          const updateData: any = {
            subscription_status: subscriptionStatus,
            next_bill_at: nextBillAt,
            trial_ends_at: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          };

          // If canceled, deprovision subdomain
          if (isCanceled) {
            const { data: business } = await supabase
              .from('businesses')
              .select('subdomain')
              .or(
                metadata.business_id
                  ? `id.eq.${metadata.business_id}`
                  : `user_id.eq.${metadata.user_id}`
              )
              .single();

            if (business?.subdomain) {
              // Deprovision subdomain on cancel
              updateData.subdomain = null;
            }
          }

          await supabase
            .from('businesses')
            .update(updateData)
            .or(
              metadata.business_id
                ? `id.eq.${metadata.business_id}`
                : `user_id.eq.${metadata.user_id}`
            );
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = typeof invoice.subscription === 'string'
            ? await getStripeClient().subscriptions.retrieve(invoice.subscription)
            : invoice.subscription;

          const metadata = subscription.metadata;
          if (metadata.business_id || metadata.user_id) {
            const nextBillAt = subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null;

            await supabase
              .from('businesses')
              .update({
                subscription_status: 'active',
                next_bill_at: nextBillAt,
                updated_at: new Date().toISOString(),
              })
              .or(
                metadata.business_id
                  ? `id.eq.${metadata.business_id}`
                  : `user_id.eq.${metadata.user_id}`
              );
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = typeof invoice.subscription === 'string'
            ? await getStripeClient().subscriptions.retrieve(invoice.subscription)
            : invoice.subscription;

          const metadata = subscription.metadata;
          if (metadata.business_id || metadata.user_id) {
            const nextBillAt = subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null;

            await supabase
              .from('businesses')
              .update({
                subscription_status: 'past_due',
                next_bill_at: nextBillAt,
                updated_at: new Date().toISOString(),
              })
              .or(
                metadata.business_id
                  ? `id.eq.${metadata.business_id}`
                  : `user_id.eq.${metadata.user_id}`
              );
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const metadata = paymentIntent.metadata;

        if (metadata.booking_id) {
          // Update booking payment status
          await supabase
            .from('booking_payments')
            .update({
              status: 'charged',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_payment_intent_id', paymentIntent.id);

          // Update booking status
          const moneyAction = metadata.money_action as string;
          if (moneyAction === 'completed_charge') {
            await supabase
              .from('bookings')
              .update({
                status: 'completed',
                payment_status: 'charged',
                last_money_action: 'completed_charge',
                updated_at: new Date().toISOString(),
              })
              .eq('id', metadata.booking_id);
          } else if (moneyAction === 'no_show_fee') {
            await supabase
              .from('bookings')
              .update({
                status: 'no_show',
                payment_status: 'charged',
                last_money_action: 'no_show_fee',
                updated_at: new Date().toISOString(),
              })
              .eq('id', metadata.booking_id);
          } else if (moneyAction === 'cancel_fee') {
            await supabase
              .from('bookings')
              .update({
                status: 'cancelled',
                payment_status: 'charged',
                last_money_action: 'cancel_fee',
                updated_at: new Date().toISOString(),
              })
              .eq('id', metadata.booking_id);
          }

          // Update fees from Stripe balance transaction if available
          if (paymentIntent.latest_charge) {
            try {
              const charge = typeof paymentIntent.latest_charge === 'string'
                ? await getStripeClient().charges.retrieve(paymentIntent.latest_charge)
                : paymentIntent.latest_charge;

              if (charge.balance_transaction) {
                const balanceTransaction = typeof charge.balance_transaction === 'string'
                  ? await getStripeClient().balanceTransactions.retrieve(charge.balance_transaction)
                  : charge.balance_transaction;

                await supabase
                  .from('booking_payments')
                  .update({
                    stripe_fee_cents: balanceTransaction.fee,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('stripe_payment_intent_id', paymentIntent.id);
              }
            } catch (feeError) {
              console.error('Error fetching fee info:', feeError);
              // Continue - fees are optional
            }
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const metadata = paymentIntent.metadata;

        if (metadata.booking_id) {
          await supabase
            .from('booking_payments')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_payment_intent_id', paymentIntent.id);

          await supabase
            .from('bookings')
            .update({
              payment_status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', metadata.booking_id);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;

        if (paymentIntentId) {
          // Get payment record with booking info to get user_id and business_id
          const { data: payment } = await supabase
            .from('booking_payments')
            .select('booking_id, user_id, business_id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (payment && payment.user_id && payment.business_id) {
            // Create refund record
            const refund = (charge.refunds?.data || [])[0];
            if (refund) {
              // Check if refund record already exists
              const { data: existingRefund } = await supabase
                .from('booking_payments')
                .select('id')
                .eq('stripe_refund_id', refund.id)
                .single();

              if (!existingRefund) {
                await supabase
                  .from('booking_payments')
                  .insert({
                    user_id: payment.user_id,
                    business_id: payment.business_id,
                    booking_id: payment.booking_id,
                    stripe_refund_id: refund.id,
                    stripe_payment_intent_id: paymentIntentId,
                    amount_cents: refund.amount,
                    money_action: 'refund',
                    status: 'refunded',
                    currency: 'usd',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });

                await supabase
                  .from('bookings')
                  .update({
                    status: 'refunded',
                    payment_status: 'refunded',
                    last_money_action: 'refund',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', payment.booking_id);
              }
            }
          }
        }
        break;
      }

      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        const metadata = setupIntent.metadata;

        if (metadata.booking_id) {
          await supabase
            .from('booking_payments')
            .update({
              status: 'card_saved',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_setup_intent_id', setupIntent.id);

          await supabase
            .from('bookings')
            .update({
              payment_status: 'card_saved',
              updated_at: new Date().toISOString(),
            })
            .eq('id', metadata.booking_id);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


