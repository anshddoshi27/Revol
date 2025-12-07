import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/db';

/**
 * POST /api/auth/signup
 * 
 * Creates a new user account and a business record (with no name initially)
 * 
 * Body: {
 *   email: string
 *   password: string
 *   fullName: string
 *   phone?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, fullName, phone } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, fullName' },
        { status: 400 }
      );
    }

    // Validate email format before sending to Supabase
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create a fresh Supabase client for signup (don't use createServerClient as it reads cookies)
    // Use anon key directly for auth operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    // Create a fresh client without any session/cookies for signup
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log('[signup] Attempting to sign up with email:', normalizedEmail);
    console.log('[signup] Supabase URL:', supabaseUrl);

    // Create user account in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding`,
        // Disable email confirmation for development (if Supabase allows)
        // Note: This might not work if Supabase has email confirmation required
      },
    });

    if (authError) {
      console.error('[signup] Auth error:', authError);
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to create account';
      let statusCode = 400;
      
      if (authError.message?.includes('email_address_invalid') || authError.code === 'email_address_invalid') {
        errorMessage = `Invalid email address: "${normalizedEmail}". This error usually means:
1. Your Supabase project has email domain restrictions configured
2. Email confirmation is required and the email format doesn't pass validation
3. The Supabase project settings need to be updated

To fix this:
- Go to your Supabase Dashboard > Authentication > Settings
- Check "Email Auth" settings and ensure email confirmation is disabled for development
- Check if there are any email domain allowlists/blocklists configured
- Try using a different email address or check your Supabase project configuration`;
      } else if (authError.message?.includes('rate limit') || authError.message?.includes('too many requests') || authError.code === 'over_email_send_rate_limit') {
        errorMessage = `Email rate limit exceeded. This happens when too many signup emails are sent in a short time.

Solutions:
1. Wait 5-10 minutes and try again
2. Use a different email address
3. For development: Disable email confirmation in Supabase Dashboard > Authentication > Settings
4. Check your Supabase project's email rate limits in Dashboard > Settings > API`;
        statusCode = 429; // Too Many Requests
      } else if (authError.message?.includes('already registered') || authError.code === 'signup_disabled') {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (authError.message?.includes('password')) {
        errorMessage = 'Password does not meet requirements.';
      } else {
        errorMessage = authError.message || 'Failed to create account';
      }
      
      return NextResponse.json(
        { error: errorMessage, details: authError.message, code: authError.code },
        { status: statusCode }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    const userId = authData.user.id;
    console.log('[signup] User created in auth.users:', userId);

    // Use admin client to bypass RLS since user just signed up
    const adminSupabase = createAdminClient();
    
    // Check if there's a public.users table and create record if needed
    // The foreign key constraint might reference public.users instead of auth.users
    // This is a workaround until the migration fixes the constraint
    try {
      // Try to check if users table exists by attempting to query it
      const { data: existingUser, error: checkUserError } = await adminSupabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      
      // If table exists (no PGRST116 error) but user doesn't exist, create it
      if (!checkUserError && !existingUser) {
        console.log('[signup] users table exists but user record missing - creating it');
        const { error: createUserError } = await adminSupabase
          .from('users')
          .insert({
            id: userId,
            email: normalizedEmail,
            full_name: fullName,
            phone: phone || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        
        if (createUserError) {
          console.warn('[signup] Could not create user record in users table:', createUserError);
          // If insert fails due to missing columns, try with minimal fields
          if (createUserError.code === '42703' || createUserError.message?.includes('column')) {
            try {
              const { error: minimalError } = await adminSupabase
                .from('users')
                .insert({ id: userId });
              if (minimalError) {
                console.warn('[signup] Could not create minimal user record:', minimalError);
              } else {
                console.log('[signup] Created minimal user record in users table');
              }
            } catch (e) {
              console.warn('[signup] Failed to create minimal user record:', e);
            }
          }
        } else {
          console.log('[signup] User record created in users table');
        }
      } else if (checkUserError && checkUserError.code === 'PGRST116') {
        // Table doesn't exist - that's fine, foreign key should reference auth.users
        console.log('[signup] users table does not exist - foreign key should reference auth.users');
      } else if (checkUserError) {
        console.warn('[signup] Error checking users table:', checkUserError);
      }
    } catch (error) {
      // users table might not exist or have different structure
      console.log('[signup] users table check failed:', error);
    }

    // Create business record with no name (will be updated in step 1)
    // Set notifications_enabled to false (Basic plan) by default - user can change in step 8
    const { data: business, error: businessError } = await adminSupabase
      .from('businesses')
      .insert({
        user_id: userId,
        name: '', // Empty name - will be set in step 1
        subdomain: `temp-${Date.now()}`, // Temporary, will be updated in step 2
        timezone: 'America/New_York', // Default, will be updated in step 3
        industry: 'other', // Default, will be updated in step 1
        notifications_enabled: false, // Default to Basic plan ($11.99/month) - user can upgrade in step 8
      })
      .select('id')
      .single();

    if (businessError || !business) {
      console.error('[signup] Error creating business:', businessError);
      // Don't fail the signup if business creation fails - user can still proceed
      // The business will be created in step 1 if it doesn't exist
      console.warn('[signup] Business creation failed, but user account was created. Business will be created in step 1.');
    } else {
      console.log('[signup] Business created:', business.id);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      businessId: business?.id || null,
      message: 'Account created successfully. Please check your email to verify your account.',
    });
  } catch (error) {
    console.error('[signup] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

