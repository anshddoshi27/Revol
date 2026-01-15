import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import type { GiftCardConfig } from '@/lib/onboarding-types';

// Force dynamic rendering since this route uses cookies
export const dynamic = 'force-dynamic';

/**
 * GET /api/business/onboarding/step-10-gift-cards
 * 
 * Retrieves gift card configuration
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
        { giftCards: { enabled: false, amountType: 'amount', amountValue: 10000, expirationEnabled: false, generatedCodes: [] } },
        { status: 200 }
      );
    }

    const supabase = await createServerClient();
    const { data: giftCards, error } = await supabase
      .from('gift_cards')
      .select('code, discount_type, initial_amount_cents, percent_off, expires_at')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[step-10-gift-cards] Error fetching gift cards:', error);
      return NextResponse.json(
        { error: 'Failed to fetch gift cards data' },
        { status: 500 }
      );
    }

    if (!giftCards || giftCards.length === 0) {
      return NextResponse.json({
        giftCards: {
          enabled: false,
          amountType: 'amount' as const,
          amountValue: 10000,
          expirationEnabled: false,
          generatedCodes: []
        }
      });
    }

    // Infer config from first gift card
    const firstCard = giftCards[0];
    const amountType = firstCard.discount_type === 'percent' ? 'percent' : 'amount';
    const amountValue = amountType === 'amount' 
      ? (firstCard.initial_amount_cents || 0) / 100
      : (firstCard.percent_off || 0);
    
    // Check if any cards have expiration dates
    const expirationEnabled = giftCards.some(card => card.expires_at !== null);
    const expirationMonths = expirationEnabled && giftCards[0]?.expires_at
      ? Math.round((new Date(giftCards[0].expires_at).getTime() - new Date().getTime()) / (30 * 24 * 60 * 60 * 1000))
      : undefined;

    const generatedCodes = giftCards.map(card => card.code);

    return NextResponse.json({
      giftCards: {
        enabled: true,
        amountType: amountType as 'amount' | 'percent',
        amountValue,
        expirationEnabled,
        expirationMonths,
        generatedCodes,
      }
    });
  } catch (error) {
    console.error('[step-10-gift-cards] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

      // Deduplicate codes (normalize to uppercase and remove duplicates within the input array)
      const uniqueCodes = Array.from(new Set(generatedCodes.map((code: string) => code.toUpperCase().trim())));

      const giftCardsToInsert = uniqueCodes.map((code: string) => {
        const giftCardData: any = {
          user_id: userId,
          business_id: businessId,
          code: code,
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

      // Insert gift cards (multi-tenant isolation ensures no conflicts with other businesses)
      const { data: insertedCards, error: insertError } = await supabase
        .from('gift_cards')
        .insert(giftCardsToInsert)
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


