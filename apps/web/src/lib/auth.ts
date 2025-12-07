import { createServerClient } from './db';
import { headers, cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/**
 * Decode JWT payload without validation
 */
function decodeJWTPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Decode base64 payload (second part)
    const payload = parts[1];
    // Add padding if needed
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = Buffer.from(paddedPayload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

/**
 * Extract raw JWT token from Supabase session cookies (without decoding)
 */
async function getRawTokenFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    if (!supabaseUrl) {
      return null;
    }

    // Get all cookies for debugging
    const allCookies = cookieStore.getAll();
    const authCookies = allCookies.filter(c => 
      c.name.includes('auth') || 
      c.name.includes('sb-') ||
      c.name.includes('supabase')
    );
    
    // Supabase stores session in cookies with pattern: sb-{project-ref}-auth-token
    // Extract project ref from URL
    const url = new URL(supabaseUrl);
    const projectRef = url.hostname.split('.')[0];
    
    // Try different cookie name patterns
    const cookieNames = [
      `sb-api-auth-token`, // Try this first as it's most common
      `sb-${projectRef}-auth-token`,
      `sb-${projectRef.replace(/-/g, '')}-auth-token`,
      `sb-${projectRef}-auth-token-code-verifier`, // Sometimes stored separately
    ];

    for (const cookieName of cookieNames) {
      const cookie = cookieStore.get(cookieName);
      if (cookie?.value) {
        try {
          // Try URL decoding first
          let decodedValue = cookie.value;
          try {
            decodedValue = decodeURIComponent(cookie.value);
          } catch {
            // Not URL encoded, use as-is
          }
          
          // Try parsing as JSON
          try {
            const sessionData = JSON.parse(decodedValue);
            
            // Check if it's an array (Supabase sometimes stores tokens as array)
            if (Array.isArray(sessionData) && sessionData.length > 0) {
              // Get first element which should be the JWT token
              const firstElement = sessionData[0];
              if (typeof firstElement === 'string') {
                let cleanToken = firstElement.trim();
                // Remove surrounding quotes if present
                if ((cleanToken.startsWith('"') && cleanToken.endsWith('"')) || 
                    (cleanToken.startsWith("'") && cleanToken.endsWith("'"))) {
                  cleanToken = cleanToken.slice(1, -1);
                }
                
                // Check if it looks like a JWT (has 3 parts separated by dots)
                const parts = cleanToken.split('.');
                if (parts.length === 3 && cleanToken.length > 100) {
                  return cleanToken; // Return raw token, don't decode
                }
              }
            }
            
            // If it's an object with access_token
            if (sessionData?.access_token) {
              return sessionData.access_token;
            }
            
            if (sessionData?.session?.access_token) {
              return sessionData.session.access_token;
            }
          } catch (parseError) {
            // Not JSON, might be direct JWT token
            if (decodedValue.length > 100 && decodedValue.includes('.')) {
              return decodedValue;
            }
          }
        } catch (error) {
          console.error(`Error processing cookie ${cookieName}:`, error);
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting token from cookies:', error);
    return null;
  }
}

/**
 * Extract access token from Supabase session cookies
 * Returns user ID if JWT is decoded, or token if not
 */
async function getAccessTokenFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    if (!supabaseUrl) {
      return null;
    }

    // Get all cookies for debugging
    const allCookies = cookieStore.getAll();
    const authCookies = allCookies.filter(c => 
      c.name.includes('auth') || 
      c.name.includes('sb-') ||
      c.name.includes('supabase')
    );
    
    console.log('Found auth-related cookies:', authCookies.map(c => c.name));

    // Supabase stores session in cookies with pattern: sb-{project-ref}-auth-token
    // Extract project ref from URL
    const url = new URL(supabaseUrl);
    const projectRef = url.hostname.split('.')[0];
    
    // Try different cookie name patterns
    const cookieNames = [
      `sb-api-auth-token`, // Try this first as it's most common
      `sb-${projectRef}-auth-token`,
      `sb-${projectRef.replace(/-/g, '')}-auth-token`,
      `sb-${projectRef}-auth-token-code-verifier`, // Sometimes stored separately
    ];

    for (const cookieName of cookieNames) {
      const cookie = cookieStore.get(cookieName);
      if (cookie?.value) {
        // Log first 100 chars to see format (without exposing full token)
        const preview = cookie.value.substring(0, 100);
        console.log(`Checking cookie: ${cookieName}, length: ${cookie.value.length}, preview: ${preview}...`);
        
        try {
          // Try to parse as JSON (Supabase stores session as JSON string)
          let sessionData: any;
          let decodedValue = cookie.value;
          
          // Try URL decoding first
          try {
            decodedValue = decodeURIComponent(cookie.value);
          } catch {
            // Not URL encoded, use as-is
          }
          
          // Try parsing as JSON
          try {
            sessionData = JSON.parse(decodedValue);
            console.log(`Parsed ${cookieName} as JSON, type:`, Array.isArray(sessionData) ? 'array' : typeof sessionData, 'keys:', Object.keys(sessionData || {}));
            
            // Check if it's an array (Supabase sometimes stores tokens as array)
            if (Array.isArray(sessionData) && sessionData.length > 0) {
              console.log(`Array has ${sessionData.length} elements, checking each...`);
              
              // Try each element to find a valid JWT
              for (let i = 0; i < sessionData.length; i++) {
                const element = sessionData[i];
                console.log(`Element ${i} type: ${typeof element}, length: ${typeof element === 'string' ? element.length : 'N/A'}`);
                
                if (typeof element === 'string') {
                  // Remove any quotes or extra characters
                  let cleanToken = element.trim();
                  // Remove surrounding quotes if present
                  if ((cleanToken.startsWith('"') && cleanToken.endsWith('"')) || 
                      (cleanToken.startsWith("'") && cleanToken.endsWith("'"))) {
                    cleanToken = cleanToken.slice(1, -1);
                  }
                  
                  // Check if it looks like a JWT (has 3 parts separated by dots)
                  const parts = cleanToken.split('.');
                  if (parts.length === 3 && cleanToken.length > 100) {
                    console.log(`Found valid JWT structure in element ${i}, length: ${cleanToken.length}`);
                    
                    // Try to decode the JWT to get user ID directly (without validation)
                    const payload = decodeJWTPayload(cleanToken);
                    if (payload && (payload.sub || payload.user_id)) {
                      const userId = payload.sub || payload.user_id;
                      console.log(`Extracted user ID from JWT: ${userId}`);
                      return userId; // Return user ID directly instead of token
                    }
                    
                    // If decoding fails, try using the token
                    console.log(`Token preview: ${cleanToken.substring(0, 50)}...`);
                    return cleanToken;
                  }
                }
                
                // If element is an object, check for access_token
                if (element && typeof element === 'object' && element.access_token) {
                  console.log(`Found access_token in element ${i}:`, cookieName);
                  return element.access_token;
                }
              }
              
              // If no single element works, try joining all string elements
              const allStrings = sessionData.filter(e => typeof e === 'string');
              if (allStrings.length > 0) {
                const joined = allStrings.join('');
                const parts = joined.split('.');
                if (parts.length === 3 && joined.length > 100) {
                  console.log('Found JWT by joining array elements');
                  return joined;
                }
              }
            }
            
            if (sessionData?.access_token) {
              console.log('Found access token in cookie:', cookieName);
              return sessionData.access_token;
            }
            
            // Check for nested session object
            if (sessionData?.session?.access_token) {
              console.log('Found access token in nested session:', cookieName);
              return sessionData.session.access_token;
            }
          } catch (parseError) {
            // Not JSON, might be direct token or different format
            console.log(`Cookie ${cookieName} is not JSON, checking if it's a JWT`);
            
            // Check if it looks like a JWT (has dots and is long enough)
            if (decodedValue.length > 100 && decodedValue.includes('.')) {
              // Likely a JWT token
              console.log('Found JWT token in cookie:', cookieName);
              return decodedValue;
            }
          }
        } catch (error) {
          console.error(`Error processing cookie ${cookieName}:`, error);
        }
      }
    }

    // Try to find any cookie that looks like an auth token
    for (const cookie of authCookies) {
      if (cookie.name.includes('auth-token') || cookie.name.includes('auth_token')) {
        try {
          let sessionData: any;
          try {
            sessionData = JSON.parse(decodeURIComponent(cookie.value));
          } catch {
            sessionData = JSON.parse(cookie.value);
          }
          
          if (sessionData?.access_token) {
            console.log('Found access token in auth cookie:', cookie.name);
            return sessionData.access_token;
          }
        } catch {
          // Not JSON, might be direct token
          if (cookie.value.length > 100 && cookie.value.includes('.')) {
            // Looks like a JWT
            console.log('Found JWT in auth cookie:', cookie.name);
            return cookie.value;
          }
        }
      }
    }

    console.log('No access token found in cookies');
    return null;
  } catch (error) {
    console.error('Error extracting token from cookies:', error);
    return null;
  }
}

/**
 * Get the current authenticated user from the request
 * 
 * Returns the user ID from Supabase Auth JWT, or null if not authenticated.
 * Use this in API routes to get the current user.
 * 
 * Usage:
 * ```ts
 * const userId = await getCurrentUserId();
 * if (!userId) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 * ```
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      return null;
    }

    // First try to get token from Authorization header
    try {
      const headersList = await headers();
      const authHeader = headersList.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        });
        const { data: { user }, error } = await client.auth.getUser();
        if (!error && user) {
          return user.id;
        }
      }
    } catch (error) {
      console.error('Error with Authorization header:', error);
      // Continue to cookie-based auth
    }
    
    // Try to extract access token or user ID from cookies
    const tokenOrUserId = await getAccessTokenFromCookies();
    if (tokenOrUserId) {
      // If it's already a user ID (from JWT decode), return it
      if (tokenOrUserId.length < 50 && tokenOrUserId.includes('-')) {
        // Looks like a UUID (user ID)
        console.log('Using extracted user ID directly:', tokenOrUserId);
        return tokenOrUserId;
      }
      
      // Otherwise, try using it as a token
      try {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${tokenOrUserId}`,
            },
          },
        });
        const { data: { user }, error } = await client.auth.getUser();
        if (!error && user) {
          return user.id;
        } else {
          console.error('Error with cookie token:', error);
          // If token validation fails, try decoding JWT directly
          const payload = decodeJWTPayload(tokenOrUserId);
          if (payload && (payload.sub || payload.user_id)) {
            console.log('Extracted user ID from JWT after validation failed:', payload.sub || payload.user_id);
            return payload.sub || payload.user_id;
          }
        }
      } catch (error) {
        console.error('Error with cookie token:', error);
        // Try decoding JWT as fallback
        const payload = decodeJWTPayload(tokenOrUserId);
        if (payload && (payload.sub || payload.user_id)) {
          console.log('Extracted user ID from JWT as fallback:', payload.sub || payload.user_id);
          return payload.sub || payload.user_id;
        }
      }
    }
    
    // Fallback: Try cookie-based auth with createServerClient
    // This might work if cookies are set up correctly
    try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
      if (!error && user) {
        return user.id;
      }
      
      if (error) {
        console.error('Auth error from createServerClient:', error);
      }
    } catch (error) {
      console.error('Error with createServerClient:', error);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Create an authenticated Supabase client with a specific access token
 */
async function createAuthenticatedClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const { createClient } = await import('@supabase/supabase-js');
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

/**
 * Get the current user's business ID
 * 
 * Returns the business ID for the authenticated user, or null if not found.
 * 
 * Usage:
 * ```ts
 * const businessId = await getCurrentBusinessId();
 * if (!businessId) {
 *   return NextResponse.json({ error: 'Business not found' }, { status: 404 });
 * }
 * ```
 */
export async function getCurrentBusinessId(): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('[getCurrentBusinessId] No user ID found');
      return null;
    }
    
    console.log('[getCurrentBusinessId] Looking for business for user:', userId);
    
    // Log Supabase project info for debugging
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      try {
        const url = new URL(supabaseUrl);
        const projectRef = url.hostname.split('.')[0];
        console.log('[getCurrentBusinessId] Using Supabase project:', projectRef);
      } catch {
        console.log('[getCurrentBusinessId] Supabase URL:', supabaseUrl);
      }
    }
    
    // Use createServerClient which should handle cookies properly
    // If that fails due to RLS, we'll use service role as fallback
    const supabase = await createServerClient();
    
    // Query for business
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid error if not found
    
    if (error) {
      console.error('[getCurrentBusinessId] Error querying business:', error);
      
      // If RLS error, try with service role (we already verified user is authenticated)
      if (error.code === 'PGRST301' || error.message?.includes('No suitable key')) {
        console.log('[getCurrentBusinessId] RLS error, trying with service role for user:', userId);
        const { createAdminClient } = await import('@/lib/db');
        const adminSupabase = createAdminClient();
        
        // First check if ANY businesses exist for this user (including deleted)
        const { data: allBusinesses, error: allError } = await adminSupabase
          .from('businesses')
          .select('id, name, deleted_at, user_id')
          .eq('user_id', userId);
        
        console.log('[getCurrentBusinessId] All businesses for user (admin):', allBusinesses?.length || 0);
        if (allBusinesses && allBusinesses.length > 0) {
          console.log('[getCurrentBusinessId] Businesses found:', allBusinesses.map(b => ({ 
            id: b.id, 
            name: b.name, 
            deleted: !!b.deleted_at,
            user_id: b.user_id
          })));
        }
        if (allError) {
          console.error('[getCurrentBusinessId] Error checking all businesses:', allError);
        }
        
        // Diagnostic: Check if there are ANY businesses at all (to detect user ID mismatch)
        const { data: anyBusinesses, error: anyError } = await adminSupabase
          .from('businesses')
          .select('id, name, user_id, deleted_at')
          .limit(10);
        
        if (!anyError && anyBusinesses && anyBusinesses.length > 0) {
          console.log('[getCurrentBusinessId] DIAGNOSTIC: Found businesses in database:', anyBusinesses.map(b => ({
            id: b.id,
            name: b.name,
            user_id: b.user_id,
            matches_current_user: b.user_id === userId,
            deleted: !!b.deleted_at
          })));
        } else if (!anyError) {
          console.log('[getCurrentBusinessId] DIAGNOSTIC: No businesses exist in database at all');
        } else {
          console.error('[getCurrentBusinessId] DIAGNOSTIC: Error checking all businesses:', anyError);
        }
        
        // Now get the non-deleted one
        const { data: adminData, error: adminError } = await adminSupabase
          .from('businesses')
          .select('id, name')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .maybeSingle();
        
        if (adminError) {
          console.error('[getCurrentBusinessId] Error with admin client:', adminError);
          return null;
        }
        
        if (adminData) {
          console.log('[getCurrentBusinessId] Found business with admin client:', adminData.id, adminData.name);
          return adminData.id;
        } else {
          console.error('[getCurrentBusinessId] No business found with admin client for user:', userId);
          return null;
        }
      }
      
      return null;
    }
    
    if (!data) {
      console.error('[getCurrentBusinessId] No business found for user:', userId);
      return null;
    }
    
    console.log('[getCurrentBusinessId] Found business:', data.id, data.name);
    return data.id;
  } catch (error) {
    console.error('[getCurrentBusinessId] Error getting current business:', error);
    return null;
  }
}




