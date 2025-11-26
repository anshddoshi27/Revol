import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import type { PoliciesConfig } from '@/lib/onboarding-types';

/**
 * PUT /api/business/onboarding/step-9-policies
 * 
 * Creates a new version of business policies
 * 
 * Body: PoliciesConfig type
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

    const body: PoliciesConfig = await request.json();
    const {
      cancellationPolicy,
      cancellationFeeType,
      cancellationFeeValue,
      noShowPolicy,
      noShowFeeType,
      noShowFeeValue,
      refundPolicy,
      cashPolicy,
    } = body;

    // Validate required fields
    if (
      cancellationPolicy === undefined ||
      cancellationFeeType === undefined ||
      cancellationFeeValue === undefined ||
      noShowPolicy === undefined ||
      noShowFeeType === undefined ||
      noShowFeeValue === undefined ||
      refundPolicy === undefined ||
      cashPolicy === undefined
    ) {
      return NextResponse.json(
        { error: 'Missing required policy fields' },
        { status: 400 }
      );
    }

    // Validate fee types
    if (!['flat', 'percent'].includes(cancellationFeeType) || !['flat', 'percent'].includes(noShowFeeType)) {
      return NextResponse.json(
        { error: 'Fee types must be "flat" or "percent"' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get current policy version
    const { data: currentPolicy } = await supabase
      .from('business_policies')
      .select('version')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = currentPolicy ? currentPolicy.version + 1 : 1;

    // Mark old version as inactive
    if (currentPolicy) {
      await supabase
        .from('business_policies')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .eq('is_active', true);
    }

    // Insert new policy version
    const policyData = {
      user_id: userId,
      business_id: businessId,
      version: nextVersion,
      cancellation_policy_text: cancellationPolicy,
      cancel_fee_type: cancellationFeeType, // 'flat' -> 'amount', 'percent' -> 'percent'
      cancel_fee_amount_cents: cancellationFeeType === 'flat' ? Math.round(cancellationFeeValue * 100) : null,
      cancel_fee_percent: cancellationFeeType === 'percent' ? cancellationFeeValue : null,
      no_show_policy_text: noShowPolicy,
      no_show_fee_type: noShowFeeType,
      no_show_fee_amount_cents: noShowFeeType === 'flat' ? Math.round(noShowFeeValue * 100) : null,
      no_show_fee_percent: noShowFeeType === 'percent' ? noShowFeeValue : null,
      refund_policy_text: refundPolicy,
      cash_policy_text: cashPolicy,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedPolicy, error: insertError } = await supabase
      .from('business_policies')
      .insert(policyData)
      .select('id, version')
      .single();

    if (insertError) {
      console.error('Error inserting policy:', insertError);
      return NextResponse.json(
        { error: 'Failed to save policies', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      policyId: insertedPolicy.id,
      version: insertedPolicy.version,
      message: 'Policies saved successfully',
    });
  } catch (error) {
    console.error('Error in step-9-policies:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

