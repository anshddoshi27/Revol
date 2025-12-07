import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import type { NotificationTemplate } from '@/lib/onboarding-types';

/**
 * GET /api/business/onboarding/step-8-notifications
 * 
 * Retrieves notification templates and enabled flag
 */
export async function GET(request: Request) {
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
      // Default to Basic plan (false) - not Pro plan (true)
      return NextResponse.json(
        { templates: [], notificationsEnabled: false },
        { status: 200 }
      );
    }

    const supabase = await createServerClient();
    
    // Get templates
    const { data: templates, error: templatesError } = await supabase
      .from('notification_templates')
      .select('id, name, channel, category, trigger, subject, body_markdown, is_enabled')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (templatesError) {
      console.error('[step-8-notifications] Error fetching templates:', templatesError);
      return NextResponse.json(
        { error: 'Failed to fetch notifications data' },
        { status: 500 }
      );
    }

    // Get notifications_enabled flag
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('notifications_enabled')
      .eq('id', businessId)
      .eq('user_id', userId)
      .single();

    if (businessError) {
      console.error('[step-8-notifications] Error fetching business:', businessError);
    }

    const notificationTemplates: NotificationTemplate[] = (templates || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      channel: t.channel,
      category: t.category,
      trigger: t.trigger,
      subject: t.subject || undefined,
      body: t.body_markdown || '',
      enabled: t.is_enabled !== false,
    }));

    // Return the actual database value, defaulting to false (Basic plan) if null
    return NextResponse.json({
      templates: notificationTemplates,
      notificationsEnabled: business?.notifications_enabled === true, // Only true if explicitly true
    });
  } catch (error) {
    console.error('[step-8-notifications] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    // Log for debugging
    console.log('Step 8 notifications API called');
    
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('No user ID found - authentication failed');
      // Try to get more info about why auth failed
      const supabase = await createServerClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      console.error('Auth check result:', { user: user?.id, error });
      
      return NextResponse.json(
        { error: 'Unauthorized - Please log in and try again' },
        { status: 401 }
      );
    }
    
    console.log('User authenticated:', userId);

    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business not found. Complete step 1 first.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { templates, notifications_enabled } = body;

    // Log the received value for debugging
    console.log('[step-8-notifications] Received request body:', {
      notifications_enabled,
      notifications_enabled_type: typeof notifications_enabled,
      templates_count: Array.isArray(templates) ? templates.length : 'not an array',
      planType: notifications_enabled === false ? 'Basic ($11.99/month)' : 'Pro ($21.99/month)',
    });

    if (!Array.isArray(templates)) {
      return NextResponse.json(
        { error: 'templates must be an array' },
        { status: 400 }
      );
    }

    if (typeof notifications_enabled !== 'boolean') {
      console.error('[step-8-notifications] ERROR: notifications_enabled is not a boolean:', {
        value: notifications_enabled,
        type: typeof notifications_enabled,
      });
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
    // This determines the subscription plan:
    // - false = Basic Plan ($11.99/month) - no SMS/email notifications
    // - true = Pro Plan ($21.99/month) - SMS and email notifications enabled
    console.log('[step-8-notifications] BEFORE UPDATE - Current state:', {
      businessId,
      receivedValue: notifications_enabled,
      planType: notifications_enabled === false ? 'Basic ($11.99/month)' : 'Pro ($21.99/month)',
      valueType: typeof notifications_enabled,
    });
    
    // Always save the exact value received from frontend - no defaults, no fallbacks
    let updateError = null;
    let updateSuccessful = false;
    
    const { error: businessUpdateError } = await supabase
      .from('businesses')
      .update({
        notifications_enabled: notifications_enabled, // Use EXACT value from frontend
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId)
      .eq('user_id', userId);
    
    updateError = businessUpdateError;
    updateSuccessful = !businessUpdateError;
    
    console.log('[step-8-notifications] UPDATE RESULT:', {
      error: updateError?.message || null,
      updateSuccessful,
      attemptedValue: notifications_enabled,
    });

    // If RLS blocks the update, try with admin client
    if (businessUpdateError && (businessUpdateError.code === 'PGRST301' || businessUpdateError.message?.includes('No suitable key'))) {
      console.log('[step-8-notifications] RLS error, trying with admin client');
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      
      const { error: adminUpdateError } = await adminSupabase
        .from('businesses')
        .update({
          notifications_enabled: notifications_enabled, // Use EXACT value from frontend
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessId)
        .eq('user_id', userId);
      
      if (adminUpdateError) {
        console.error('[step-8-notifications] Admin client update also failed:', adminUpdateError);
        return NextResponse.json(
          { error: 'Failed to update notifications_enabled', details: adminUpdateError.message },
          { status: 500 }
        );
      }
      
      console.log('[step-8-notifications] Successfully updated with admin client');
      updateSuccessful = true;
      updateError = null;
    } else if (businessUpdateError) {
      console.error('[step-8-notifications] Error updating notifications_enabled:', businessUpdateError);
      return NextResponse.json(
        { error: 'Failed to update notifications_enabled', details: businessUpdateError.message },
        { status: 500 }
      );
    }

    // Verify the update was successful - always use admin client to ensure we can read it
    const { createAdminClient } = await import('@/lib/db');
    const verifySupabase = createAdminClient();
    
    const { data: updatedBusiness, error: verifyError } = await verifySupabase
      .from('businesses')
      .select('notifications_enabled')
      .eq('id', businessId)
      .single();

    if (verifyError) {
      console.error('[step-8-notifications] Error verifying notifications_enabled update:', verifyError);
    } else {
      console.log('[step-8-notifications] VERIFICATION COMPLETE:', {
        businessId,
        savedValue: updatedBusiness.notifications_enabled,
        expectedValue: notifications_enabled,
        valuesMatch: updatedBusiness.notifications_enabled === notifications_enabled,
        planType: updatedBusiness.notifications_enabled ? 'Pro ($21.99/month)' : 'Basic ($11.99/month)',
      });
      
      // CRITICAL: If values don't match, this is a serious error - the save failed!
      if (updatedBusiness.notifications_enabled !== notifications_enabled) {
        console.error('[step-8-notifications] CRITICAL ERROR: Saved value does not match expected value!', {
          expected: notifications_enabled,
          actual: updatedBusiness.notifications_enabled,
          businessId,
          userId,
        });
        
        // Try one more time with admin client to force the correct value
        console.log('[step-8-notifications] Attempting to fix mismatch with admin client...');
        const { createAdminClient } = await import('@/lib/db');
        const fixSupabase = createAdminClient();
        
        const { error: fixError } = await fixSupabase
          .from('businesses')
          .update({
            notifications_enabled: notifications_enabled, // Force the correct value
            updated_at: new Date().toISOString(),
          })
          .eq('id', businessId);
        
        if (fixError) {
          console.error('[step-8-notifications] Failed to fix mismatch:', fixError);
          return NextResponse.json(
            { 
              error: 'Failed to save plan selection correctly', 
              details: `Expected ${notifications_enabled} but got ${updatedBusiness.notifications_enabled}. Please try again.`,
              savedValue: updatedBusiness.notifications_enabled,
              expectedValue: notifications_enabled,
            },
            { status: 500 }
          );
        }
        
        console.log('[step-8-notifications] Successfully fixed value mismatch');
      }
    }

    return NextResponse.json({
      success: true,
      templateIds,
      notifications_enabled,
      plan_type: notifications_enabled ? 'Pro' : 'Basic',
      plan_price: notifications_enabled ? 21.99 : 11.99,
      message: `Saved ${templateIds.length} notification template(s). Plan: ${notifications_enabled ? 'Pro' : 'Basic'} ($${notifications_enabled ? '21.99' : '11.99'}/month)`,
    });
  } catch (error) {
    console.error('Error in step-8-notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

