import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';

/**
 * GET /api/admin/bookings?status=&from=&to=&cursor=
 * 
 * Lists bookings for the authenticated business owner
 * Supports filtering by status and date range, cursor-based pagination
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
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const from = searchParams.get('from'); // YYYY-MM-DD
    const to = searchParams.get('to'); // YYYY-MM-DD
    const cursor = searchParams.get('cursor'); // booking ID for pagination
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const supabase = await createServerClient();

    // Build query - includes all fields needed for money board display
    let query = supabase
      .from('bookings')
      .select(`
        id,
        status,
        start_at,
        end_at,
        duration_min,
        price_cents,
        final_price_cents,
        gift_card_amount_applied_cents,
        payment_status,
        last_money_action,
        source,
        created_at,
        customers:customer_id (
          id,
          name,
          email,
          phone
        ),
        services:service_id (
          id,
          name,
          duration_min,
          price_cents
        ),
        staff:staff_id (
          id,
          name
        )
      `)
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('start_at', { ascending: false })
      .limit(limit + 1); // Get one extra to check if there's a next page

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (from) {
      const fromDate = new Date(`${from}T00:00:00Z`);
      query = query.gte('start_at', fromDate.toISOString());
    }

    if (to) {
      const toDate = new Date(`${to}T23:59:59Z`);
      query = query.lte('start_at', toDate.toISOString());
    }

    if (cursor) {
      // Get the start_at of the cursor booking
      const { data: cursorBooking } = await supabase
        .from('bookings')
        .select('start_at')
        .eq('id', cursor)
        .single();

      if (cursorBooking) {
        query = query.lt('start_at', cursorBooking.start_at);
      }
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error('Error fetching bookings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bookings', details: error.message },
        { status: 500 }
      );
    }

    // Check if there's a next page
    const hasNextPage = bookings && bookings.length > limit;
    const items = hasNextPage ? bookings.slice(0, limit) : (bookings || []);

    // Transform for response - matches spec from backend clarifications
    const transformedItems = items.map((booking: any) => {
      // Generate booking code (format: REVOL-{first8chars})
      const bookingCode = `REVOL-${booking.id.slice(0, 8).toUpperCase()}`;

      return {
        id: booking.id,
        code: bookingCode,
        status: booking.status,
        service: booking.services ? {
          name: booking.services.name,
          duration_min: booking.services.duration_min,
          price_cents: booking.services.price_cents,
        } : null,
        staff: booking.staff ? {
          id: booking.staff.id,
          name: booking.staff.name,
        } : null,
        start_at: booking.start_at,
        end_at: booking.end_at,
        customer: booking.customers ? {
          id: booking.customers.id,
          name: booking.customers.name,
          email: booking.customers.email,
          phone: booking.customers.phone,
        } : null,
        final_price_cents: booking.final_price_cents,
        gift_discount_cents: booking.gift_card_amount_applied_cents || 0,
        last_payment_status: booking.payment_status || 'none',
        last_money_action: booking.last_money_action || 'none',
      };
    });

    const next_page_token = hasNextPage && items.length > 0
      ? items[items.length - 1].id
      : null;

    return NextResponse.json({
      items: transformedItems,
      next_page_token,
    });
  } catch (error) {
    console.error('Error in admin bookings list:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


