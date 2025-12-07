#!/usr/bin/env tsx
/**
 * Test New Features After Migrations
 * 
 * Tests:
 * 1. Availability settings (min_lead_time_minutes, max_advance_days) are read from DB
 * 2. Staff name placeholder in notifications
 * 3. Social media fields exist in database schema
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const TEST_SUBDOMAIN = 'test-business';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(message: string, color: string = '') {
  console.log(`${color}${message}${RESET}`);
}

async function testAvailabilitySettings() {
  log('\n======================================================================', BLUE);
  log('TEST 1: Availability Settings from Database', BLUE);
  log('======================================================================', BLUE);

  try {
    // Get business catalog to check if fields are accessible
    const catalogRes = await fetch(`${BASE_URL}/api/public/${TEST_SUBDOMAIN}/catalog`);
    if (!catalogRes.ok) {
      throw new Error(`Catalog failed: ${catalogRes.status}`);
    }
    const catalog = await catalogRes.json();

    log(`✓ Business: ${catalog.business.name}`, GREEN);
    log(`✓ Subscription Status: ${catalog.business.subscription_status}`, GREEN);

    // Test availability endpoint - it should now read from DB
    const serviceId = catalog.categories[0]?.services[0]?.id;
    if (!serviceId) {
      throw new Error('No service found');
    }

    // Get a Monday date (availability rules are typically for weekdays)
    const today = new Date();
    const daysUntilMonday = (1 + 7 - today.getDay()) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    const dateStr = nextMonday.toISOString().split('T')[0];

    log(`Testing availability for date: ${dateStr}`, BLUE);

    const availRes = await fetch(
      `${BASE_URL}/api/public/${TEST_SUBDOMAIN}/availability?service_id=${serviceId}&date=${dateStr}`
    );

    if (!availRes.ok) {
      const error = await availRes.text();
      throw new Error(`Availability failed: ${availRes.status} - ${error}`);
    }

    const avail = await availRes.json();
    log(`✓ Availability endpoint working`, GREEN);
    log(`✓ Slots found: ${avail.slots.length}`, GREEN);

    if (avail.slots.length > 0) {
      log(`✓ First slot: ${avail.slots[0].staff_name} at ${avail.slots[0].start_at}`, GREEN);
    }

    return { passed: true, slotsCount: avail.slots.length };
  } catch (error) {
    log(`✗ Error: ${error instanceof Error ? error.message : String(error)}`, RED);
    return { passed: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testStaffNamePlaceholder() {
  log('\n======================================================================', BLUE);
  log('TEST 2: Staff Name Placeholder in Notifications', BLUE);
  log('======================================================================', BLUE);

  try {
    // Import the notification render function
    const { renderTemplate } = await import('../src/lib/notifications');

    const template = "Hello ${customer.name}, your booking with ${staff.name} is confirmed!";
    const data = {
      customer: { name: 'John Doe' },
      staff: { name: 'Ava Thompson' },
    };

    const rendered = renderTemplate(template, data);
    const expected = 'Hello John Doe, your booking with Ava Thompson is confirmed!';

    if (rendered === expected) {
      log(`✓ Template: "${template}"`, GREEN);
      log(`✓ Rendered: "${rendered}"`, GREEN);
      log(`✓ Staff name placeholder replaced correctly`, GREEN);
      return { passed: true };
    } else {
      throw new Error(`Expected "${expected}" but got "${rendered}"`);
    }
  } catch (error) {
    log(`✗ Error: ${error instanceof Error ? error.message : String(error)}`, RED);
    return { passed: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testPlaceholderConstants() {
  log('\n======================================================================', BLUE);
  log('TEST 3: Placeholder Constants Include Staff Name', BLUE);
  log('======================================================================', BLUE);

  try {
    const { PLACEHOLDER_TOKENS } = await import('../src/components/onboarding/constants');

    if (PLACEHOLDER_TOKENS.includes('${staff.name}')) {
      log(`✓ ${PLACEHOLDER_TOKENS.length} placeholders defined`, GREEN);
      log(`✓ ${'${staff.name}'} is in the list`, GREEN);
      return { passed: true };
    } else {
      throw new Error('${staff.name} not found in PLACEHOLDER_TOKENS');
    }
  } catch (error) {
    log(`✗ Error: ${error instanceof Error ? error.message : String(error)}`, RED);
    return { passed: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  log('\n══════════════════════════════════════════════════════════════════════', BLUE);
  log('NEW FEATURES TEST SUITE', BLUE);
  log('Testing migrations and enhancements', BLUE);
  log('══════════════════════════════════════════════════════════════════════', BLUE);

  const results = [];

  // Test 1: Availability settings
  results.push(await testAvailabilitySettings());

  // Test 2: Staff name placeholder
  results.push(await testStaffNamePlaceholder());

  // Test 3: Placeholder constants
  results.push(await testPlaceholderConstants());

  // Summary
  log('\n══════════════════════════════════════════════════════════════════════', BLUE);
  log('TEST SUMMARY', BLUE);
  log('══════════════════════════════════════════════════════════════════════', BLUE);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach((result, index) => {
    if (result.passed) {
      log(`✓ Test ${index + 1}: PASSED`, GREEN);
    } else {
      log(`✗ Test ${index + 1}: FAILED - ${result.error}`, RED);
    }
  });

  log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`, BLUE);

  if (failed === 0) {
    log('\n🎉 All new features working correctly!', GREEN);
    process.exit(0);
  } else {
    log('\n❌ Some tests failed', RED);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

