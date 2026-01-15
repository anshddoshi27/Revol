import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import type { ServiceCategory } from '@/lib/onboarding-types';

// Force dynamic rendering since this route uses cookies
export const dynamic = 'force-dynamic';

/**
 * GET /api/business/onboarding/step-6-services
 * 
 * Retrieves service categories and services
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
      return NextResponse.json(
        { services: [] },
        { status: 200 }
      );
    }

    const supabase = await createServerClient();
    
    // Get categories
    const { data: categories, error: categoriesError } = await supabase
      .from('service_categories')
      .select('id, name, description, color, sort_order')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (categoriesError) {
      console.error('[step-6-services] Error fetching categories:', categoriesError);
      return NextResponse.json(
        { error: 'Failed to fetch services data' },
        { status: 500 }
      );
    }

    // Get services
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('id, category_id, name, description, duration_min, price_cents, pre_appointment_instructions, image_url')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null);

    if (servicesError) {
      console.error('[step-6-services] Error fetching services:', servicesError);
      return NextResponse.json(
        { error: 'Failed to fetch services data' },
        { status: 500 }
      );
    }

    // Get staff-service associations
    const { data: staffServices, error: staffServicesError } = await supabase
      .from('staff_services')
      .select('service_id, staff_id')
      .eq('user_id', userId)
      .eq('business_id', businessId);

    if (staffServicesError) {
      console.error('[step-6-services] Error fetching staff-services:', staffServicesError);
      // Continue without staff associations
    }

    // Build staff ID map for services
    const staffServiceMap = new Map<string, string[]>();
    (staffServices || []).forEach((ss: any) => {
      if (!staffServiceMap.has(ss.service_id)) {
        staffServiceMap.set(ss.service_id, []);
      }
      staffServiceMap.get(ss.service_id)!.push(ss.staff_id);
    });

    // Build categories with services
    const serviceCategories: ServiceCategory[] = (categories || []).map((cat: any) => {
      const categoryServices = (services || [])
        .filter((svc: any) => svc.category_id === cat.id)
        .map((svc: any) => ({
          id: svc.id,
          name: svc.name,
          description: svc.description || '',
          durationMinutes: svc.duration_min,
          priceCents: svc.price_cents,
          instructions: svc.pre_appointment_instructions || '',
          staffIds: staffServiceMap.get(svc.id) || [],
          imageUrl: svc.image_url || undefined,
        }));

      return {
        id: cat.id,
        name: cat.name,
        description: cat.description || '',
        color: cat.color || undefined,
        services: categoryServices,
      };
    });

    return NextResponse.json({
      services: serviceCategories
    });
  } catch (error) {
    console.error('[step-6-services] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/business/onboarding/step-6-services
 * 
 * Updates service categories and services
 * 
 * Body: {
 *   categories: ServiceCategory[]
 * }
 */
export async function PUT(request: Request) {
  console.log('[step-6-services] API called - PUT /api/business/onboarding/step-6-services');
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('[step-6-services] No user ID found - unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('[step-6-services] User authenticated:', userId);

    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      console.error('[step-6-services] Business not found for user:', userId);
      return NextResponse.json(
        { error: 'Business not found. Complete step 1 first.' },
        { status: 404 }
      );
    }
    console.log('[step-6-services] Business ID:', businessId);

    const body = await request.json();
    const { categories } = body;

    if (!Array.isArray(categories)) {
      console.error('[step-6-services] Invalid request body - categories is not an array');
      return NextResponse.json(
        { error: 'categories must be an array' },
        { status: 400 }
      );
    }

    console.log('[step-6-services] Saving categories:', categories.length);
    
    // Helper function to check if a string is a valid UUID
    const isValidUUID = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    let supabase = await createServerClient();

    // Soft delete existing categories and services
    let { error: deleteCategoriesError } = await supabase
      .from('service_categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null);

    // If RLS error, use service role
    if (deleteCategoriesError && (deleteCategoriesError.code === 'PGRST301' || deleteCategoriesError.message?.includes('No suitable key'))) {
      console.log('[step-6-services] RLS error on delete categories, using service role');
      const { createAdminClient } = await import('@/lib/db');
      supabase = createAdminClient();
      
      const { error: adminDeleteError } = await supabase
        .from('service_categories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .is('deleted_at', null);
      
      if (adminDeleteError) {
        console.error('[step-6-services] Error soft-deleting categories with admin:', adminDeleteError);
      }
    } else if (deleteCategoriesError) {
      console.error('[step-6-services] Error soft-deleting categories:', deleteCategoriesError);
    }

    // Services will be cascade deleted or we can soft delete them too
    let { error: deleteServicesError } = await supabase
      .from('services')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null);

    if (deleteServicesError && (deleteServicesError.code === 'PGRST301' || deleteServicesError.message?.includes('No suitable key'))) {
      console.log('[step-6-services] RLS error on delete services, using service role');
      // Use admin client if we haven't already switched
      if (!supabase) {
        const { createAdminClient } = await import('@/lib/db');
        supabase = createAdminClient();
      }
      
      const { error: adminDeleteError } = await supabase
        .from('services')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .is('deleted_at', null);
      
      if (adminDeleteError) {
        console.error('[step-6-services] Error soft-deleting services with admin:', adminDeleteError);
      }
    } else if (deleteServicesError) {
      console.error('[step-6-services] Error soft-deleting services:', deleteServicesError);
    }

    if (categories.length === 0) {
      return NextResponse.json({
        success: true,
        categoryIds: [],
        serviceIds: [],
        message: 'Services cleared',
      });
    }

    const categoryIds: string[] = [];
    const serviceIds: string[] = [];
    // Track service ID mappings: oldId -> newId
    const serviceIdMap = new Map<string, string>();
    // Track category ID mappings: oldId -> newId
    const categoryIdMap = new Map<string, string>();
    // Build full service categories structure with real IDs to return
    const returnedCategories: ServiceCategory[] = [];

    // Process each category
    for (let idx = 0; idx < categories.length; idx++) {
      const category: ServiceCategory = categories[idx];
      const originalCategoryId = category.id;

      // Insert or update category
      // Only include id if it's a valid UUID, otherwise let DB generate it
      const categoryData: any = {
        user_id: userId,
        business_id: businessId,
        name: category.name,
        description: category.description || null,
        color: category.color || null,
        sort_order: idx,
        is_active: true,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Only include id if it's a valid UUID (from database), not a temporary frontend ID
      if (category.id && isValidUUID(category.id)) {
        categoryData.id = category.id;
      }

      let { data: insertedCategory, error: categoryError } = await supabase
        .from('service_categories')
        .upsert(categoryData, {
          onConflict: 'id',
          ignoreDuplicates: false,
        })
        .select('id')
        .single();

      // If RLS error, try with service role
      if (categoryError && (categoryError.code === 'PGRST301' || categoryError.message?.includes('No suitable key'))) {
        console.log('[step-6-services] RLS error on category upsert, using service role');
        const { createAdminClient } = await import('@/lib/db');
        const adminSupabase = createAdminClient();
        
        const { data: adminCategory, error: adminCategoryError } = await adminSupabase
          .from('service_categories')
          .upsert(categoryData, {
            onConflict: 'id',
            ignoreDuplicates: false,
          })
          .select('id')
          .single();
        
        if (adminCategoryError) {
          console.error('[step-6-services] Error upserting category with admin:', adminCategoryError);
          return NextResponse.json(
            { error: `Failed to save category "${category.name}"`, details: adminCategoryError.message },
            { status: 500 }
          );
        }
        
        insertedCategory = adminCategory;
        categoryError = null;
      } else if (categoryError) {
        console.error('[step-6-services] Error upserting category:', categoryError);
        return NextResponse.json(
          { error: `Failed to save category "${category.name}"`, details: categoryError.message },
          { status: 500 }
        );
      }

      const categoryId = insertedCategory.id;
      categoryIds.push(categoryId);
      
      // Track the mapping of old category ID to new category ID
      if (originalCategoryId && !isValidUUID(originalCategoryId)) {
        categoryIdMap.set(originalCategoryId, categoryId);
      }
      
      // Build services array for this category with real IDs
      const returnedServices: any[] = [];

      // Process services in this category
      if (category.services && Array.isArray(category.services)) {
        for (const service of category.services) {
          const originalServiceId = service.id;
          // Validate required service fields
          if (!service.name || !service.durationMinutes || service.priceCents === undefined) {
            console.warn(`Skipping service "${service.name}" - missing required fields`);
            continue;
          }

          // Insert or update service
          // Only include id if it's a valid UUID, otherwise let DB generate it
          const serviceData: any = {
            user_id: userId,
            business_id: businessId,
            category_id: categoryId,
            name: service.name,
            description: service.description || null,
            duration_min: service.durationMinutes,
            price_cents: service.priceCents,
            pre_appointment_instructions: service.instructions || null,
            image_url: service.imageUrl || null,
            is_active: true,
            deleted_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          // Only include id if it's a valid UUID (from database), not a temporary frontend ID
          if (service.id && isValidUUID(service.id)) {
            serviceData.id = service.id;
          }

          let { data: insertedService, error: serviceError } = await supabase
            .from('services')
            .upsert(serviceData, {
              onConflict: 'id',
              ignoreDuplicates: false,
            })
            .select('id')
            .single();

          // If RLS error, try with service role
          if (serviceError && (serviceError.code === 'PGRST301' || serviceError.message?.includes('No suitable key'))) {
            console.log('[step-6-services] RLS error on service upsert, using service role');
            const { createAdminClient } = await import('@/lib/db');
            const adminSupabase = createAdminClient();
            
            const { data: adminService, error: adminServiceError } = await adminSupabase
              .from('services')
              .upsert(serviceData, {
                onConflict: 'id',
                ignoreDuplicates: false,
              })
              .select('id')
              .single();
            
            if (adminServiceError) {
              console.error('[step-6-services] Error upserting service with admin:', adminServiceError);
              return NextResponse.json(
                { error: `Failed to save service "${service.name}"`, details: adminServiceError.message },
                { status: 500 }
              );
            }
            
            insertedService = adminService;
            serviceError = null;
          } else if (serviceError) {
            console.error('[step-6-services] Error upserting service:', serviceError);
            return NextResponse.json(
              { error: `Failed to save service "${service.name}"`, details: serviceError.message },
              { status: 500 }
            );
          }

          serviceIds.push(insertedService.id);
          
          // Track the mapping of old service ID to new service ID
          // This allows frontend to update temporary IDs (like svc_xxx) to real database IDs
          if (originalServiceId && !isValidUUID(originalServiceId)) {
            serviceIdMap.set(originalServiceId, insertedService.id);
            console.log(`[step-6-services] Mapped temporary service ID "${originalServiceId}" to real ID "${insertedService.id}"`);
          }
          
          // Build service object with real ID for return
          returnedServices.push({
            id: insertedService.id, // Use real database ID
            name: service.name,
            description: service.description || '',
            durationMinutes: service.durationMinutes,
            priceCents: service.priceCents,
            instructions: service.instructions || '',
            staffIds: service.staffIds || [], // Keep staff IDs as-is (they should be real IDs from step-4)
            imageUrl: service.imageUrl || undefined,
          });

          // Handle staff-service associations
          if (service.staffIds && Array.isArray(service.staffIds) && service.staffIds.length > 0) {
            // Filter out invalid UUIDs - only use valid staff IDs
            const validStaffIds = service.staffIds.filter((staffId: string) => isValidUUID(staffId));
            
            if (validStaffIds.length === 0) {
              console.warn(`[step-6-services] No valid staff IDs for service "${service.name}", skipping staff associations`);
            } else if (validStaffIds.length < service.staffIds.length) {
              console.warn(`[step-6-services] Filtered out ${service.staffIds.length - validStaffIds.length} invalid staff IDs for service "${service.name}"`);
            }
            
            if (validStaffIds.length > 0) {
              // Delete existing staff-service associations for this service
              let { error: deleteStaffServicesError } = await supabase
                .from('staff_services')
                .delete()
                .eq('service_id', insertedService.id)
                .eq('user_id', userId);

              // If RLS error, try with service role
              if (deleteStaffServicesError && (deleteStaffServicesError.code === 'PGRST301' || deleteStaffServicesError.message?.includes('No suitable key'))) {
                const { createAdminClient } = await import('@/lib/db');
                const adminSupabase = createAdminClient();
                
                const { error: adminDeleteError } = await adminSupabase
                  .from('staff_services')
                  .delete()
                  .eq('service_id', insertedService.id)
                  .eq('user_id', userId);
                
                if (adminDeleteError) {
                  console.error('[step-6-services] Error deleting staff-services with admin:', adminDeleteError);
                }
              } else if (deleteStaffServicesError) {
                console.error('[step-6-services] Error deleting staff-services:', deleteStaffServicesError);
              }

              // Insert new staff-service associations (only with valid UUIDs)
              const staffServiceInserts = validStaffIds.map((staffId: string) => ({
                user_id: userId,
                business_id: businessId,
                staff_id: staffId,
                service_id: insertedService.id,
                created_at: new Date().toISOString(),
              }));

              let { error: staffServiceError } = await supabase
                .from('staff_services')
                .insert(staffServiceInserts);

              // If RLS error, try with service role
              if (staffServiceError && (staffServiceError.code === 'PGRST301' || staffServiceError.message?.includes('No suitable key'))) {
                const { createAdminClient } = await import('@/lib/db');
                const adminSupabase = createAdminClient();
                
                const { error: adminStaffServiceError } = await adminSupabase
                  .from('staff_services')
                  .insert(staffServiceInserts);
                
                if (adminStaffServiceError) {
                  console.error('[step-6-services] Error inserting staff-services with admin:', adminStaffServiceError);
                  // Continue - this is not critical
                } else {
                  console.log(`[step-6-services] Saved ${validStaffIds.length} staff-service associations for "${service.name}"`);
                }
              } else if (staffServiceError) {
                console.error('[step-6-services] Error inserting staff-services:', staffServiceError);
                // Continue - this is not critical
              } else {
                console.log(`[step-6-services] Saved ${validStaffIds.length} staff-service associations for "${service.name}"`);
              }
            }
          }
        }
      }
      
      // Build category object with real ID and services for return
      returnedCategories.push({
        id: categoryId, // Use real database ID
        name: category.name,
        description: category.description || '',
        color: category.color || undefined,
        services: returnedServices,
      });
    }

    console.log('[step-6-services] Successfully saved:', categoryIds.length, 'categories and', serviceIds.length, 'services');
    console.log('[step-6-services] Returning service categories with real database IDs:', returnedCategories.map(c => ({
      categoryId: c.id,
      categoryName: c.name,
      services: c.services.map(s => ({ serviceId: s.id, serviceName: s.name }))
    })));

    return NextResponse.json({
      success: true,
      categoryIds,
      serviceIds,
      categories: returnedCategories, // Return full service categories with real database IDs
      message: `Saved ${categoryIds.length} category(ies) and ${serviceIds.length} service(s)`,
    });
  } catch (error) {
    console.error('Error in step-6-services:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

