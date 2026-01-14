import { createServerClient } from './db';
import { NextResponse } from 'next/server';

/**
 * Check idempotency key and return cached response if exists
 * Otherwise, return null to proceed with request
 */
export async function checkIdempotency(
  userId: string,
  route: string,
  key: string
): Promise<NextResponse | null> {
  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from('idempotency_keys')
    .select('response_json')
    .eq('user_id', userId)
    .eq('route', route)
    .eq('key', key)
    .single();

  if (existing && existing.response_json) {
    // Return cached response
    return NextResponse.json(existing.response_json);
  }

  return null;
}

/**
 * Store idempotency key and response
 */
export async function storeIdempotency(
  userId: string,
  route: string,
  key: string,
  response: any
): Promise<void> {
  const supabase = await createServerClient();

  await supabase
    .from('idempotency_keys')
    .upsert({
      user_id: userId,
      route,
      key,
      response_json: response,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'key,route',
      ignoreDuplicates: false,
    });
}


