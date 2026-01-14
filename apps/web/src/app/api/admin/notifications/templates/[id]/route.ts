import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import { validatePlaceholders, ALLOWED_PLACEHOLDERS } from '@/lib/notifications';

/**
 * PUT /api/admin/notifications/templates/[id]
 * 
 * Update an existing notification template
 * 
 * Body: {
 *   name?: string
 *   channel?: 'email' | 'sms'
 *   category?: string
 *   trigger?: string
 *   subject?: string
 *   body?: string
 *   is_enabled?: boolean
 * }
 */
export async function PUT(
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

    const body = await request.json();
    const { name, channel, category, trigger, subject, body: bodyText, is_enabled } = body;

    const supabase = await createServerClient();

    // Verify template exists and belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Validate channel if provided
    if (channel && channel !== 'email' && channel !== 'sms') {
      return NextResponse.json(
        { error: 'channel must be "email" or "sms"' },
        { status: 400 }
      );
    }

    // Validate trigger if provided
    if (trigger) {
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
    }

    // Validate placeholders if body is provided
    if (bodyText !== undefined) {
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
    }

    if (subject !== undefined) {
      const subjectValidation = validatePlaceholders(subject || '');
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

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (channel !== undefined) updateData.channel = channel;
    if (category !== undefined) updateData.category = category;
    if (trigger !== undefined) updateData.trigger = trigger;
    if (subject !== undefined) updateData.subject = subject || null;
    if (bodyText !== undefined) updateData.body_markdown = bodyText;
    if (is_enabled !== undefined) updateData.is_enabled = is_enabled;

    // Ensure email templates have subject
    const finalChannel = channel || existing.channel;
    if (finalChannel === 'email' && !subject && !existing.subject) {
      return NextResponse.json(
        { error: 'subject is required for email templates' },
        { status: 400 }
      );
    }

    const { data: template, error: updateError } = await supabase
      .from('notification_templates')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating template:', updateError);
      return NextResponse.json(
        { error: 'Failed to update template', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      template,
      message: 'Template updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT template:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/notifications/templates/[id]
 * 
 * Soft delete a notification template
 */
export async function DELETE(
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

    const supabase = await createServerClient();

    // Verify template exists
    const { data: existing, error: fetchError } = await supabase
      .from('notification_templates')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('notification_templates')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('user_id', userId)
      .eq('business_id', businessId);

    if (deleteError) {
      console.error('Error deleting template:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete template', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE template:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



