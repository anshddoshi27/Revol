import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

/**
 * DELETE /api/business/[businessId]/delete
 * 
 * Hard deletes a business and all related data.
 * This performs a complete deletion (not soft delete) of:
 * - The business record
 * - All related data (services, staff, bookings, customers, etc.)
 * 
 * Note: Most tables have ON DELETE CASCADE, but we explicitly delete
 * in the correct order to ensure everything is removed.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { businessId: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { businessId } = params;
    
    // Use admin client to bypass RLS for deletion
    const supabase = createAdminClient();

    // First, verify the business exists and belongs to the user
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, user_id')
      .eq('id', businessId)
      .eq('user_id', userId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found or access denied' },
        { status: 404 }
      );
    }

    console.log(`[delete-business] Starting hard deletion of business ${businessId} for user ${userId}`);

    // Delete in order to respect foreign key constraints
    // Note: Most tables have ON DELETE CASCADE, but we'll be explicit
    
    // 1. Delete notification jobs (references bookings, templates)
    const { error: jobsError } = await supabase
      .from('notification_jobs')
      .delete()
      .eq('business_id', businessId);
    
    if (jobsError) {
      console.error('[delete-business] Error deleting notification_jobs:', jobsError);
    }

    // 2. Delete notification events (references bookings, templates)
    const { error: eventsError } = await supabase
      .from('notification_events')
      .delete()
      .eq('business_id', businessId);
    
    if (eventsError) {
      console.error('[delete-business] Error deleting notification_events:', eventsError);
    }

    // 3. Delete notification templates
    const { error: templatesError } = await supabase
      .from('notification_templates')
      .delete()
      .eq('business_id', businessId);
    
    if (templatesError) {
      console.error('[delete-business] Error deleting notification_templates:', templatesError);
    }

    // 4. Delete gift card ledger (references gift_cards, bookings)
    const { error: ledgerError } = await supabase
      .from('gift_card_ledger')
      .delete()
      .eq('business_id', businessId);
    
    if (ledgerError) {
      console.error('[delete-business] Error deleting gift_card_ledger:', ledgerError);
    }

    // 5. Delete gift cards
    const { error: giftCardsError } = await supabase
      .from('gift_cards')
      .delete()
      .eq('business_id', businessId);
    
    if (giftCardsError) {
      console.error('[delete-business] Error deleting gift_cards:', giftCardsError);
    }

    // 6. Delete booking payments (references bookings)
    const { error: paymentsError } = await supabase
      .from('booking_payments')
      .delete()
      .eq('business_id', businessId);
    
    if (paymentsError) {
      console.error('[delete-business] Error deleting booking_payments:', paymentsError);
    }

    // 7. Delete bookings (references customers, services, staff)
    const { error: bookingsError } = await supabase
      .from('bookings')
      .delete()
      .eq('business_id', businessId);
    
    if (bookingsError) {
      console.error('[delete-business] Error deleting bookings:', bookingsError);
    }

    // 8. Delete customers
    const { error: customersError } = await supabase
      .from('customers')
      .delete()
      .eq('business_id', businessId);
    
    if (customersError) {
      console.error('[delete-business] Error deleting customers:', customersError);
    }

    // 9. Delete blackouts
    const { error: blackoutsError } = await supabase
      .from('blackouts')
      .delete()
      .eq('business_id', businessId);
    
    if (blackoutsError) {
      console.error('[delete-business] Error deleting blackouts:', blackoutsError);
    }

    // 10. Delete availability rules
    const { error: availabilityError } = await supabase
      .from('availability_rules')
      .delete()
      .eq('business_id', businessId);
    
    if (availabilityError) {
      console.error('[delete-business] Error deleting availability_rules:', availabilityError);
    }

    // 11. Delete staff_services junction table
    const { error: staffServicesError } = await supabase
      .from('staff_services')
      .delete()
      .eq('business_id', businessId);
    
    if (staffServicesError) {
      console.error('[delete-business] Error deleting staff_services:', staffServicesError);
    }

    // 12. Delete staff
    const { error: staffError } = await supabase
      .from('staff')
      .delete()
      .eq('business_id', businessId);
    
    if (staffError) {
      console.error('[delete-business] Error deleting staff:', staffError);
    }

    // 13. Delete services (references service_categories)
    const { error: servicesError } = await supabase
      .from('services')
      .delete()
      .eq('business_id', businessId);
    
    if (servicesError) {
      console.error('[delete-business] Error deleting services:', servicesError);
    }

    // 14. Delete service categories
    const { error: categoriesError } = await supabase
      .from('service_categories')
      .delete()
      .eq('business_id', businessId);
    
    if (categoriesError) {
      console.error('[delete-business] Error deleting service_categories:', categoriesError);
    }

    // 15. Delete business policies
    const { error: policiesError } = await supabase
      .from('business_policies')
      .delete()
      .eq('business_id', businessId);
    
    if (policiesError) {
      console.error('[delete-business] Error deleting business_policies:', policiesError);
    }

    // 16. Delete idempotency keys for this user (optional cleanup)
    const { error: idempotencyError } = await supabase
      .from('idempotency_keys')
      .delete()
      .eq('user_id', userId);
    
    if (idempotencyError) {
      console.error('[delete-business] Error deleting idempotency_keys:', idempotencyError);
    }

    // 17. Finally, delete the business record itself
    // This should cascade delete any remaining references
    const { error: businessDeleteError } = await supabase
      .from('businesses')
      .delete()
      .eq('id', businessId)
      .eq('user_id', userId);

    if (businessDeleteError) {
      console.error('[delete-business] Error deleting business:', businessDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete business', details: businessDeleteError.message },
        { status: 500 }
      );
    }

    console.log(`[delete-business] Successfully deleted business ${businessId} and all related data`);

    return NextResponse.json({
      success: true,
      message: 'Business and all related data deleted successfully'
    });
  } catch (error) {
    console.error('[delete-business] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}




