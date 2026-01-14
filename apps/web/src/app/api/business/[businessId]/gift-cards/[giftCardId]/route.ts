import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

/**
 * PUT /api/business/[businessId]/gift-cards/[giftCardId]
 * 
 * Updates a gift card (primarily the code)
 */
export async function PUT(
  request: Request,
  { params }: { params: { businessId: string; giftCardId: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { businessId, giftCardId } = params;
    if (!businessId || !giftCardId) {
      return NextResponse.json(
        { error: 'Business ID and Gift Card ID are required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { error: 'Code is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const normalizedCode = code.toUpperCase().trim();

    const supabase = await createServerClient();

    // Check if the gift card exists and belongs to the user/business
    const { data: existingCard, error: fetchError } = await supabase
      .from('gift_cards')
      .select('id, code')
      .eq('id', giftCardId)
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingCard) {
      return NextResponse.json(
        { error: 'Gift card not found' },
        { status: 404 }
      );
    }

    // If code is being changed, check for duplicates
    if (normalizedCode !== existingCard.code) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from('gift_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .eq('code', normalizedCode)
        .is('deleted_at', null)
        .single();

      if (duplicate && duplicate.id !== giftCardId) {
        return NextResponse.json(
          { error: 'A gift card with this code already exists' },
          { status: 409 }
        );
      }
    }

    // Update the gift card
    const { data: updatedCard, error: updateError } = await supabase
      .from('gift_cards')
      .update({
        code: normalizedCode,
        updated_at: new Date().toISOString()
      })
      .eq('id', giftCardId)
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (updateError) {
      console.error('[gift-cards] Error updating gift card:', updateError);
      return NextResponse.json(
        { error: 'Failed to update gift card', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      giftCard: updatedCard
    });
  } catch (error) {
    console.error('[gift-cards] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

