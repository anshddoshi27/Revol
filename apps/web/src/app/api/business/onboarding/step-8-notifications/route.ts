import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import type { NotificationTemplate } from '@/lib/onboarding-types';

/**
 * PUT /api/business/onboarding/step-8-notifications
 * 
 * Updates notification templates and notifications_enabled flag
 * 
 * Body: {
 *   templates: NotificationTemplate[]
 *   notifications_enabled: boolean
 * }
 */
export async function PUT(request: Request) {
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
        { error: 'Business not found. Complete step 1 first.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { templates, notifications_enabled } = body;

    if (!Array.isArray(templates)) {
      return NextResponse.json(
        { error: 'templates must be an array' },
        { status: 400 }
      );
    }

    if (typeof notifications_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'notifications_enabled must be a boolean' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Soft delete existing templates
    const { error: deleteError } = await supabase
      .from('notification_templates')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null);

    if (deleteError) {
      console.error('Error soft-deleting templates:', deleteError);
      // Continue anyway
    }

    if (templates.length === 0) {
      return NextResponse.json({
        success: true,
        templateIds: [],
        message: 'Notification templates cleared',
      });
    }

    const templatesToInsert = templates.map((template: NotificationTemplate) => ({
      id: template.id && template.id.startsWith('uuid-') ? undefined : template.id,
      user_id: userId,
      business_id: businessId,
      name: template.name,
      channel: template.channel, // 'email' | 'sms'
      category: template.category,
      trigger: template.trigger,
      subject: template.subject || null,
      body_markdown: template.body,
      is_enabled: template.enabled !== false, // Default to true
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { data: insertedTemplates, error: insertError } = await supabase
      .from('notification_templates')
      .upsert(templatesToInsert, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (insertError) {
      console.error('Error upserting templates:', insertError);
      return NextResponse.json(
        { error: 'Failed to save notification templates', details: insertError.message },
        { status: 500 }
      );
    }

    const templateIds = insertedTemplates?.map(t => t.id) || [];

    // Update notifications_enabled flag in businesses table
    const { error: businessUpdateError } = await supabase
      .from('businesses')
      .update({
        notifications_enabled: notifications_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId)
      .eq('user_id', userId);

    if (businessUpdateError) {
      console.error('Error updating notifications_enabled:', businessUpdateError);
      return NextResponse.json(
        { error: 'Failed to update notifications_enabled', details: businessUpdateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templateIds,
      notifications_enabled,
      message: `Saved ${templateIds.length} notification template(s) and notifications_enabled=${notifications_enabled}`,
    });
  } catch (error) {
    console.error('Error in step-8-notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

