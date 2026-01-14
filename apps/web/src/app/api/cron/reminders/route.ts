import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db';
import { emitNotification } from '@/lib/notifications';

/**
 * GET /api/cron/reminders
 * 
 * Schedules 24h and 1h reminder notifications
 * Should be called every 5-10 minutes
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
    
    // 24h reminder window: bookings starting between 23h 55m and 24h 5m from now
    const window24hStart = new Date(now.getTime() + (24 * 60 - 5) * 60 * 1000);
    const window24hEnd = new Date(now.getTime() + (24 * 60 + 5) * 60 * 1000);
    
    // 1h reminder window: bookings starting between 55m and 1h 5m from now
    const window1hStart = new Date(now.getTime() + (60 - 5) * 60 * 1000);
    const window1hEnd = new Date(now.getTime() + (60 + 5) * 60 * 1000);

    // Find bookings happening in 24h window (not reminded yet)
    const { data: bookings24h, error: error24h } = await supabase
      .from('bookings')
      .select('id, business_id')
      .in('status', ['pending', 'scheduled'])
      .gte('start_at', window24hStart.toISOString())
      .lte('start_at', window24hEnd.toISOString())
      .is('deleted_at', null);

    if (error24h) {
      console.error('Error fetching 24h reminders:', error24h);
    }

    // Find bookings happening in 1h window (not reminded yet)
    const { data: bookings1h, error: error1h } = await supabase
      .from('bookings')
      .select('id, business_id')
      .in('status', ['pending', 'scheduled'])
      .gte('start_at', window1hStart.toISOString())
      .lte('start_at', window1hEnd.toISOString())
      .is('deleted_at', null);

    if (error1h) {
      console.error('Error fetching 1h reminders:', error1h);
    }

    let reminders24h = 0;
    let reminders1h = 0;

    // Schedule 24h reminders
    if (bookings24h && bookings24h.length > 0) {
      for (const booking of bookings24h) {
        // Check if reminder already sent (by checking notification_jobs)
        const { data: existingReminder } = await supabase
          .from('notification_jobs')
          .select('id')
          .eq('booking_id', booking.id)
          .eq('trigger', 'reminder_24h')
          .in('status', ['pending', 'sent', 'in_progress'])
          .maybeSingle();

        if (!existingReminder && booking.business_id) {
          // Use emitNotification which loads all data and resolves templates
          await emitNotification(booking.business_id, 'reminder_24h', booking.id, supabase);
          reminders24h++;
        }
      }
    }

    // Schedule 1h reminders
    if (bookings1h && bookings1h.length > 0) {
      for (const booking of bookings1h) {
        const { data: existingReminder } = await supabase
          .from('notification_jobs')
          .select('id')
          .eq('booking_id', booking.id)
          .eq('trigger', 'reminder_1h')
          .in('status', ['pending', 'sent', 'in_progress'])
          .maybeSingle();

        if (!existingReminder && booking.business_id) {
          // Use emitNotification which loads all data and resolves templates
          await emitNotification(booking.business_id, 'reminder_1h', booking.id, supabase);
          reminders1h++;
        }
      }
    }

    return NextResponse.json({
      scheduled: reminders24h + reminders1h,
      reminders_24h: reminders24h,
      reminders_1h: reminders1h,
      message: `Scheduled ${reminders24h} 24h reminders and ${reminders1h} 1h reminders`,
    });
  } catch (error) {
    console.error('Error in reminders cron:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


