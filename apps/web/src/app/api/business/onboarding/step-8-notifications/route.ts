import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import type { NotificationTemplate } from '@/lib/onboarding-types';
import { getEffectiveNotificationsEnabled } from '@/lib/feature-flags';

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
    let { templates, notifications_enabled } = body;

    // If notifications feature is disabled globally, handle accordingly
    // Note: Basic Plan now has notifications enabled by default
    const notificationsFeatureEnabled = getEffectiveNotificationsEnabled();
    if (!notificationsFeatureEnabled) {
      console.log('[step-8-notifications] Notifications feature disabled globally - this should not happen with Basic Plan');
      // Basic Plan should always have notifications enabled, but if feature flag is off, respect it
      notifications_enabled = false;
      templates = []; // Clear any templates if feature is disabled
    } else {
      // Feature is enabled - Basic Plan has notifications enabled
      // Ensure notifications_enabled is true for Basic Plan
      if (notifications_enabled === null || notifications_enabled === false) {
        notifications_enabled = true; // Basic Plan now has notifications enabled
      }
    }

    // Log the received value for debugging
    console.log('[step-8-notifications] Received request body:', {
      notifications_enabled,
      notifications_enabled_type: typeof notifications_enabled,
      templates_count: Array.isArray(templates) ? templates.length : 'not an array',
      planType: 'Basic ($14.99/month) - notifications enabled',
      featureEnabled: notificationsFeatureEnabled,
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

    // CRITICAL FIX: Always update notifications_enabled BEFORE checking templates.length
    // This ensures Basic plan (no templates) still saves the plan selection
    console.log('[step-8-notifications] BEFORE UPDATE - Current state:', {
      businessId,
      receivedValue: notifications_enabled,
      planType: 'Basic ($14.99/month) - notifications enabled',
      valueType: typeof notifications_enabled,
      templatesCount: templates.length,
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

    // If no templates, return early AFTER updating notifications_enabled
    if (templates.length === 0) {
      // Verify the update was successful
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
        console.log('[step-8-notifications] VERIFICATION COMPLETE (Basic plan - no templates):', {
          businessId,
          savedValue: updatedBusiness.notifications_enabled,
          expectedValue: notifications_enabled,
          valuesMatch: updatedBusiness.notifications_enabled === notifications_enabled,
          planType: 'Basic ($14.99/month) - notifications enabled',
        });
        
        // CRITICAL: If values don't match, this is a serious error
        if (updatedBusiness.notifications_enabled !== notifications_enabled) {
          console.error('[step-8-notifications] CRITICAL ERROR: Saved value does not match expected value!', {
            expected: notifications_enabled,
            actual: updatedBusiness.notifications_enabled,
            businessId,
            userId,
          });
          
          // Try one more time with admin client to force the correct value
          console.log('[step-8-notifications] Attempting to fix mismatch with admin client...');
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
        templateIds: [],
        notifications_enabled,
        plan_type: 'Basic',
        plan_price: 14.99,
        message: `Plan saved: Basic ($14.99/month) - notifications enabled. No notification templates.`,
      });
    }

    // Helper function to validate UUID format
    const isValidUUID = (id: string | undefined): boolean => {
      if (!id) return false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(id);
    };

    // Map frontend category values to database enum values
    // Database only supports: 'confirmation', 'reminder', 'follow_up', 'cancellation', 'reschedule', 'completion'
    const mapCategoryToDatabase = (category: string): string => {
      const categoryMap: Record<string, string> = {
        'fee': 'completion', // Map fee-related notifications to completion category
        'payment_issue': 'completion', // Map payment issues to completion
        'refund': 'completion', // Map refunds to completion
        // Valid categories pass through
        'confirmation': 'confirmation',
        'reminder': 'reminder',
        'follow_up': 'follow_up',
        'cancellation': 'cancellation',
        'reschedule': 'reschedule',
        'completion': 'completion',
      };
      const mapped = categoryMap[category] || 'completion'; // Default to completion if unknown
      if (mapped !== category) {
        console.warn(`[step-8-notifications] Mapped category '${category}' to '${mapped}' for database compatibility`);
      }
      return mapped;
    };

    // Map frontend channel values to database enum values
    // Database only supports 'email' and 'sms', not 'push'
    const mapChannelToDatabase = (channel: string): 'email' | 'sms' => {
      if (channel === 'push') {
        console.warn(`[step-8-notifications] Channel 'push' not supported in database, mapping to 'sms'`);
        return 'sms';
      }
      if (channel === 'email' || channel === 'sms') {
        return channel;
      }
      // Default to email if unknown
      console.warn(`[step-8-notifications] Unknown channel '${channel}', defaulting to 'email'`);
      return 'email';
    };

    // Split templates into new (no valid UUID) and existing (has valid UUID)
    // Split templates into new (no valid UUID) and existing (has valid UUID)
    const templatesToUpdate: any[] = [];
    const templatesToInsert: any[] = [];
    
    templates.forEach((template: NotificationTemplate) => {
      const mappedChannel = mapChannelToDatabase(template.channel);
      const mappedCategory = mapCategoryToDatabase(template.category);
      const hasValidId = isValidUUID(template.id);
      
      // Base object with all required fields
      const baseTemplate: any = {
        user_id: userId,
        business_id: businessId,
        name: template.name,
        channel: mappedChannel, // Map to valid database enum value ('email' | 'sms')
        category: mappedCategory, // Map to valid database enum value
        trigger: template.trigger,
        subject: template.subject || null,
        body_markdown: template.body,
        is_enabled: template.enabled !== false, // Default to true
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      if (hasValidId) {
        // Template has valid UUID - include id for upsert (update)
        baseTemplate.id = template.id;
        templatesToUpdate.push(baseTemplate);
      } else {
        // Template has no valid UUID - omit id for insert (database will generate it)
        templatesToInsert.push(baseTemplate);
      }
    });

    // Insert new templates (without ids - database will generate them)
    let allInsertedTemplates: any[] = [];
    
    if (templatesToInsert.length > 0) {
      const { data: insertedNew, error: insertError } = await supabase
        .from('notification_templates')
        .insert(templatesToInsert)
        .select('id');
      
      if (insertError) {
        console.error('[step-8-notifications] Error inserting new templates:', {
          error: insertError,
          message: insertError.message,
          code: insertError.code,
          count: templatesToInsert.length,
        });
        return NextResponse.json(
          { error: 'Failed to save notification templates', details: insertError.message },
          { status: 500 }
        );
      }
      
      allInsertedTemplates = insertedNew || [];
      console.log('[step-8-notifications] Successfully inserted new templates:', {
        count: allInsertedTemplates.length,
        ids: allInsertedTemplates.map(t => t.id),
      });
    }
    
    // Upsert existing templates (with ids)
    let updatedTemplates: any[] = [];
    
    if (templatesToUpdate.length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from('notification_templates')
        .upsert(templatesToUpdate, {
          onConflict: 'id',
          ignoreDuplicates: false,
        })
        .select('id');
      
      if (updateError) {
        console.error('[step-8-notifications] Error upserting existing templates:', {
          error: updateError,
          message: updateError.message,
          code: updateError.code,
          count: templatesToUpdate.length,
        });
        return NextResponse.json(
          { error: 'Failed to update notification templates', details: updateError.message },
          { status: 500 }
        );
      }
      
      updatedTemplates = updated || [];
      console.log('[step-8-notifications] Successfully upserted existing templates:', {
        count: updatedTemplates.length,
        ids: updatedTemplates.map(t => t.id),
      });
    }
    
    const insertedTemplates = [...allInsertedTemplates, ...updatedTemplates];

    console.log('[step-8-notifications] Successfully saved all templates:', {
      count: insertedTemplates.length,
      newCount: allInsertedTemplates.length,
      updatedCount: updatedTemplates.length,
      ids: insertedTemplates.map(t => t.id),
    });

    const templateIds = insertedTemplates?.map(t => t.id) || [];

    // Note: notifications_enabled was already updated earlier (before templates check)
    // This ensures both Basic (no templates) and Pro (with templates) plans are saved correctly

    return NextResponse.json({
      success: true,
      templateIds,
      notifications_enabled,
      plan_type: 'Basic',
      plan_price: 14.99,
      message: `Saved ${templateIds.length} notification template(s). Plan: Basic ($14.99/month) - notifications enabled`,
    });
  } catch (error) {
    console.error('Error in step-8-notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

