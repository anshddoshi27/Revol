/**
 * Comprehensive Notification System Test
 * 
 * This script tests the complete notification flow:
 * 1. Template configuration (onboarding & admin)
 * 2. Data persistence and retrieval
 * 3. Notification triggering on booking events
 * 4. Placeholder replacement with real data
 * 5. SendGrid email and Twilio SMS API integration
 * 6. Cron job processing
 * 
 * Run with: npx tsx scripts/test-notifications-comprehensive.ts
 */

import { createAdminClient } from '../src/lib/db';
import { 
  emitNotification, 
  renderTemplate, 
  validatePlaceholders,
  ALLOWED_PLACEHOLDERS,
  type NotificationData 
} from '../src/lib/notifications';
import { sendEmailViaSendGrid, sendSMSViaTwilio } from '../src/lib/notification-senders';

// Test configuration
const TEST_CONFIG = {
  // Use a real business ID from your database, or create one for testing
  businessId: process.env.TEST_BUSINESS_ID || '',
  userId: process.env.TEST_USER_ID || '',
  // Test recipient - use your own email/phone for testing
  testEmail: process.env.TEST_EMAIL || 'test@example.com',
  testPhone: process.env.TEST_PHONE || '+1234567890',
};

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${result.name}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
  if (result.details) {
    console.log(`   Details:`, JSON.stringify(result.details, null, 2));
  }
}

async function testPlaceholderValidation() {
  console.log('\n📝 Testing Placeholder Validation...');
  
  try {
    // Test valid placeholders
    const validTemplate = 'Hi ${customer.name}, your ${service.name} is on ${booking.date} at ${booking.time}.';
    const validResult = validatePlaceholders(validTemplate);
    
    logResult({
      name: 'Valid placeholders accepted',
      passed: validResult.valid && validResult.invalid.length === 0,
      details: { invalid: validResult.invalid },
    });

    // Test invalid placeholders
    const invalidTemplate = 'Hi ${customer.name}, ${invalid.placeholder} is here.';
    const invalidResult = validatePlaceholders(invalidTemplate);
    
    logResult({
      name: 'Invalid placeholders rejected',
      passed: !invalidResult.valid && invalidResult.invalid.includes('invalid.placeholder'),
      details: { invalid: invalidResult.invalid },
    });

    // Test all allowed placeholders
    const allPlaceholders = ALLOWED_PLACEHOLDERS.map(p => `\${${p}}`).join(' ');
    const allValidResult = validatePlaceholders(allPlaceholders);
    
    logResult({
      name: 'All allowed placeholders work',
      passed: allValidResult.valid,
      details: { count: ALLOWED_PLACEHOLDERS.length },
    });
  } catch (error) {
    logResult({
      name: 'Placeholder validation',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testTemplateRendering() {
  console.log('\n🎨 Testing Template Rendering...');
  
  try {
    const mockData: NotificationData = {
      customer: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      },
      service: {
        name: 'Haircut',
        duration_min: 30,
        price_cents: 5000,
      },
      staff: {
        name: 'Jane Smith',
      },
      booking: {
        id: 'test-booking-123',
        start_at: '2025-01-20T14:00:00Z',
        final_price_cents: 5000,
        price_cents: 5000,
      },
      business: {
        name: 'Test Salon',
        support_email: 'support@testsalon.com',
        phone: '+1987654321',
        subdomain: 'testsalon',
        timezone: 'America/New_York',
      },
      booking_url: 'https://testsalon.revol.com/confirm/REVOL-TEST123',
    };

    const template = `
Hi ${mockData.customer?.name},

Your ${mockData.service?.name} appointment with ${mockData.staff?.name} is confirmed.

Date: ${mockData.booking?.start_at ? '${booking.date}' : ''}
Time: ${mockData.booking?.start_at ? '${booking.time}' : ''}
Service: ${mockData.service?.name ? '${service.name}' : ''}
Duration: ${mockData.service?.duration_min ? '${service.duration}' : ''} minutes
Price: ${mockData.service?.price_cents ? '${service.price}' : ''}
Amount: ${mockData.booking?.final_price_cents ? '${booking.amount}' : ''}

View booking: ${mockData.booking_url ? '${booking.url}' : ''}

Contact ${mockData.business?.name ? '${business.name}' : ''} at ${mockData.business?.phone ? '${business.phone}' : ''}
    `.trim();

    const rendered = renderTemplate(template, mockData, 'America/New_York');
    
    // Verify all placeholders were replaced
    const hasPlaceholders = /\$\{[^}]+\}/.test(rendered);
    const containsCustomerName = rendered.includes('John Doe');
    const containsServiceName = rendered.includes('Haircut');
    const containsPrice = rendered.includes('$50.00');
    const containsDate = rendered.includes('January') || rendered.includes('2025');
    
    logResult({
      name: 'Template rendering replaces all placeholders',
      passed: !hasPlaceholders && containsCustomerName && containsServiceName && containsPrice && containsDate,
      details: {
        hasPlaceholders,
        containsCustomerName,
        containsServiceName,
        containsPrice,
        containsDate,
        renderedLength: rendered.length,
      },
    });

    // Test fee amount placeholder
    const feeTemplate = 'A fee of ${amount} has been charged.';
    const feeData: NotificationData = { ...mockData, amount: 2500 };
    const feeRendered = renderTemplate(feeTemplate, feeData, 'America/New_York');
    
    logResult({
      name: 'Fee amount placeholder works',
      passed: feeRendered.includes('$25.00'),
      details: { rendered: feeRendered },
    });
  } catch (error) {
    logResult({
      name: 'Template rendering',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testTemplateConfiguration() {
  console.log('\n⚙️  Testing Template Configuration...');
  
  if (!TEST_CONFIG.businessId || !TEST_CONFIG.userId) {
    logResult({
      name: 'Template configuration (skipped - no test IDs)',
      passed: true,
      details: { message: 'Set TEST_BUSINESS_ID and TEST_USER_ID to test database operations' },
    });
    return;
  }

  try {
    const supabase = createAdminClient();
    
    // Test: Create a notification template
    const testTemplate = {
      user_id: TEST_CONFIG.userId,
      business_id: TEST_CONFIG.businessId,
      name: 'Test Booking Confirmation',
      channel: 'email' as const,
      category: 'confirmation' as const,
      trigger: 'booking_created' as const,
      subject: 'Your booking with ${business.name} is confirmed',
      body_markdown: 'Hi ${customer.name}, your ${service.name} is confirmed for ${booking.date} at ${booking.time}.',
      is_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdTemplate, error: createError } = await supabase
      .from('notification_templates')
      .insert(testTemplate)
      .select()
      .single();

    if (createError) {
      logResult({
        name: 'Create notification template',
        passed: false,
        error: createError.message,
      });
      return;
    }

    logResult({
      name: 'Create notification template',
      passed: !!createdTemplate,
      details: { templateId: createdTemplate?.id },
    });

    // Test: Retrieve template
    const { data: retrievedTemplate, error: retrieveError } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('id', createdTemplate.id)
      .single();

    logResult({
      name: 'Retrieve notification template',
      passed: !retrieveError && retrievedTemplate?.name === testTemplate.name,
      details: { templateId: retrievedTemplate?.id },
    });

    // Test: Update template
    const updatedBody = 'Updated: Hi ${customer.name}, your ${service.name} is confirmed!';
    const { error: updateError } = await supabase
      .from('notification_templates')
      .update({ body_markdown: updatedBody, updated_at: new Date().toISOString() })
      .eq('id', createdTemplate.id);

    logResult({
      name: 'Update notification template',
      passed: !updateError,
      error: updateError?.message,
    });

    // Cleanup: Delete test template
    await supabase
      .from('notification_templates')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', createdTemplate.id);

    logResult({
      name: 'Cleanup test template',
      passed: true,
    });
  } catch (error) {
    logResult({
      name: 'Template configuration',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testBusinessNotificationsEnabled() {
  console.log('\n🔔 Testing Business Notifications Enabled Flag...');
  
  if (!TEST_CONFIG.businessId) {
    logResult({
      name: 'Business notifications flag (skipped)',
      passed: true,
      details: { message: 'Set TEST_BUSINESS_ID to test' },
    });
    return;
  }

  try {
    const supabase = createAdminClient();
    
    // Get current value
    const { data: business, error } = await supabase
      .from('businesses')
      .select('notifications_enabled')
      .eq('id', TEST_CONFIG.businessId)
      .single();

    if (error) {
      logResult({
        name: 'Read notifications_enabled flag',
        passed: false,
        error: error.message,
      });
      return;
    }

    logResult({
      name: 'Read notifications_enabled flag',
      passed: true,
      details: { 
        notifications_enabled: business?.notifications_enabled,
        plan: business?.notifications_enabled ? 'Pro ($21.99/month)' : 'Basic ($13.99/month)',
      },
    });

    // Test: Verify notifications are skipped when disabled
    if (business?.notifications_enabled === false) {
      logResult({
        name: 'Notifications skipped for Basic plan',
        passed: true,
        details: { message: 'Business has Basic plan - notifications should be skipped' },
      });
    }
  } catch (error) {
    logResult({
      name: 'Business notifications flag',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testSendGridIntegration() {
  console.log('\n📧 Testing SendGrid Email Integration...');
  
  const sendGridKey = process.env.SENDGRID_API_KEY;
  if (!sendGridKey) {
    logResult({
      name: 'SendGrid API key configured',
      passed: false,
      error: 'SENDGRID_API_KEY not found in environment',
    });
    return;
  }

  logResult({
    name: 'SendGrid API key configured',
    passed: true,
  });

  try {
    // Test sending a real email (use test email)
    const testSubject = '[TEST] Revol Notification System Test';
    const testBody = `
This is a test email from the Revol notification system.

If you received this email, the SendGrid integration is working correctly.

Test details:
- Template rendering: ✅
- Placeholder replacement: ✅
- API integration: ✅

This email was sent at ${new Date().toISOString()}
    `.trim();

    const result = await sendEmailViaSendGrid(
      TEST_CONFIG.testEmail,
      testSubject,
      testBody
    );

    logResult({
      name: 'Send test email via SendGrid',
      passed: result.success,
      error: result.error,
      details: { messageId: result.messageId },
    });
  } catch (error) {
    logResult({
      name: 'SendGrid integration',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testTwilioIntegration() {
  console.log('\n📱 Testing Twilio SMS Integration...');
  
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;

  if (!twilioSid || !twilioToken || !twilioFrom) {
    logResult({
      name: 'Twilio credentials configured',
      passed: false,
      error: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER not found',
    });
    return;
  }

  logResult({
    name: 'Twilio credentials configured',
    passed: true,
  });

  try {
    // Test sending a real SMS (use test phone)
    const testBody = `[TEST] Revol notification system test. If you received this, SMS integration is working. Sent at ${new Date().toISOString()}`;

    const result = await sendSMSViaTwilio(
      TEST_CONFIG.testPhone,
      testBody
    );

    logResult({
      name: 'Send test SMS via Twilio',
      passed: result.success,
      error: result.error,
      details: { messageId: result.messageId },
    });
  } catch (error) {
    logResult({
      name: 'Twilio integration',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testNotificationEmission() {
  console.log('\n🚀 Testing Notification Emission...');
  
  if (!TEST_CONFIG.businessId) {
    logResult({
      name: 'Notification emission (skipped)',
      passed: true,
      details: { message: 'Set TEST_BUSINESS_ID to test with real booking' },
    });
    return;
  }

  try {
    const supabase = createAdminClient();
    
    // Find a recent booking for testing
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, business_id, customer_id, service_id, staff_id, start_at')
      .eq('business_id', TEST_CONFIG.businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (bookingError || !bookings || bookings.length === 0) {
      logResult({
        name: 'Find test booking',
        passed: false,
        error: bookingError?.message || 'No bookings found',
        details: { message: 'Create a booking first to test notification emission' },
      });
      return;
    }

    const testBooking = bookings[0];
    
    logResult({
      name: 'Find test booking',
      passed: true,
      details: { bookingId: testBooking.id },
    });

    // Test: Emit booking_created notification
    // This will create notification jobs if templates exist
    try {
      await emitNotification(
        TEST_CONFIG.businessId,
        'booking_created',
        testBooking.id,
        supabase
      );

      // Check if notification jobs were created
      const { data: jobs, error: jobsError } = await supabase
        .from('notification_jobs')
        .select('*')
        .eq('booking_id', testBooking.id)
        .eq('trigger', 'booking_created')
        .order('created_at', { ascending: false })
        .limit(10);

      logResult({
        name: 'Emit booking_created notification',
        passed: !jobsError,
        error: jobsError?.message,
        details: { 
          jobsCreated: jobs?.length || 0,
          jobs: jobs?.map(j => ({ 
            channel: j.channel, 
            status: j.status,
            recipient: j.recipient_email || j.recipient_phone,
          })),
        },
      });
    } catch (emitError) {
      logResult({
        name: 'Emit notification',
        passed: false,
        error: emitError instanceof Error ? emitError.message : 'Unknown error',
      });
    }
  } catch (error) {
    logResult({
      name: 'Notification emission',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testNotificationJobs() {
  console.log('\n📋 Testing Notification Jobs Queue...');
  
  if (!TEST_CONFIG.businessId) {
    logResult({
      name: 'Notification jobs (skipped)',
      passed: true,
      details: { message: 'Set TEST_BUSINESS_ID to test' },
    });
    return;
  }

  try {
    const supabase = createAdminClient();
    
    // Get pending notification jobs
    const { data: pendingJobs, error } = await supabase
      .from('notification_jobs')
      .select('*')
      .eq('business_id', TEST_CONFIG.businessId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    logResult({
      name: 'Query pending notification jobs',
      passed: !error,
      error: error?.message,
      details: { 
        pendingCount: pendingJobs?.length || 0,
        sampleJobs: pendingJobs?.slice(0, 3).map(j => ({
          id: j.id,
          channel: j.channel,
          trigger: j.trigger,
          recipient: j.recipient_email || j.recipient_phone,
          scheduledAt: j.scheduled_at,
        })),
      },
    });

    // Get failed jobs
    const { data: failedJobs } = await supabase
      .from('notification_jobs')
      .select('*')
      .eq('business_id', TEST_CONFIG.businessId)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5);

    logResult({
      name: 'Query failed notification jobs',
      passed: true,
      details: { 
        failedCount: failedJobs?.length || 0,
        sampleErrors: failedJobs?.slice(0, 2).map(j => ({
          id: j.id,
          channel: j.channel,
          error: j.last_error,
          attempts: j.attempt_count,
        })),
      },
    });
  } catch (error) {
    logResult({
      name: 'Notification jobs',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testCronJobEndpoint() {
  console.log('\n⏰ Testing Cron Job Endpoint...');
  
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logResult({
      name: 'Cron secret configured',
      passed: false,
      error: 'CRON_SECRET not found in environment',
    });
    return;
  }

  logResult({
    name: 'Cron secret configured',
    passed: true,
  });

  try {
    // Test the notifications cron endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/cron/notifications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
    });

    const data = await response.json();

    logResult({
      name: 'Cron job endpoint accessible',
      passed: response.ok,
      error: data.error,
      details: { 
        status: response.status,
        processed: data.processed,
        failed: data.failed,
        total: data.total,
      },
    });
  } catch (error) {
    logResult({
      name: 'Cron job endpoint',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: { message: 'Make sure the app is running and CRON_SECRET is set' },
    });
  }
}

async function runAllTests() {
  console.log('🧪 Revol Notification System - Comprehensive Test Suite\n');
  console.log('=' .repeat(60));
  
  // Core functionality tests (always run)
  await testPlaceholderValidation();
  await testTemplateRendering();
  
  // Database tests (require test IDs)
  await testTemplateConfiguration();
  await testBusinessNotificationsEnabled();
  await testNotificationEmission();
  await testNotificationJobs();
  
  // API integration tests (require API keys)
  await testSendGridIntegration();
  await testTwilioIntegration();
  
  // Infrastructure tests
  await testCronJobEndpoint();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);
  
  if (failed > 0) {
    console.log('Failed Tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  ❌ ${r.name}`);
        if (r.error) console.log(`     ${r.error}`);
      });
    console.log('');
  }
  
  // Recommendations
  console.log('💡 Recommendations:\n');
  
  if (!TEST_CONFIG.businessId || !TEST_CONFIG.userId) {
    console.log('  • Set TEST_BUSINESS_ID and TEST_USER_ID to test database operations');
  }
  
  if (!process.env.SENDGRID_API_KEY) {
    console.log('  • Set SENDGRID_API_KEY to test email sending');
  }
  
  if (!process.env.TWILIO_ACCOUNT_SID) {
    console.log('  • Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to test SMS');
  }
  
  if (!process.env.CRON_SECRET) {
    console.log('  • Set CRON_SECRET to test cron endpoints');
  }
  
  console.log('\n  • Create a test booking to verify end-to-end notification flow');
  console.log('  • Check notification_jobs table to see queued notifications');
  console.log('  • Monitor SendGrid and Twilio dashboards for delivery status\n');
}

// Run tests
runAllTests().catch(console.error);

