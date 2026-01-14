import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db';
import { sendEmailViaSendGrid, sendSMSViaTwilio } from '@/lib/notification-senders';

/**
 * GET /api/cron/notifications
 * 
 * Processes pending notification jobs
 * Should be called by a cron job every 2 minutes (configured in vercel.json)
 * 
 * Handles:
 * - Pending jobs (status = 'pending')
 * - Failed jobs with retry_count < 3 and next_retry_at <= now()
 * 
 * Uses exponential backoff: 15min, 30min, 45min
 */
export async function GET(request: Request) {
  try {
    // Check for cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Get pending notification jobs OR failed jobs ready for retry
    // Use separate queries for reliability
    const { data: pendingJobs, error: pendingError } = await supabase
      .from('notification_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    const { data: failedJobs, error: failedError } = await supabase
      .from('notification_jobs')
      .select('*')
      .eq('status', 'failed')
      .lt('attempt_count', 3)
      .lte('next_retry_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (pendingError || failedError) {
      console.error('Error fetching notification jobs:', pendingError || failedError);
      return NextResponse.json(
        { error: 'Failed to fetch jobs', details: (pendingError || failedError)?.message },
        { status: 500 }
      );
    }

    // Combine and sort by scheduled_at
    const allJobs = [...(pendingJobs || []), ...(failedJobs || [])]
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .slice(0, 50); // Limit to 50 total

    if (allJobs.length === 0) {
      return NextResponse.json({
        processed: 0,
        failed: 0,
        message: 'No pending notifications',
      });
    }

    const jobs = allJobs;

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        // Mark as in progress
        await supabase
          .from('notification_jobs')
          .update({
            status: 'in_progress',
            attempt_count: (job.attempt_count || 0) + 1,
          })
          .eq('id', job.id);

        // Send notification based on channel
        let sent = false;
        let providerMessageId: string | null = null;
        let errorMessage: string | null = null;

        if (job.channel === 'email') {
          if (!job.recipient_email || !job.subject) {
            errorMessage = 'Missing recipient_email or subject';
          } else {
            const emailResult = await sendEmailViaSendGrid(
              job.recipient_email,
              job.subject,
              job.body
            );
            sent = emailResult.success;
            providerMessageId = emailResult.messageId || null;
            errorMessage = emailResult.error || null;
          }
        } else if (job.channel === 'sms') {
          if (!job.recipient_phone) {
            errorMessage = 'Missing recipient_phone';
          } else {
            const smsResult = await sendSMSViaTwilio(
              job.recipient_phone,
              job.body
            );
            sent = smsResult.success;
            providerMessageId = smsResult.messageId || null;
            errorMessage = smsResult.error || null;
          }
        } else {
          errorMessage = `Unknown channel: ${job.channel}`;
        }

        if (sent) {
          // Mark job as sent
          // Note: provider_message_id and sent_at are stored in notification_events, not notification_jobs
          const { error: updateError } = await supabase
            .from('notification_jobs')
            .update({
              status: 'sent',
            })
            .eq('id', job.id);

          if (updateError) {
            console.error(`Error updating job ${job.id} to sent:`, updateError);
            errorMessage = `Failed to update job status: ${updateError.message}`;
            sent = false;
          } else {
            // Create notification event log (for audit trail)
            const { error: eventError } = await supabase
              .from('notification_events')
              .insert({
                user_id: job.user_id,
                business_id: job.business_id,
                booking_id: job.booking_id,
                template_id: job.template_id,
                channel: job.channel,
                to_address: job.recipient_email || job.recipient_phone || '',
                status: 'sent',
                provider_message_id: providerMessageId,
                sent_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              });

            if (eventError) {
              console.error(`Error creating notification event for job ${job.id}:`, eventError);
              // Don't fail the job if event logging fails
            }

            processed++;
          }
        }
        
        if (!sent) {
          // Mark as failed with exponential backoff
          const attemptCount = (job.attempt_count || 0) + 1;
          const isDead = attemptCount >= 3; // Max 3 attempts

          // Calculate next retry time: 15min, 30min, 45min
          const backoffMinutes = attemptCount * 15;
          const nextRetryAt = new Date();
          nextRetryAt.setMinutes(nextRetryAt.getMinutes() + backoffMinutes);

          await supabase
            .from('notification_jobs')
            .update({
              status: isDead ? 'dead' : 'failed',
              last_error: errorMessage || 'Unknown error',
              attempt_count: attemptCount,
              next_retry_at: isDead ? null : nextRetryAt.toISOString(),
              scheduled_at: isDead ? job.scheduled_at : nextRetryAt.toISOString(),
            })
            .eq('id', job.id);

          failed++;
        }
      } catch (error) {
        console.error(`Error processing notification job ${job.id}:`, error);
        
        const attemptCount = (job.attempt_count || 0) + 1;
        const isDead = attemptCount >= 3;

        const backoffMinutes = attemptCount * 15;
        const nextRetryAt = new Date();
        nextRetryAt.setMinutes(nextRetryAt.getMinutes() + backoffMinutes);

        await supabase
          .from('notification_jobs')
          .update({
            status: isDead ? 'dead' : 'failed',
            last_error: error instanceof Error ? error.message : 'Unknown error',
            attempt_count: attemptCount,
            next_retry_at: isDead ? null : nextRetryAt.toISOString(),
            scheduled_at: isDead ? job.scheduled_at : nextRetryAt.toISOString(),
          })
          .eq('id', job.id);

        failed++;
      }
    }

    return NextResponse.json({
      processed,
      failed,
      total: allJobs.length,
    });
  } catch (error) {
    console.error('Error in notification cron:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


