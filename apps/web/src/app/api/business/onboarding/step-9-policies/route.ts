import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import type { PoliciesConfig } from '@/lib/onboarding-types';

/**
 * GET /api/business/onboarding/step-9-policies
 * 
 * Retrieves current active policies
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
        { policies: null },
        { status: 200 }
      );
    }

    const supabase = await createServerClient();
    const { data: policy, error } = await supabase
      .from('business_policies')
      .select('cancellation_policy_text, cancel_fee_type, cancel_fee_amount_cents, cancel_fee_percent, no_show_policy_text, no_show_fee_type, no_show_fee_amount_cents, no_show_fee_percent, refund_policy_text, cash_policy_text')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[step-9-policies] Error fetching policies:', error);
      return NextResponse.json(
        { error: 'Failed to fetch policies data' },
        { status: 500 }
      );
    }

    if (!policy) {
      return NextResponse.json(
        { policies: null },
        { status: 200 }
      );
    }

    // Convert fee types: 'flat' -> 'amount', 'percent' -> 'percent'
    const cancellationFeeType = policy.cancel_fee_type === 'flat' ? 'amount' : 'percent';
    const cancellationFeeValue = cancellationFeeType === 'amount' 
      ? (policy.cancel_fee_amount_cents || 0) / 100
      : (policy.cancel_fee_percent || 0);
    
    const noShowFeeType = policy.no_show_fee_type === 'flat' ? 'amount' : 'percent';
    const noShowFeeValue = noShowFeeType === 'amount'
      ? (policy.no_show_fee_amount_cents || 0) / 100
      : (policy.no_show_fee_percent || 0);

    return NextResponse.json({
      policies: {
        cancellationPolicy: policy.cancellation_policy_text || '',
        cancellationFeeType: cancellationFeeType as 'amount' | 'percent',
        cancellationFeeValue,
        noShowPolicy: policy.no_show_policy_text || '',
        noShowFeeType: noShowFeeType as 'amount' | 'percent',
        noShowFeeValue,
        refundPolicy: policy.refund_policy_text || '',
        cashPolicy: policy.cash_policy_text || '',
      }
    });
  } catch (error) {
    console.error('[step-9-policies] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    // Convert 'flat' to 'amount' for database enum (which only accepts 'amount' or 'percent')
    const cancelFeeTypeDb = cancellationFeeType === 'flat' ? 'amount' : cancellationFeeType;
    const noShowFeeTypeDb = noShowFeeType === 'flat' ? 'amount' : noShowFeeType;

    // Insert new policy version
    const policyData = {
      user_id: userId,
      business_id: businessId,
      version: nextVersion,
      cancellation_policy_text: cancellationPolicy,
      cancel_fee_type: cancelFeeTypeDb, // 'flat' -> 'amount', 'percent' -> 'percent'
      cancel_fee_amount_cents: cancellationFeeType === 'flat' ? Math.round(cancellationFeeValue * 100) : null,
      cancel_fee_percent: cancellationFeeType === 'percent' ? cancellationFeeValue : null,
      no_show_policy_text: noShowPolicy,
      no_show_fee_type: noShowFeeTypeDb,
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

