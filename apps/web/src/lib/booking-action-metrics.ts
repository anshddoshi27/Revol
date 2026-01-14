import { createAdminClient } from './db';

export type BookingActionType = 'complete' | 'no-show' | 'cancel' | 'refund';
export type BookingActionStatus = 'success' | 'failed' | 'requires_action' | 'no_payment_method' | 'invalid_state';

export interface BookingActionMetric {
  action: BookingActionType;
  status: BookingActionStatus;
  bookingId: string;
  businessId: string;
  userId: string;
  amountCents?: number;
  errorMessage?: string;
  paymentIntentId?: string;
  durationMs?: number;
}

/**
 * Log booking action metrics for monitoring and analytics
 * This helps track success/failure rates by action type
 */
export async function logBookingActionMetric(metric: BookingActionMetric): Promise<void> {
  try {
    const supabase = createAdminClient();
    
    // Log to console with structured format for easy filtering
    const logMessage = `[booking-action-metric] ${metric.action} | ${metric.status} | booking: ${metric.bookingId} | business: ${metric.businessId}`;
    
    if (metric.status === 'success') {
      console.log(`${logMessage} | amount: $${((metric.amountCents || 0) / 100).toFixed(2)} | duration: ${metric.durationMs}ms`);
    } else if (metric.status === 'requires_action') {
      console.warn(`${logMessage} | REQUIRES_ACTION - Customer authentication needed | payment_intent: ${metric.paymentIntentId}`);
    } else {
      console.error(`${logMessage} | error: ${metric.errorMessage || 'unknown'}`);
    }
    
    // Store metrics in database for analytics (optional - can be implemented later)
    // For now, we're just logging to console. In production, you might want to:
    // 1. Create a booking_action_metrics table
    // 2. Store metrics there for analytics dashboard
    // 3. Set up alerts for high failure rates
    
    // Example database insertion (commented out until table exists):
    /*
    await supabase.from('booking_action_metrics').insert({
      action: metric.action,
      status: metric.status,
      booking_id: metric.bookingId,
      business_id: metric.businessId,
      user_id: metric.userId,
      amount_cents: metric.amountCents || null,
      error_message: metric.errorMessage || null,
      payment_intent_id: metric.paymentIntentId || null,
      duration_ms: metric.durationMs || null,
      created_at: new Date().toISOString(),
    });
    */
  } catch (error) {
    // Don't let metrics logging fail the main operation
    console.error('[booking-action-metrics] Error logging metric (non-fatal):', error);
  }
}

/**
 * Notify admin/business owner when booking action requires customer authentication
 * This alerts the admin that they need to send a payment link to the customer
 */
export async function notifyAdminRequiresAction(params: {
  businessId: string;
  userId: string;
  bookingId: string;
  action: BookingActionType;
  amountCents: number;
  paymentIntentId: string;
  customerEmail?: string;
  customerName?: string;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    
    // Get business owner email for admin notification
    const { data: business } = await supabase
      .from('businesses')
      .select('user_id, name, support_email')
      .eq('id', params.businessId)
      .single();
    
    if (!business) {
      console.error(`[admin-notification] Business ${params.businessId} not found`);
      return;
    }
    
    // Get business owner user email
    const { data: owner } = await supabase
      .from('users')
      .select('email')
      .eq('id', business.user_id)
      .single();
    
    const adminEmail = business.support_email || owner?.email;
    
    if (!adminEmail) {
      console.warn(`[admin-notification] No email found for business owner of ${params.businessId}`);
      return;
    }
    
    // Log admin notification (for now - can be expanded to send email/SMS later)
    const actionLabels: Record<BookingActionType, string> = {
      'complete': 'Complete booking',
      'no-show': 'No-show fee',
      'cancel': 'Cancellation fee',
      'refund': 'Refund',
    };
    
    console.warn(
      `[admin-notification] REQUIRES_ACTION: ${actionLabels[params.action]} for booking ${params.bookingId}\n` +
      `  Business: ${business.name} (${params.businessId})\n` +
      `  Admin Email: ${adminEmail}\n` +
      `  Amount: $${(params.amountCents / 100).toFixed(2)}\n` +
      `  Payment Intent: ${params.paymentIntentId}\n` +
      `  Customer: ${params.customerName || 'Unknown'} (${params.customerEmail || 'No email'})\n` +
      `  Action Required: Send payment authentication link to customer`
    );
    
    // TODO: In the future, you can:
    // 1. Send email to admin with payment link
    // 2. Create in-app notification for admin
    // 3. Use the notification system to send admin alert
    // For now, comprehensive logging serves as the notification mechanism
    
  } catch (error) {
    // Don't let notification failure block the main operation
    console.error('[admin-notification] Error sending admin notification (non-fatal):', error);
  }
}
