import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/db';
import { createOrGetCustomer, createSetupIntent, getPaymentMethodFromSetupIntent } from '@/lib/stripe';
import { emitNotification } from '@/lib/notifications';
import { createHash } from 'crypto';
import { resolveTenantSlug } from '@/lib/tenant-resolution';
import { addCorsHeaders, handleOptions } from '@/lib/cors';

/**
 * POST /api/public/{slug}/bookings
 * 
 * Creates a new booking with card setup (no charge yet)
 * No authentication required - this is a public endpoint
 * 
 * Supports both:
 * - Subdomain-based: {businessname}.main.tld → resolves from Host header
 * - Path-based: /api/public/{slug}/bookings → resolves from URL parameter
 * 
 * Body: {
 *   service_id: string
 *   staff_id: string
 *   start_at: string (ISO timestamp)
 *   customer: { name, email, phone }
 *   gift_card_code?: string
 *   consent_ip?: string
 *   consent_user_agent?: string
 * }
 */
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request) || new NextResponse(null, { status: 200 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Resolve tenant slug from Host header or URL parameter
    const tenantSlug = resolveTenantSlug(request, params.slug);
    const body = await request.json();
    const {
      service_id,
      staff_id,
      start_at,
      customer,
      gift_card_code,
    } = body;

    // Extract consent metadata from headers (for production compliance)
    const consent_ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      request.headers.get('x-real-ip') || 
                      null;
    const consent_user_agent = request.headers.get('user-agent') || null;

    if (!tenantSlug) {
      const response = NextResponse.json(
        { error: 'Subdomain is required' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    // Validate required fields
    if (!service_id || !staff_id || !start_at || !customer) {
      const response = NextResponse.json(
        { error: 'Missing required fields: service_id, staff_id, start_at, customer' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    if (!customer.name || !customer.email) {
      const response = NextResponse.json(
        { error: 'Customer name and email are required' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    const supabase = createAdminClient();

    // Get business by subdomain (only active or trial businesses can accept bookings)
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', tenantSlug)
      .in('subscription_status', ['active', 'trial'])
      .is('deleted_at', null)
      .single();

    if (businessError || !business) {
      const response = NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
      return addCorsHeaders(response, request);
    }

    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', service_id)
      .eq('business_id', business.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();

    if (serviceError || !service) {
      const response = NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
      return addCorsHeaders(response, request);
    }

    // Validate slot is still available (check unique constraint)
    const startAtDate = new Date(start_at);
    const endAtDate = new Date(startAtDate.getTime() + service.duration_min * 60 * 1000);

    // Check for existing bookings that overlap with this time slot
    const { data: existingBookings, error: bookingCheckError } = await supabase
      .from('bookings')
      .select('id, start_at, end_at')
      .eq('staff_id', staff_id)
      .eq('business_id', business.id)
      .in('status', ['pending', 'scheduled', 'held'])
      .is('deleted_at', null);

    if (bookingCheckError) {
      console.error('Error checking existing bookings:', bookingCheckError);
      const response = NextResponse.json(
        { error: 'Failed to validate slot availability' },
        { status: 500 }
      );
      return addCorsHeaders(response, request);
    }

    // Check if any existing booking overlaps with the requested slot
    const hasOverlap = existingBookings?.some(booking => {
      const bookingStart = new Date(booking.start_at);
      const bookingEnd = new Date(booking.end_at || booking.start_at);
      // Check if time ranges overlap
      return startAtDate < bookingEnd && endAtDate > bookingStart;
    });

    if (hasOverlap) {
      const response = NextResponse.json(
        { error: 'This time slot is no longer available' },
        { status: 409 }
      );
      return addCorsHeaders(response, request);
    }

    // Validate gift card if provided
    let final_price_cents = service.price_cents;
    let gift_card_id: string | null = null;
    let gift_card_amount_applied_cents = 0;

    if (gift_card_code) {
      const { data: giftCard, error: giftCardError } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('user_id', business.user_id)
        .eq('business_id', business.id)
        .eq('code', gift_card_code.toUpperCase().trim())
        .eq('is_active', true)
        .is('deleted_at', null)
        .single();

      if (giftCardError || !giftCard) {
        const response = NextResponse.json(
          { error: 'Invalid gift card code' },
          { status: 400 }
        );
        return addCorsHeaders(response, request);
      }

      // Check expiration
      if (giftCard.expires_at && new Date(giftCard.expires_at) < new Date()) {
        const response = NextResponse.json(
          { error: 'Gift card has expired' },
          { status: 400 }
        );
        return addCorsHeaders(response, request);
      }

      gift_card_id = giftCard.id;

      // Calculate discount
      if (giftCard.discount_type === 'amount') {
        // For amount-type gift cards, calculate remaining balance
        // by subtracting amounts already applied in pending/completed bookings
        const { data: existingBookings } = await supabase
          .from('bookings')
          .select('gift_card_amount_applied_cents, status')
          .eq('gift_card_id', giftCard.id)
          .in('status', ['pending', 'scheduled', 'completed', 'held'])
          .is('deleted_at', null);

        // Sum up amounts already applied in pending/completed bookings
        const alreadyAppliedCents = existingBookings?.reduce((sum, booking) => {
          return sum + (booking.gift_card_amount_applied_cents || 0);
        }, 0) || 0;

        // Calculate remaining available balance
        const remainingBalanceCents = Math.max(0, giftCard.current_balance_cents - alreadyAppliedCents);

        // Check if there's any remaining balance
        if (remainingBalanceCents <= 0) {
          const response = NextResponse.json(
            { error: 'Gift card has no remaining balance' },
            { status: 400 }
          );
          return addCorsHeaders(response, request);
        }

        // Apply only the remaining balance (not the full current_balance_cents)
        gift_card_amount_applied_cents = Math.min(remainingBalanceCents, service.price_cents);
        final_price_cents = service.price_cents - gift_card_amount_applied_cents;
      } else if (giftCard.discount_type === 'percent') {
        const percentOff = giftCard.percent_off || 0;
        if (percentOff <= 0 || percentOff > 100) {
          const response = NextResponse.json(
            { error: 'Invalid gift card discount percentage' },
            { status: 400 }
          );
          return addCorsHeaders(response, request);
        }
        gift_card_amount_applied_cents = Math.round((service.price_cents * percentOff) / 100);
        final_price_cents = service.price_cents - gift_card_amount_applied_cents;
      }

      if (final_price_cents < 0) {
        final_price_cents = 0;
        gift_card_amount_applied_cents = service.price_cents;
      }
    }

    // Get current active policy and create snapshot
    const { data: policy, error: policyError } = await supabase
      .from('business_policies')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (policyError) {
      console.error('Error fetching business policies:', policyError);
      const response = NextResponse.json(
        { error: 'Failed to fetch business policies', details: policyError.message },
        { status: 500 }
      );
      return addCorsHeaders(response, request);
    }

    if (!policy) {
      const response = NextResponse.json(
        { error: 'Business policies not found' },
        { status: 500 }
      );
      return addCorsHeaders(response, request);
    }

    // Create policy snapshot with all required fields
    const policySnapshot = {
      cancellation_policy_text: policy.cancellation_policy_text,
      no_show_policy_text: policy.no_show_policy_text,
      refund_policy_text: policy.refund_policy_text,
      cash_policy_text: policy.cash_policy_text,
      no_show_fee_type: policy.no_show_fee_type,
      no_show_fee_amount_cents: policy.no_show_fee_amount_cents,
      no_show_fee_percent: policy.no_show_fee_percent,
      cancel_fee_type: policy.cancel_fee_type,
      cancel_fee_amount_cents: policy.cancel_fee_amount_cents,
      cancel_fee_percent: policy.cancel_fee_percent,
      version: policy.version,
      snapshot_at: new Date().toISOString(),
    };

    // Calculate policy hash for compliance (SHA-256 of policy snapshot)
    const policyHash = createHash('sha256')
      .update(JSON.stringify(policySnapshot))
      .digest('hex');

    // Create or find customer
    let customerId: string;
    let stripeCustomerId: string;
    
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, stripe_customer_id')
      .eq('business_id', business.id)
      .eq('email', customer.email.toLowerCase().trim())
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      
      // Update customer info if needed
      const updateData: any = {
        name: customer.name,
        updated_at: new Date().toISOString(),
      };
      if (customer.phone) {
        // Format phone number (E.164 format: +1 followed by 10 digits)
        console.log('[booking-api] Updating existing customer phone:', customer.phone, 'length:', customer.phone.length);
        const digits = customer.phone.replace(/\D/g, '');
        console.log('[booking-api] Digits extracted for update:', digits, 'length:', digits.length);
        
        if (digits.length === 11 && digits.startsWith('1')) {
          updateData.phone = `+${digits}`;
        } else if (digits.length === 10) {
          updateData.phone = `+1${digits}`;
        } else if (customer.phone.startsWith('+')) {
          const plusDigits = customer.phone.replace(/[^\d]/g, '');
          if (plusDigits.length === 11 && plusDigits.startsWith('1')) {
            updateData.phone = customer.phone;
          } else if (plusDigits.length === 10) {
            updateData.phone = `+1${plusDigits}`;
          } else {
            updateData.phone = customer.phone;
          }
        } else if (digits.length >= 10) {
          const last10 = digits.slice(-10);
          updateData.phone = `+1${last10}`;
        } else {
          updateData.phone = customer.phone;
        }
        
        console.log('[booking-api] Formatted phone for update:', updateData.phone, 'length:', updateData.phone?.length);
      }
      
      await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId);

      // Get or create Stripe Customer ID
      if (existingCustomer.stripe_customer_id) {
        stripeCustomerId = existingCustomer.stripe_customer_id;
      } else {
        stripeCustomerId = await createOrGetCustomer(customer.email.toLowerCase().trim(), customer.name, {
          business_id: business.id,
        });
        await supabase
          .from('customers')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', customerId);
      }
    } else {
      // Create Stripe Customer first
      stripeCustomerId = await createOrGetCustomer(customer.email.toLowerCase().trim(), customer.name, {
        business_id: business.id,
      });

      // Format phone number (E.164 format: +1 followed by 10 digits)
      let formattedPhone: string | null = null;
      if (customer.phone) {
        // Log original phone for debugging
        console.log('[booking-api] Original phone from request:', customer.phone, 'length:', customer.phone.length);
        
        // Remove all non-digits
        const digits = customer.phone.replace(/\D/g, '');
        console.log('[booking-api] Digits extracted:', digits, 'length:', digits.length);
        
        // If it starts with 1 and has 11 digits, add +
        if (digits.length === 11 && digits.startsWith('1')) {
          formattedPhone = `+${digits}`;
        }
        // If it has 10 digits, add +1
        else if (digits.length === 10) {
          formattedPhone = `+1${digits}`;
        }
        // If it already starts with +, validate and use as-is
        else if (customer.phone.startsWith('+')) {
          const plusDigits = customer.phone.replace(/[^\d]/g, '');
          if (plusDigits.length === 11 && plusDigits.startsWith('1')) {
            formattedPhone = customer.phone;
          } else if (plusDigits.length === 10) {
            formattedPhone = `+1${plusDigits}`;
          } else {
            // Invalid format, but save as-is for now
            formattedPhone = customer.phone;
          }
        }
        // Otherwise, try to format
        else if (digits.length >= 10) {
          // Take last 10 digits if more than 10
          const last10 = digits.slice(-10);
          formattedPhone = `+1${last10}`;
        } else {
          // Too short, save as-is (will fail validation later)
          formattedPhone = customer.phone;
        }
        
        console.log('[booking-api] Formatted phone:', formattedPhone, 'length:', formattedPhone?.length);
      }

      // Create customer record
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          user_id: business.user_id,
          business_id: business.id,
          name: customer.name,
          email: customer.email.toLowerCase().trim(),
          phone: formattedPhone,
          stripe_customer_id: stripeCustomerId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (customerError || !newCustomer) {
        console.error('Error creating customer:', customerError);
        const response = NextResponse.json(
          { error: 'Failed to create customer', details: customerError?.message },
          { status: 500 }
        );
        return addCorsHeaders(response, request);
      }

      customerId = newCustomer.id;
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        user_id: business.user_id,
        business_id: business.id,
        customer_id: customerId,
        service_id,
        staff_id,
        status: 'pending',
        start_at: start_at,
        end_at: endAtDate.toISOString(),
        duration_min: service.duration_min,
        price_cents: service.price_cents,
        final_price_cents,
        gift_card_id,
        gift_card_amount_applied_cents,
        source: 'public',
        policy_snapshot: policySnapshot,
        // policy_hash: policyHash, // Column doesn't exist in schema - removed
        consent_at: new Date().toISOString(),
        consent_ip: consent_ip || null,
        consent_user_agent: consent_user_agent || null,
        payment_status: 'none', // Will be updated after SetupIntent succeeds
        last_money_action: 'none',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (bookingError || !booking) {
      console.error('Error creating booking:', bookingError);
      const response = NextResponse.json(
        { error: 'Failed to create booking', details: bookingError?.message },
        { status: 500 }
      );
      return addCorsHeaders(response, request);
    }

    // Create SetupIntent to save card (must use Stripe Customer ID, not email)
    if (!stripeCustomerId) {
      console.error('No Stripe customer ID available for SetupIntent');
      const response = NextResponse.json(
        { error: 'Failed to set up payment method' },
        { status: 500 }
      );
      return addCorsHeaders(response, request);
    }

    const setupIntent = await createSetupIntent(
      stripeCustomerId,
      {
        booking_id: booking.id,
        business_id: business.id,
      }
    );

    // Create booking payment record (status will be updated to 'card_saved' by webhook when SetupIntent succeeds)
    const { error: paymentError } = await supabase
      .from('booking_payments')
      .insert({
        user_id: business.user_id,
        business_id: business.id,
        booking_id: booking.id,
        stripe_setup_intent_id: setupIntent.setupIntentId,
        amount_cents: final_price_cents,
        money_action: 'none',
        status: 'none', // Will be updated to 'card_saved' by webhook when SetupIntent succeeds
        currency: 'usd',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (paymentError) {
      console.error('Error creating booking payment:', paymentError);
      // Continue anyway - payment can be updated later
    }

    // Generate booking code (e.g., REVOL-1234)
    const bookingCode = `REVOL-${booking.id.slice(0, 8).toUpperCase()}`;

    // Emit booking_created notification (async, don't wait)
    console.log(`[public-booking] Emitting booking_created notification for business ${business.id}, booking ${booking.id}, notifications_enabled: ${business.notifications_enabled}`);
    emitNotification(business.id, 'booking_created', booking.id, supabase).catch((err) => {
      console.error('[public-booking] Error emitting booking_created notification:', err);
      // Don't fail the request if notification fails
    });

    const response = NextResponse.json({
      booking_id: booking.id,
      booking_code: bookingCode,
      client_secret: setupIntent.clientSecret,
      setup_intent_id: setupIntent.setupIntentId,
      final_price_cents,
      message: 'Booking created successfully. Please complete payment setup.',
    });
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error('Error in public booking:', error);
    const response = NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}


