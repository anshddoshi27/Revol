import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

/**
 * GET /api/business/[businessId]/gift-cards
 * 
 * Retrieves all gift cards for a business
 */
export async function GET(
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
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const { data: giftCards, error } = await supabase
      .from('gift_cards')
      .select('id, code, discount_type, initial_amount_cents, current_balance_cents, percent_off, expires_at, is_active, created_at, updated_at')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[gift-cards] Error fetching gift cards:', error);
      return NextResponse.json(
        { error: 'Failed to fetch gift cards', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      giftCards: giftCards || []
    });
  } catch (error) {
    console.error('[gift-cards] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

