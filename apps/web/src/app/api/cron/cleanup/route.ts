import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db';

/**
 * GET /api/cron/cleanup
 * 
 * Comprehensive cleanup job that runs daily at 3 AM UTC
 * Handles:
 * 1. Expired held bookings (status = 'held' with held_expires_at < now() and no card saved)
 * 2. Old idempotency_keys (older than 30 days)
 * 3. Dead notification_jobs (failed with retry_count >= 3, older than 7 days)
 * 4. Archive old notification_events (older than 1 year) - optional
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    let expiredHolds = 0;
    let cleanedKeys = 0;
    let deadJobs = 0;
    let archivedEvents = 0;

    // 1. Expire held bookings that have expired and have no card saved
    const { data: expiredHeldBookings, error: heldError } = await supabase
      .from('bookings')
      .select('id')
      .eq('status', 'held')
      .lt('held_expires_at', now.toISOString())
      .is('deleted_at', null);

    if (heldError) {
      console.error('Error fetching expired held bookings:', heldError);
    } else if (expiredHeldBookings && expiredHeldBookings.length > 0) {
      // Only delete if stripe_setup_intent_id is NULL (no card was saved)
      const { data: bookingsToDelete } = await supabase
        .from('bookings')
        .select('id')
        .in('id', expiredHeldBookings.map(b => b.id))
        .is('stripe_setup_intent_id', null);

      if (bookingsToDelete && bookingsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('bookings')
          .delete()
          .in('id', bookingsToDelete.map(b => b.id));

        if (deleteError) {
          console.error('Error deleting expired held bookings:', deleteError);
        } else {
          expiredHolds = bookingsToDelete.length;
        }
      }

      // For held bookings with cards saved, update status to 'pending' (card was saved but booking not finalized)
      const { data: bookingsWithCard } = await supabase
        .from('bookings')
        .select('id')
        .in('id', expiredHeldBookings.map(b => b.id))
        .not('stripe_setup_intent_id', 'is', null);

      if (bookingsWithCard && bookingsWithCard.length > 0) {
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ status: 'pending', held_expires_at: null })
          .in('id', bookingsWithCard.map(b => b.id));

        if (updateError) {
          console.error('Error updating held bookings with cards:', updateError);
        }
      }
    }

    // 2. Delete old idempotency_keys (older than 30 days)
    // First get count, then delete
    const { count: keysCount } = await supabase
      .from('idempotency_keys')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', thirtyDaysAgo.toISOString());

    cleanedKeys = keysCount || 0;

    if (cleanedKeys > 0) {
      const { error: keysError } = await supabase
        .from('idempotency_keys')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString());

      if (keysError) {
        console.error('Error deleting old idempotency keys:', keysError);
        cleanedKeys = 0; // Reset count if deletion failed
      }
    }

    // 3. Mark dead notification_jobs (failed with retry_count >= 3, older than 7 days)
    const { data: deadJobsData, error: deadJobsError } = await supabase
      .from('notification_jobs')
      .select('id')
      .eq('status', 'failed')
      .gte('attempt_count', 3)
      .lt('created_at', sevenDaysAgo.toISOString());

    if (deadJobsError) {
      console.error('Error fetching dead notification jobs:', deadJobsError);
    } else if (deadJobsData && deadJobsData.length > 0) {
      const { error: updateDeadError } = await supabase
        .from('notification_jobs')
        .update({ status: 'dead' })
        .in('id', deadJobsData.map(j => j.id));

      if (updateDeadError) {
        console.error('Error marking dead notification jobs:', updateDeadError);
      } else {
        deadJobs = deadJobsData.length;
      }
    }

    // 4. Archive old notification_events (optional - just mark for now, actual archiving would require separate storage)
    // For now, we'll just count them - actual archiving to cold storage would be a separate process
    const { data: oldEvents } = await supabase
      .from('notification_events')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', oneYearAgo.toISOString());

    archivedEvents = oldEvents?.length || 0;
    // Note: Actual archiving would move these to cold storage (S3, etc.)
    // For now, we just report the count

    return NextResponse.json({
      expired_holds: expiredHolds,
      cleaned_keys: cleanedKeys,
      dead_jobs: deadJobs,
      archived_events: archivedEvents,
      message: `Cleanup completed: ${expiredHolds} expired holds, ${cleanedKeys} keys cleaned, ${deadJobs} jobs marked dead, ${archivedEvents} events ready for archive`,
    });
  } catch (error) {
    console.error('Error in cleanup cron:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


