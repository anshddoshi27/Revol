import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import type { ServiceCategory } from '@/lib/onboarding-types';

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
    const { categories } = body;

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: 'categories must be an array' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Soft delete existing categories and services
    const { error: deleteCategoriesError } = await supabase
      .from('service_categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null);

    if (deleteCategoriesError) {
      console.error('Error soft-deleting categories:', deleteCategoriesError);
    }

    // Services will be cascade deleted or we can soft delete them too
    const { error: deleteServicesError } = await supabase
      .from('services')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null);

    if (deleteServicesError) {
      console.error('Error soft-deleting services:', deleteServicesError);
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

    // Process each category
    for (let idx = 0; idx < categories.length; idx++) {
      const category: ServiceCategory = categories[idx];

      // Insert or update category
      const categoryData = {
        id: category.id && category.id.startsWith('uuid-') ? undefined : category.id,
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

      const { data: insertedCategory, error: categoryError } = await supabase
        .from('service_categories')
        .upsert(categoryData, {
          onConflict: 'id',
          ignoreDuplicates: false,
        })
        .select('id')
        .single();

      if (categoryError) {
        console.error('Error upserting category:', categoryError);
        return NextResponse.json(
          { error: `Failed to save category "${category.name}"`, details: categoryError.message },
          { status: 500 }
        );
      }

      const categoryId = insertedCategory.id;
      categoryIds.push(categoryId);

      // Process services in this category
      if (category.services && Array.isArray(category.services)) {
        for (const service of category.services) {
          // Validate required service fields
          if (!service.name || !service.durationMinutes || service.priceCents === undefined) {
            console.warn(`Skipping service "${service.name}" - missing required fields`);
            continue;
          }

          // Insert or update service
          const serviceData = {
            id: service.id && service.id.startsWith('uuid-') ? undefined : service.id,
            user_id: userId,
            business_id: businessId,
            category_id: categoryId,
            name: service.name,
            description: service.description || null,
            duration_min: service.durationMinutes,
            price_cents: service.priceCents,
            pre_appointment_instructions: service.instructions || null,
            is_active: true,
            deleted_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { data: insertedService, error: serviceError } = await supabase
            .from('services')
            .upsert(serviceData, {
              onConflict: 'id',
              ignoreDuplicates: false,
            })
            .select('id')
            .single();

          if (serviceError) {
            console.error('Error upserting service:', serviceError);
            return NextResponse.json(
              { error: `Failed to save service "${service.name}"`, details: serviceError.message },
              { status: 500 }
            );
          }

          serviceIds.push(insertedService.id);

          // Handle staff-service associations
          if (service.staffIds && Array.isArray(service.staffIds) && service.staffIds.length > 0) {
            // Delete existing staff-service associations for this service
            const { error: deleteStaffServicesError } = await supabase
              .from('staff_services')
              .delete()
              .eq('service_id', insertedService.id)
              .eq('user_id', userId);

            if (deleteStaffServicesError) {
              console.error('Error deleting staff-services:', deleteStaffServicesError);
            }

            // Insert new staff-service associations
            const staffServiceInserts = service.staffIds.map((staffId: string) => ({
              user_id: userId,
              business_id: businessId,
              staff_id: staffId,
              service_id: insertedService.id,
              created_at: new Date().toISOString(),
            }));

            const { error: staffServiceError } = await supabase
              .from('staff_services')
              .insert(staffServiceInserts);

            if (staffServiceError) {
              console.error('Error inserting staff-services:', staffServiceError);
              // Continue - this is not critical
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      categoryIds,
      serviceIds,
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

