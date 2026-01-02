import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/db';
import { resolveTenantSlug } from '@/lib/tenant-resolution';
import { addCorsHeaders, handleOptions } from '@/lib/cors';

/**
 * GET /api/public/{slug}/catalog
 * 
 * Returns business catalog (business info, categories, services, staff)
 * No authentication required - this is a public endpoint
 * 
 * Supports both:
 * - Subdomain-based: {businessname}.main.tld → resolves from Host header
 * - Path-based: /api/public/{slug}/catalog → resolves from URL parameter
 */
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request) || new NextResponse(null, { status: 200 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Resolve tenant slug from Host header or URL parameter
    const tenantSlug = resolveTenantSlug(request, params.slug);

    if (!tenantSlug) {
      const response = NextResponse.json(
        { error: 'Subdomain is required' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    const supabase = createAdminClient(); // Use admin client for public read

    // Get business by subdomain (only active or trial businesses are visible)
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', tenantSlug)
      .in('subscription_status', ['active', 'trial'])
      .is('deleted_at', null)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Get service categories with services
    const { data: categories } = await supabase
      .from('service_categories')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    const categoryIds = categories?.map(c => c.id) || [];

    // Get services for these categories
    const { data: services } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', business.id)
      .in('category_id', categoryIds.length > 0 ? categoryIds : ['00000000-0000-0000-0000-000000000000']) // Prevent empty array
      .eq('is_active', true)
      .is('deleted_at', null);

    // Get staff
    const { data: staff } = await supabase
      .from('staff')
      .select('id, name, role, color')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .is('deleted_at', null);

    // Get staff-service associations
    const serviceIds = services?.map(s => s.id) || [];
    const { data: staffServices } = await supabase
      .from('staff_services')
      .select('staff_id, service_id')
      .eq('business_id', business.id)
      .in('service_id', serviceIds.length > 0 ? serviceIds : ['00000000-0000-0000-0000-000000000000']);

    // Get accepted payment methods from payment_methods table
    let acceptedMethods: string[] = ['card']; // Default to card
    try {
      const { data: paymentMethods } = await supabase
        .from('payment_methods')
        .select('method')
        .eq('business_id', business.id)
        .eq('enabled', true);
      
      if (paymentMethods && paymentMethods.length > 0) {
        acceptedMethods = paymentMethods.map(pm => pm.method);
      }
    } catch (error) {
      // payment_methods table might not exist, use default
      console.log('[public-catalog] Could not fetch payment methods, using default (card)');
    }

    // Get active business policies
    const { data: policy } = await supabase
      .from('business_policies')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Group services by category and attach staff
    const servicesByCategory = new Map<string, any[]>();
    services?.forEach(service => {
      if (!servicesByCategory.has(service.category_id)) {
        servicesByCategory.set(service.category_id, []);
      }
      const serviceStaffIds = staffServices
        ?.filter(ss => ss.service_id === service.id)
        .map(ss => ss.staff_id) || [];
      servicesByCategory.get(service.category_id)?.push({
        ...service,
        staffIds: serviceStaffIds,
      });
    });

    const categoriesWithServices = categories?.map(category => ({
      ...category,
      services: servicesByCategory.get(category.id) || [],
    })) || [];

    const response = NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        subdomain: business.subdomain,
        timezone: business.timezone,
        subscription_status: business.subscription_status,
        brand_primary_color: business.brand_primary_color,
        brand_secondary_color: business.brand_secondary_color,
        logo_url: business.logo_url,
        support_email: business.support_email,
        phone: business.phone,
      },
      categories: categoriesWithServices,
      staff: staff || [],
      acceptedPaymentMethods: acceptedMethods, // Include accepted payment methods
      policies: policy ? {
        cancellationPolicy: policy.cancellation_policy_text || '',
        cancellationFeeType: policy.cancel_fee_type || 'flat',
        cancellationFeeValue: policy.cancel_fee_amount_cents || policy.cancel_fee_percent || 0,
        noShowPolicy: policy.no_show_policy_text || '',
        noShowFeeType: policy.no_show_fee_type || 'flat',
        noShowFeeValue: policy.no_show_fee_amount_cents || policy.no_show_fee_percent || 0,
        refundPolicy: policy.refund_policy_text || '',
        cashPolicy: policy.cash_policy_text || '',
      } : {
        cancellationPolicy: '',
        cancellationFeeType: 'flat' as const,
        cancellationFeeValue: 0,
        noShowPolicy: '',
        noShowFeeType: 'flat' as const,
        noShowFeeValue: 0,
        refundPolicy: '',
        cashPolicy: '',
      },
    });
    
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error('Error in public catalog:', error);
    const response = NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}


