import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import type { GiftCardConfig } from '@/lib/onboarding-types';

/**
 * PUT /api/business/onboarding/step-10-gift-cards
 * 
 * Configures gift cards and generates codes
 * 
 * Body: GiftCardConfig type
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

    const body: GiftCardConfig = await request.json();
    const { enabled, amountType, amountValue, expirationEnabled, expirationMonths, generatedCodes } = body;

    const supabase = await createServerClient();

    // If gift cards are disabled, just return success (don't clear existing codes)
    if (!enabled) {
      return NextResponse.json({
        success: true,
        message: 'Gift cards disabled',
      });
    }

    // Validate required fields
    if (!amountType || amountValue === undefined) {
      return NextResponse.json(
        { error: 'amountType and amountValue are required when gift cards are enabled' },
        { status: 400 }
      );
    }

    if (!['amount', 'percent'].includes(amountType)) {
      return NextResponse.json(
        { error: 'amountType must be "amount" or "percent"' },
        { status: 400 }
      );
    }

    // Insert generated gift card codes
    const giftCardIds: string[] = [];

    if (generatedCodes && Array.isArray(generatedCodes) && generatedCodes.length > 0) {
      const now = new Date();
      const expiresAt = expirationEnabled && expirationMonths
        ? new Date(now.getTime() + expirationMonths * 30 * 24 * 60 * 60 * 1000)
        : null;

      const giftCardsToInsert = generatedCodes.map((code: string) => {
        const giftCardData: any = {
          user_id: userId,
          business_id: businessId,
          code: code.toUpperCase().trim(),
          discount_type: amountType,
          is_active: true,
          expires_at: expiresAt ? expiresAt.toISOString() : null,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        };

        if (amountType === 'amount') {
          giftCardData.initial_amount_cents = Math.round(amountValue * 100);
          giftCardData.current_balance_cents = Math.round(amountValue * 100);
          giftCardData.percent_off = null;
        } else {
          giftCardData.percent_off = amountValue;
          giftCardData.initial_amount_cents = null;
          giftCardData.current_balance_cents = null;
        }

        return giftCardData;
      });

      const { data: insertedCards, error: insertError } = await supabase
        .from('gift_cards')
        .upsert(giftCardsToInsert, {
          onConflict: 'code', // Assuming there's a unique constraint on (user_id, code)
          ignoreDuplicates: false,
        })
        .select('id');

      if (insertError) {
        console.error('Error inserting gift cards:', insertError);
        return NextResponse.json(
          { error: 'Failed to save gift cards', details: insertError.message },
          { status: 500 }
        );
      }

      giftCardIds.push(...(insertedCards?.map(c => c.id) || []));
    }

    return NextResponse.json({
      success: true,
      giftCardIds,
      message: `Saved ${giftCardIds.length} gift card code(s)`,
    });
  } catch (error) {
    console.error('Error in step-10-gift-cards:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


