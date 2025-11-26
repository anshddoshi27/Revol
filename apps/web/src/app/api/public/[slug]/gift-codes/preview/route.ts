import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db';

/**
 * POST /api/public/{slug}/gift-codes/preview
 * 
 * Validates a gift card code and computes discount
 * No authentication required - this is a public endpoint
 * 
 * Body: {
 *   code: string
 *   base_price_cents: number
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();
    const { code, base_price_cents } = body;

    if (!slug) {
      return NextResponse.json(
        { error: 'Subdomain is required' },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Gift card code is required' },
        { status: 400 }
      );
    }

    if (!base_price_cents || typeof base_price_cents !== 'number') {
      return NextResponse.json(
        { error: 'base_price_cents is required and must be a number' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get business by subdomain (only active or trial businesses can use gift codes)
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, user_id')
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

    // Find gift card
    const { data: giftCard, error: giftCardError } = await supabase
      .from('gift_cards')
      .select('*')
      .eq('user_id', business.user_id)
      .eq('business_id', business.id)
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();

    if (giftCardError || !giftCard) {
      return NextResponse.json(
        { error: 'Invalid or inactive gift card code' },
        { status: 404 }
      );
    }

    // Check expiration
    if (giftCard.expires_at) {
      const expiresAt = new Date(giftCard.expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Gift card has expired' },
          { status: 400 }
        );
      }
    }

    // Calculate discount
    let discount_cents = 0;
    let final_price_cents = base_price_cents;
    const type = giftCard.discount_type; // 'amount' or 'percent'

    if (type === 'amount') {
      // Amount-type gift card: use current balance, but check it's positive
      if (giftCard.current_balance_cents <= 0) {
        return NextResponse.json(
          { error: 'Gift card has no remaining balance' },
          { status: 400 }
        );
      }
      discount_cents = Math.min(giftCard.current_balance_cents, base_price_cents);
      final_price_cents = base_price_cents - discount_cents;
    } else if (type === 'percent') {
      // Percent-type gift card: apply percentage
      const percentOff = giftCard.percent_off || 0;
      if (percentOff <= 0 || percentOff > 100) {
        return NextResponse.json(
          { error: 'Invalid gift card discount percentage' },
          { status: 400 }
        );
      }
      discount_cents = Math.round((base_price_cents * percentOff) / 100);
      final_price_cents = base_price_cents - discount_cents;
    }

    // Ensure final price is not negative
    if (final_price_cents < 0) {
      final_price_cents = 0;
      discount_cents = base_price_cents;
    }

    return NextResponse.json({
      discount_cents,
      final_price_cents,
      type,
      gift_card_id: giftCard.id,
      gift_card_balance_cents: type === 'amount' ? giftCard.current_balance_cents : null,
      percent_off: type === 'percent' ? giftCard.percent_off : null,
    });
  } catch (error) {
    console.error('Error in gift code preview:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


