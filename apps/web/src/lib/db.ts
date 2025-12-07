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
  let accessToken: string | undefined;
  
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
  } catch {
    // Not in a headers context
  }

  // If we have a user token from header, use anon key with that token (respects RLS)
  if (accessToken && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  // Try to get session from cookies (Supabase stores session in cookies)
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // Try to extract access token from cookies first
    const supabaseUrlObj = new URL(supabaseUrl);
    const projectRef = supabaseUrlObj.hostname.split('.')[0];
    
    // Look for Supabase auth token cookie
    // Try sb-api-auth-token first as it's the most common
    const authCookieNames = [
      `sb-api-auth-token`,
      `sb-${projectRef}-auth-token`,
    ];
    
    let accessToken: string | undefined;
    for (const cookieName of authCookieNames) {
      const cookie = cookieStore.get(cookieName);
      if (cookie?.value) {
        // Log first 100 chars to see format (without exposing full token)
        const preview = cookie.value.substring(0, 100);
        console.log(`[createServerClient] Checking cookie: ${cookieName}, length: ${cookie.value.length}, preview: ${preview}...`);
        try {
          // Try URL decoding first
          let decodedValue = cookie.value;
          try {
            decodedValue = decodeURIComponent(cookie.value);
          } catch {
            // Not URL encoded
          }
          
          // Try parsing as JSON
          try {
            const session = JSON.parse(decodedValue);
            console.log(`[createServerClient] Parsed ${cookieName} as JSON, type:`, Array.isArray(session) ? 'array' : typeof session, 'keys:', Object.keys(session || {}));
            
            // Check if it's an array (Supabase sometimes stores tokens as array)
            if (Array.isArray(session) && session.length > 0) {
              console.log(`[createServerClient] Array has ${session.length} elements, checking each...`);
              
              // Try each element to find a valid JWT
              for (let i = 0; i < session.length; i++) {
                const element = session[i];
                
                if (typeof element === 'string') {
                  // Remove any quotes or extra characters
                  let cleanToken = element.trim();
                  if ((cleanToken.startsWith('"') && cleanToken.endsWith('"')) || 
                      (cleanToken.startsWith("'") && cleanToken.endsWith("'"))) {
                    cleanToken = cleanToken.slice(1, -1);
                  }
                  
                  // Check if it looks like a JWT (has 3 parts separated by dots)
                  const parts = cleanToken.split('.');
                  if (parts.length === 3 && cleanToken.length > 100) {
                    console.log(`[createServerClient] Found valid JWT structure in element ${i}, using it as access token`);
                    // Use this token - even if signature validation fails later, 
                    // Supabase might still accept it for RLS if the payload is valid
                    accessToken = cleanToken;
                    break;
                  }
                }
                
                // If element is an object, check for access_token
                if (element && typeof element === 'object' && element.access_token) {
                  console.log(`[createServerClient] Found access_token in element ${i}: ${cookieName}`);
                  accessToken = element.access_token;
                  break;
                }
              }
              
              if (accessToken) {
                break;
              }
              
              // If no single element works, try joining all string elements
              const allStrings = session.filter(e => typeof e === 'string');
              if (allStrings.length > 0) {
                const joined = allStrings.join('');
                const parts = joined.split('.');
                if (parts.length === 3 && joined.length > 100) {
                  console.log('[createServerClient] Found JWT by joining array elements');
                  accessToken = joined;
                  break;
                }
              }
            }
            
            if (session?.access_token) {
              console.log(`[createServerClient] Found access_token in ${cookieName}`);
              accessToken = session.access_token;
              break;
            }
            
            // Check for nested session object
            if (session?.session?.access_token) {
              console.log(`[createServerClient] Found access_token in nested session: ${cookieName}`);
              accessToken = session.session.access_token;
              break;
            }
          } catch (parseError) {
            // Not JSON, might be direct JWT token
            console.log(`[createServerClient] ${cookieName} is not JSON, checking if JWT`);
            if (decodedValue.length > 100 && decodedValue.includes('.')) {
              console.log(`[createServerClient] Using ${cookieName} as direct JWT token`);
              accessToken = decodedValue;
              break;
            }
          }
        } catch (error) {
          console.error(`[createServerClient] Error processing ${cookieName}:`, error);
        }
      }
    }
    
    // If we found an access token, use it directly
    if (accessToken && supabaseAnonKey) {
      return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
    
    // Fallback: Build cookie header for Supabase to read
    const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    if (cookieHeader && supabaseAnonKey) {
      // Create client with cookies - Supabase will extract session from cookies
      return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Cookie: cookieHeader,
          },
        },
        auth: {
          persistSession: false, // We're handling cookies manually
          autoRefreshToken: false,
        },
      });
    }
  } catch (error) {
    console.error('Error reading cookies in createServerClient:', error);
    // Not in a cookies context, continue
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

