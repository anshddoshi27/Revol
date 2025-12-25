import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db';

/**
 * GET /api/public/{slug}/catalog
 * 
 * Returns business catalog (business info, categories, services, staff)
 * No authentication required - this is a public endpoint
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Subdomain is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient(); // Use admin client for public read

    // Get business by subdomain (only active or trial businesses are visible)
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', slug.toLowerCase())
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

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Error in public catalog:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


