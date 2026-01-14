import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import { validatePlaceholders, ALLOWED_PLACEHOLDERS } from '@/lib/notifications';

/**
 * GET /api/admin/notifications/templates
 * 
 * List all notification templates for the current business
 */
export async function GET() {
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

    const supabase = await createServerClient();

    const { data: templates, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch templates', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      templates: templates || [],
      allowed_placeholders: ALLOWED_PLACEHOLDERS,
    });
  } catch (error) {
    console.error('Error in GET templates:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/notifications/templates
 * 
 * Create a new notification template
 * 
 * Body: {
 *   name: string
 *   channel: 'email' | 'sms'
 *   category: 'confirmation' | 'reminder' | 'follow_up' | 'cancellation' | 'reschedule' | 'completion'
 *   trigger: NotificationTrigger
 *   subject?: string (required for email)
 *   body: string
 *   is_enabled?: boolean
 * }
 */
export async function POST(request: Request) {
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

    const body = await request.json();
    const { name, channel, category, trigger, subject, body: bodyText, is_enabled = true } = body;

    // Validation
    if (!name || !channel || !category || !trigger || !bodyText) {
      return NextResponse.json(
        { error: 'Missing required fields: name, channel, category, trigger, body' },
        { status: 400 }
      );
    }

    if (channel !== 'email' && channel !== 'sms') {
      return NextResponse.json(
        { error: 'channel must be "email" or "sms"' },
        { status: 400 }
      );
    }

    if (channel === 'email' && !subject) {
      return NextResponse.json(
        { error: 'subject is required for email templates' },
        { status: 400 }
      );
    }

    const validTriggers = [
      'booking_created',
      'booking_confirmed',
      'reminder_24h',
      'reminder_1h',
      'booking_cancelled',
      'booking_rescheduled',
      'booking_completed',
      'fee_charged',
      'refunded',
    ];
    if (!validTriggers.includes(trigger)) {
      return NextResponse.json(
        { error: `Invalid trigger. Must be one of: ${validTriggers.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate placeholders
    const placeholderValidation = validatePlaceholders(bodyText);
    if (!placeholderValidation.valid) {
      return NextResponse.json(
        { 
          error: 'Invalid placeholders found',
          invalid_placeholders: placeholderValidation.invalid,
          allowed_placeholders: ALLOWED_PLACEHOLDERS,
        },
        { status: 400 }
      );
    }

    if (subject) {
      const subjectValidation = validatePlaceholders(subject);
      if (!subjectValidation.valid) {
        return NextResponse.json(
          { 
            error: 'Invalid placeholders in subject',
            invalid_placeholders: subjectValidation.invalid,
            allowed_placeholders: ALLOWED_PLACEHOLDERS,
          },
          { status: 400 }
        );
      }
    }

    const supabase = await createServerClient();

    const { data: template, error } = await supabase
      .from('notification_templates')
      .insert({
        user_id: userId,
        business_id: businessId,
        name,
        channel,
        category,
        trigger,
        subject: subject || null,
        body_markdown: bodyText,
        is_enabled: is_enabled !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return NextResponse.json(
        { error: 'Failed to create template', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      template,
      message: 'Template created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST templates:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



