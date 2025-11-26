import { createServerClient } from './db';
import { headers } from 'next/headers';

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
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    return user.id;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
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
      return null;
    }
    
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data.id;
  } catch (error) {
    console.error('Error getting current business:', error);
    return null;
  }
}




