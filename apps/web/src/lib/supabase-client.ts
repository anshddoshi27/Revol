/**
 * Client-side Supabase client
 * 
 * This file is safe to import in client components.
 * It does NOT import next/headers or any server-only dependencies.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton instance to prevent multiple client instances
let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client for client-side operations
 * 
 * This should be used in React components or client-side code.
 * It uses the anon key and relies on Supabase Auth for authentication.
 * Returns a singleton instance to prevent multiple client instances.
 * 
 * Usage in client components:
 * ```ts
 * 'use client';
 * const supabase = createClientClient();
 * ```
 */
export function createClientClient(): SupabaseClient {
  // Return singleton if already created
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  // Create singleton instance
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseClient;
}



