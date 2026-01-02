import { createServerClient, createAdminClient } from './db';
import { formatInTimeZone } from './timezone';
import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationTrigger = 
  | 'booking_created'
  | 'booking_confirmed'
  | 'reminder_24h'
  | 'reminder_1h'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'booking_completed'
  | 'fee_charged'
  | 'refunded'
  | 'payment_issue';

export interface NotificationData {
  booking?: {
    id: string;
    start_at: string;
    end_at?: string;
    final_price_cents?: number;
    price_cents?: number;
    staff_id?: string;
    status?: string;
  };
  customer?: {
    name: string;
    email: string;
    phone?: string;
  };
  service?: {
    name: string;
    duration_min: number;
    price_cents: number;
  };
  staff?: {
    name: string;
  };
  business?: {
    name: string;
    support_email?: string;
    phone?: string;
    subdomain?: string;
    timezone?: string;
  };
  booking_url?: string;
  amount?: number; // For fee_charged and refunded triggers
}

// Allowed placeholders per the spec
export const ALLOWED_PLACEHOLDERS = [
  'customer.name',
  'customer.email',
  'customer.phone',
  'service.name',
  'service.duration',
  'service.price',
  'staff.name',
  'booking.code',
  'booking.date',
  'booking.time',
  'booking.amount',
  'business.name',
  'business.phone',
  'business.support_email',
  'booking.url',
];

/**
 * Validate that template only contains allowed placeholders
 */
export function validatePlaceholders(template: string): { valid: boolean; invalid: string[] } {
  const placeholderRegex = /\$\{([^}]+)\}/g;
  const matches = Array.from(template.matchAll(placeholderRegex));
  const foundPlaceholders = matches.map(m => m[1]);
  const invalid = foundPlaceholders.filter(p => !ALLOWED_PLACEHOLDERS.includes(p));
  
  return {
    valid: invalid.length === 0,
    invalid,
  };
}

/**
 * Render a notification template by substituting placeholders
 * Supports timezone-aware date/time formatting
 */
export function renderTemplate(template: string, data: NotificationData, timezone?: string): string {
  let rendered = template;
  const tz = timezone || data.business?.timezone || 'America/New_York';

  // Replace placeholders with actual values
  if (data.customer) {
    rendered = rendered.replace(/\$\{customer\.name\}/g, data.customer.name || '');
    rendered = rendered.replace(/\$\{customer\.email\}/g, data.customer.email || '');
    rendered = rendered.replace(/\$\{customer\.phone\}/g, data.customer.phone || '');
  }

  if (data.service) {
    rendered = rendered.replace(/\$\{service\.name\}/g, data.service.name || '');
    rendered = rendered.replace(/\$\{service\.duration\}/g, String(data.service.duration_min || 0));
    rendered = rendered.replace(/\$\{service\.price\}/g, formatPrice(data.service.price_cents || 0));
  }

  if (data.staff) {
    rendered = rendered.replace(/\$\{staff\.name\}/g, data.staff.name || '');
  }

  if (data.booking) {
    const startDate = new Date(data.booking.start_at);
    rendered = rendered.replace(/\$\{booking\.date\}/g, formatDate(startDate, tz));
    rendered = rendered.replace(/\$\{booking\.time\}/g, formatTime(startDate, tz));
    rendered = rendered.replace(/\$\{booking\.code\}/g, `REVOL-${data.booking.id?.slice(0, 8).toUpperCase() || ''}`);
    
    // booking.amount uses final_price_cents if available, otherwise price_cents
    const amount = data.booking.final_price_cents ?? data.booking.price_cents ?? 0;
    rendered = rendered.replace(/\$\{booking\.amount\}/g, formatPrice(amount));
  }

  if (data.business) {
    rendered = rendered.replace(/\$\{business\.name\}/g, data.business.name || '');
    rendered = rendered.replace(/\$\{business\.support_email\}/g, data.business.support_email || '');
    rendered = rendered.replace(/\$\{business\.phone\}/g, data.business.phone || '');
  }

  if (data.booking_url) {
    rendered = rendered.replace(/\$\{booking\.url\}/g, data.booking_url);
  } else if (data.business?.subdomain) {
    // Generate booking URL if not provided
    const bookingCode = data.booking?.id 
      ? `REVOL-${data.booking.id.slice(0, 8).toUpperCase()}`
      : '';
    const url = `https://${data.business.subdomain}.main.tld/confirm/${bookingCode}`;
    rendered = rendered.replace(/\$\{booking\.url\}/g, url);
  }

  // Handle amount placeholder for fee_charged and refunded
  if (data.amount !== undefined) {
    rendered = rendered.replace(/\$\{amount\}/g, formatPrice(data.amount));
  }

  return rendered;
}

/**
 * Enqueue a notification job
 * Uses unique constraint to prevent duplicate sends
 */
export async function enqueueNotification(params: {
  businessId: string;
  userId: string;
  bookingId?: string;
  trigger: string;
  recipientEmail?: string;
  recipientPhone?: string;
  templateId?: string;
  subject?: string;
  body: string;
  channel: 'email' | 'sms';
}): Promise<void> {
  const supabase = createAdminClient(); // Use admin client to bypass RLS for job insertion

  // Check for existing job with same booking_id, trigger, and channel (idempotency)
  if (params.bookingId) {
    const { data: existing } = await supabase
      .from('notification_jobs')
      .select('id')
      .eq('booking_id', params.bookingId)
      .eq('trigger', params.trigger)
      .eq('channel', params.channel)
      .limit(1)
      .single();

    if (existing) {
      // Job already exists, skip
      return;
    }
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('notification_jobs')
    .insert({
      user_id: params.userId,
      business_id: params.businessId,
      booking_id: params.bookingId || null,
      template_id: params.templateId || null,
      recipient_email: params.recipientEmail || null,
      recipient_phone: params.recipientPhone || null,
      subject: params.subject || null,
      body: params.body,
      channel: params.channel,
      trigger: params.trigger as any,
      status: 'pending',
      attempt_count: 0,
      scheduled_at: now,
      next_retry_at: null, // Will be set on first failure
      created_at: now,
    });

  if (error) {
    // If unique constraint violation, that's okay (idempotency)
    if (error.code === '23505') {
      return;
    }
    console.error('Error enqueueing notification:', error);
    throw error;
  }
}

/**
 * Load notification template for a trigger
 */
export async function loadTemplateForTrigger(
  businessId: string,
  userId: string,
  trigger: NotificationTrigger,
  channel: 'email' | 'sms',
  supabase?: SupabaseClient
): Promise<any | null> {
  const client = supabase || createAdminClient();

  const { data: template, error } = await client
    .from('notification_templates')
    .select('*')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .eq('trigger', trigger)
    .eq('channel', channel)
    .eq('is_enabled', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error loading template:', error);
    return null;
  }

  return template;
}

/**
 * Main function to emit a notification event
 * This loads booking data, resolves templates, and enqueues jobs
 * 
 * @param amount Optional amount in cents for fee_charged and refunded triggers
 */
export async function emitNotification(
  businessId: string,
  trigger: NotificationTrigger,
  bookingId: string,
  supabase?: SupabaseClient,
  amount?: number
): Promise<void> {
  // Check feature flag first - if notifications feature is disabled globally, skip all notifications
  const { getEffectiveNotificationsEnabled } = await import('./feature-flags');
  if (!getEffectiveNotificationsEnabled()) {
    console.log(`Skipping notification for business ${businessId} - Notifications feature disabled (v2)`);
    return;
  }

  const client = supabase || createAdminClient();

  // Check if notifications are enabled for this business
  const { data: business } = await client
    .from('businesses')
    .select('id, user_id, name, support_email, phone, subdomain, timezone, notifications_enabled')
    .eq('id', businessId)
    .single();

  if (!business) {
    console.error(`Business ${businessId} not found`);
    return;
  }

  // If notifications are disabled (Basic Plan), skip sending notifications
  // Basic Plan accounts only show booking confirmations, no SMS/email notifications
  if (business.notifications_enabled === false) {
    console.log(`Skipping notification for business ${businessId} - Basic Plan (notifications disabled)`);
    return;
  }

  const userId = business.user_id;

  // Load complete booking data with all relations
  const { data: booking, error: bookingError } = await client
    .from('bookings')
    .select(`
      *,
      customers:customer_id (
        id,
        name,
        email,
        phone
      ),
      services:service_id (
        id,
        name,
        duration_min,
        price_cents
      ),
      staff:staff_id (
        id,
        name
      )
    `)
    .eq('id', bookingId)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .single();

  if (bookingError || !booking) {
    console.error(`Booking ${bookingId} not found:`, bookingError);
    return;
  }

  // For fee_charged and refunded, load the latest payment amount if not provided
  let feeAmount = amount;
  if ((trigger === 'fee_charged' || trigger === 'refunded') && feeAmount === undefined) {
    const { data: latestPayment } = await client
      .from('booking_payments')
      .select('amount_cents')
      .eq('booking_id', bookingId)
      .in('money_action', trigger === 'fee_charged' ? ['no_show_fee', 'cancel_fee'] : ['refund'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestPayment) {
      feeAmount = latestPayment.amount_cents;
    }
  }

  // Build notification data
  const notificationData: NotificationData = {
    booking: {
      id: booking.id,
      start_at: booking.start_at,
      end_at: booking.end_at,
      final_price_cents: booking.final_price_cents,
      price_cents: booking.price_cents,
      staff_id: booking.staff_id,
      status: booking.status,
    },
    customer: booking.customers ? {
      name: booking.customers.name,
      email: booking.customers.email,
      phone: booking.customers.phone || undefined,
    } : undefined,
    service: booking.services ? {
      name: booking.services.name,
      duration_min: booking.services.duration_min,
      price_cents: booking.services.price_cents,
    } : undefined,
    staff: booking.staff ? {
      name: booking.staff.name,
    } : undefined,
    business: {
      name: business.name,
      support_email: business.support_email || undefined,
      phone: business.phone || undefined,
      subdomain: business.subdomain || undefined,
      timezone: business.timezone || 'America/New_York',
    },
    booking_url: business.subdomain 
      ? `https://${business.subdomain}.main.tld/confirm/REVOL-${booking.id.slice(0, 8).toUpperCase()}`
      : undefined,
    amount: feeAmount, // For fee_charged and refunded triggers
  };

  // Load templates for this trigger
  // NOTE: SMS notifications disabled for v1 - only email notifications are enabled
  const emailTemplate = await loadTemplateForTrigger(businessId, userId, trigger, 'email', client);
  // const smsTemplate = await loadTemplateForTrigger(businessId, userId, trigger, 'sms', client); // Disabled for v1

  const timezone = business.timezone || 'America/New_York';

  // Log if template is missing (for debugging)
  if (!emailTemplate) {
    console.log(`[notifications] No email template found for business ${businessId}, trigger ${trigger}. Email will not be sent.`);
    console.log(`[notifications] Make sure a template exists with: business_id=${businessId}, trigger=${trigger}, channel=email, is_enabled=true`);
  } else {
    console.log(`[notifications] Found email template: ${emailTemplate.id} (${emailTemplate.name}), enabled: ${emailTemplate.is_enabled}`);
  }

  // Send email notification if template exists and customer has email
  if (emailTemplate && notificationData.customer?.email) {
    const renderedBody = renderTemplate(emailTemplate.body_markdown, notificationData, timezone);
    const renderedSubject = emailTemplate.subject
      ? renderTemplate(emailTemplate.subject, notificationData, timezone)
      : undefined;

    // For booking_created trigger, send immediately instead of queuing
    // This ensures customers get confirmation emails right away
    if (trigger === 'booking_created' && renderedSubject) {
      console.log(`[notifications] Sending booking_created email immediately to ${notificationData.customer.email}`);
      try {
        const { sendEmailViaSendGrid } = await import('./notification-senders');
        const emailResult = await sendEmailViaSendGrid(
          notificationData.customer.email,
          renderedSubject,
          renderedBody
        );

        if (emailResult.success) {
          console.log(`[notifications] Email sent successfully to ${notificationData.customer.email}, messageId: ${emailResult.messageId}`);
          // Also enqueue for audit trail
          await enqueueNotification({
            businessId,
            userId,
            bookingId,
            trigger,
            recipientEmail: notificationData.customer.email,
            templateId: emailTemplate.id,
            subject: renderedSubject,
            body: renderedBody,
            channel: 'email',
          });
          // Mark the queued job as sent immediately
          const adminSupabase = createAdminClient();
          const { data: jobs } = await adminSupabase
            .from('notification_jobs')
            .select('id')
            .eq('booking_id', bookingId)
            .eq('trigger', trigger)
            .eq('channel', 'email')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (jobs && jobs.length > 0) {
            await adminSupabase
              .from('notification_jobs')
              .update({ status: 'sent' })
              .eq('id', jobs[0].id);
          }
        } else {
          console.error(`[notifications] Failed to send email: ${emailResult.error}`);
          // Fall back to queuing if immediate send fails
          await enqueueNotification({
            businessId,
            userId,
            bookingId,
            trigger,
            recipientEmail: notificationData.customer.email,
            templateId: emailTemplate.id,
            subject: renderedSubject,
            body: renderedBody,
            channel: 'email',
          });
        }
      } catch (error) {
        console.error(`[notifications] Error sending email immediately:`, error);
        // Fall back to queuing if immediate send fails
        await enqueueNotification({
          businessId,
          userId,
          bookingId,
          trigger,
          recipientEmail: notificationData.customer.email,
          templateId: emailTemplate.id,
          subject: renderedSubject,
          body: renderedBody,
          channel: 'email',
        });
      }
    } else {
      // For other triggers, queue as normal
      console.log(`[notifications] Enqueueing email notification for booking ${bookingId} to ${notificationData.customer.email}`);
      await enqueueNotification({
        businessId,
        userId,
        bookingId,
        trigger,
        recipientEmail: notificationData.customer.email,
        templateId: emailTemplate.id,
        subject: renderedSubject,
        body: renderedBody,
        channel: 'email',
      });
    }
  }

  // SMS notifications disabled for v1 - will be enabled in v2
  // Enqueue SMS notification if template exists and customer has phone
  // if (smsTemplate && notificationData.customer?.phone) {
  //   const renderedBody = renderTemplate(smsTemplate.body_markdown, notificationData, timezone);
  //
  //   await enqueueNotification({
  //     businessId,
  //     userId,
  //     bookingId,
  //     trigger,
  //     recipientPhone: notificationData.customer.phone,
  //     templateId: smsTemplate.id,
  //     body: renderedBody,
  //     channel: 'sms',
  //   });
  // }
}

/**
 * Create notification job from template and data (legacy function, use emitNotification)
 */
export async function createNotificationFromTemplate(params: {
  businessId: string;
  userId: string;
  bookingId?: string;
  trigger: NotificationTrigger;
  data: NotificationData;
}): Promise<void> {
  const { businessId, userId, bookingId, trigger, data } = params;

  if (!bookingId) {
    console.error('createNotificationFromTemplate requires bookingId');
    return;
  }

  // Use the main emitNotification function
  await emitNotification(businessId, trigger, bookingId);
}

// Helper functions
function formatDate(date: Date, timezone: string): string {
  return formatInTimeZone(date.toISOString(), timezone, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(date: Date, timezone: string): string {
  return formatInTimeZone(date.toISOString(), timezone, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}


