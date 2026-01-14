import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import { renderTemplate, validatePlaceholders } from '@/lib/notifications';
import type { NotificationData } from '@/lib/notifications';

/**
 * POST /api/admin/notifications/templates/[id]/preview
 * 
 * Preview a notification template with sample data
 * 
 * Body (optional): {
 *   sample_data?: NotificationData // Override default sample data
 * }
 */
export async function POST(
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

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Get request body for custom sample data
    let customData: Partial<NotificationData> = {};
    try {
      const body = await request.json();
      customData = body.sample_data || {};
    } catch {
      // No body provided, use defaults
    }

    // Get business for timezone and other info
    const { data: business } = await supabase
      .from('businesses')
      .select('timezone, name, support_email, phone, subdomain')
      .eq('id', businessId)
      .single();

    // Fetch real service data from database (use first active service as sample)
    const { data: services } = await supabase
      .from('services')
      .select('id, name, duration_min, price_cents')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(1)
      .single();

    // Fetch real staff data from database (use first active staff as sample)
    const { data: staff } = await supabase
      .from('staff')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(1)
      .single();

    // Use real data from database, fallback to defaults if no data exists
    const sampleService = services || {
      name: 'Sample Service',
      duration_min: 60,
      price_cents: 10000,
    };

    const sampleStaff = staff || {
      name: 'Sample Staff',
    };

    // Create sample data using real database values
    const sampleData: NotificationData = {
      customer: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        ...customData.customer,
      },
      service: {
        name: sampleService.name,
        duration_min: sampleService.duration_min,
        price_cents: sampleService.price_cents,
        ...customData.service,
      },
      staff: {
        name: sampleStaff.name,
        ...customData.staff,
      },
      booking: {
        id: 'booking-12345678',
        start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        final_price_cents: Math.round(sampleService.price_cents * 0.8), // 20% discount example
        price_cents: sampleService.price_cents,
        ...customData.booking,
      },
      business: {
        name: business?.name || 'Test Business',
        support_email: business?.support_email || 'support@example.com',
        phone: business?.phone || '+0987654321',
        subdomain: business?.subdomain || 'test',
        timezone: business?.timezone || 'America/New_York',
        ...customData.business,
      },
      booking_url: business?.subdomain
        ? `https://${business.subdomain}.main.tld/confirm/REVOL-12345678`
        : 'https://test.main.tld/confirm/REVOL-12345678',
      ...customData,
    };

    // Render template
    const renderedBody = renderTemplate(
      template.body_markdown,
      sampleData,
      business?.timezone || 'America/New_York'
    );

    const renderedSubject = template.subject
      ? renderTemplate(template.subject, sampleData, business?.timezone || 'America/New_York')
      : null;

    return NextResponse.json({
      preview: {
        subject: renderedSubject,
        body: renderedBody,
      },
      sample_data: sampleData,
      template: {
        id: template.id,
        name: template.name,
        channel: template.channel,
        trigger: template.trigger,
      },
    });
  } catch (error) {
    console.error('Error in preview template:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

