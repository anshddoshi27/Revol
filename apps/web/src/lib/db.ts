import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

/**
 * Get Supabase client for server-side operations
 * 
 * This function returns different clients based on context:
 * - If called from an authenticated API route, uses the user's JWT from Authorization header (respects RLS)
 * - If called from a public route or background job, uses service role (bypasses RLS)
 * 
 * Usage in API routes:
 * ```ts
 * const supabase = await createServerClient();
 * const { data } = await supabase.from('businesses').select('*');
 * ```
 */
export async function createServerClient(): Promise<SupabaseClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseAnonKey && !supabaseServiceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY environment variable'
    );
  }

  // Try to get the user's JWT from Authorization header (for API routes)
  // or from cookies (for server components)
  let accessToken: string | undefined;
  
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
  } catch {
    // Not in a headers context, try cookies
    try {
      const cookieStore = await cookies();
      accessToken = cookieStore.get('sb-access-token')?.value;
    } catch {
      // Not in a cookies context either, continue without token
    }
  }

  // If we have a user token, use anon key with that token (respects RLS)
  if (accessToken && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  // For public routes or background jobs, use service role key
  // WARNING: This bypasses RLS - only use when necessary
  if (supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  // Fallback to anon key (for public read operations)
  return createClient(supabaseUrl, supabaseAnonKey!);
}

/**
 * Get Supabase client with service role (bypasses RLS)
 * 
 * Use this ONLY for:
 * - Background jobs
 * - Webhook handlers
 * - Admin operations that need to bypass RLS
 * 
 * Usage:
 * ```ts
 * const supabase = createAdminClient();
 * const { data } = await supabase.from('businesses').select('*');
 * ```
 */
export function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get Supabase client for client-side operations
 * 
 * This should be used in React components or client-side code.
 * It uses the anon key and relies on Supabase Auth for authentication.
 * 
 * Usage in client components:
 * ```ts
 * 'use client';
 * const supabase = createClientClient();
 * ```
 */
export function createClientClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

