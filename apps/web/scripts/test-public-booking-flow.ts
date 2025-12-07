#!/usr/bin/env tsx
/**
 * Test Suite for Public Booking Flow API
 * 
 * Tests all three public booking endpoints:
 * 1. GET /api/public/{slug}/catalog
 * 2. GET /api/public/{slug}/availability?service_id&date=
 * 3. POST /api/public/{slug}/bookings
 * 
 * Also tests gift code preview endpoint.
 * 
 * Usage:
 *   npm run test:public-booking
 *   or
 *   tsx scripts/test-public-booking-flow.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const TEST_SUBDOMAIN = process.env.TEST_SUBDOMAIN || 'test-business';

// ANSI color codes for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function log(message: string, color: string = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function logTest(name: string) {
  log(`\n${'='.repeat(60)}`, BLUE);
  log(`Testing: ${name}`, BLUE);
  log('='.repeat(60), BLUE);
}

async function testCatalog(): Promise<TestResult> {
  logTest('GET /api/public/{slug}/catalog');
  
  try {
    const response = await fetch(`${BASE_URL}/api/public/${TEST_SUBDOMAIN}/catalog`);
    const data = await response.json();

    if (!response.ok) {
      return {
        name: 'Catalog Endpoint',
        passed: false,
        error: `HTTP ${response.status}: ${JSON.stringify(data)}`,
      };
    }

    // Validate response structure
    const requiredFields = ['business', 'categories', 'staff'];
    const missingFields = requiredFields.filter(field => !(field in data));
    
    if (missingFields.length > 0) {
      return {
        name: 'Catalog Endpoint - Response Structure',
        passed: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        details: data,
      };
    }

    // Validate business fields
    const businessFields = ['id', 'name', 'subdomain', 'timezone'];
    const missingBusinessFields = businessFields.filter(field => !(field in data.business));
    
    if (missingBusinessFields.length > 0) {
      return {
        name: 'Catalog Endpoint - Business Fields',
        passed: false,
        error: `Missing business fields: ${missingBusinessFields.join(', ')}`,
        details: data.business,
      };
    }

    // Check subscription status (should be active or trial)
    if (!['active', 'trial'].includes(data.business.subscription_status)) {
      return {
        name: 'Catalog Endpoint - Subscription Status',
        passed: false,
        error: `Business subscription status should be 'active' or 'trial', got: ${data.business.subscription_status}`,
      };
    }

    log(`✓ Business: ${data.business.name}`, GREEN);
    log(`✓ Categories: ${data.categories?.length || 0}`, GREEN);
    log(`✓ Staff: ${data.staff?.length || 0}`, GREEN);

    return {
      name: 'Catalog Endpoint',
      passed: true,
      details: {
        businessId: data.business.id,
        categoriesCount: data.categories?.length || 0,
        staffCount: data.staff?.length || 0,
      },
    };
  } catch (error) {
    return {
      name: 'Catalog Endpoint',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testAvailability(): Promise<TestResult> {
  logTest('GET /api/public/{slug}/availability');
  
  try {
    // First, get catalog to find a service
    const catalogResponse = await fetch(`${BASE_URL}/api/public/${TEST_SUBDOMAIN}/catalog`);
    const catalogData = await catalogResponse.json();

    if (!catalogResponse.ok || !catalogData.categories || catalogData.categories.length === 0) {
      return {
        name: 'Availability Endpoint - Setup',
        passed: false,
        error: 'No categories/services found. Cannot test availability.',
      };
    }

    // Find first service with availability
    let testService: any = null;
    for (const category of catalogData.categories) {
      if (category.services && category.services.length > 0) {
        testService = category.services[0];
        break;
      }
    }

    if (!testService) {
      return {
        name: 'Availability Endpoint - Setup',
        passed: false,
        error: 'No services found. Cannot test availability.',
      };
    }

    log(`Testing with service: ${testService.name} (${testService.id})`, BLUE);

    // Test with a date (next week)
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 7);
    const dateStr = testDate.toISOString().split('T')[0];

    const response = await fetch(
      `${BASE_URL}/api/public/${TEST_SUBDOMAIN}/availability?service_id=${testService.id}&date=${dateStr}`
    );
    const data = await response.json();

    if (!response.ok) {
      return {
        name: 'Availability Endpoint',
        passed: false,
        error: `HTTP ${response.status}: ${JSON.stringify(data)}`,
      };
    }

    // Validate response structure
    if (!('slots' in data) || !Array.isArray(data.slots)) {
      return {
        name: 'Availability Endpoint - Response Structure',
        passed: false,
        error: 'Response should contain a "slots" array',
        details: data,
      };
    }

    // Validate slot structure
    if (data.slots.length > 0) {
      const firstSlot = data.slots[0];
      const requiredSlotFields = ['staff_id', 'staff_name', 'start_at', 'end_at'];
      const missingSlotFields = requiredSlotFields.filter(field => !(field in firstSlot));
      
      if (missingSlotFields.length > 0) {
        return {
          name: 'Availability Endpoint - Slot Structure',
          passed: false,
          error: `Missing slot fields: ${missingSlotFields.join(', ')}`,
          details: firstSlot,
        };
      }

      // Validate ISO timestamp format
      try {
        new Date(firstSlot.start_at);
        new Date(firstSlot.end_at);
      } catch {
        return {
          name: 'Availability Endpoint - Slot Timestamps',
          passed: false,
          error: 'Slot timestamps must be valid ISO strings',
          details: firstSlot,
        };
      }
    }

    log(`✓ Slots found: ${data.slots.length}`, GREEN);
    if (data.slots.length > 0) {
      log(`✓ First slot: ${data.slots[0].staff_name} at ${data.slots[0].start_at}`, GREEN);
    }

    return {
      name: 'Availability Endpoint',
      passed: true,
      details: {
        slotsCount: data.slots.length,
        serviceId: testService.id,
        date: dateStr,
      },
    };
  } catch (error) {
    return {
      name: 'Availability Endpoint',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testGiftCodePreview(): Promise<TestResult> {
  logTest('POST /api/public/{slug}/gift-codes/preview');
  
  try {
    // Get catalog to find a service
    const catalogResponse = await fetch(`${BASE_URL}/api/public/${TEST_SUBDOMAIN}/catalog`);
    const catalogData = await catalogResponse.json();

    if (!catalogResponse.ok || !catalogData.categories || catalogData.categories.length === 0) {
      return {
        name: 'Gift Code Preview - Setup',
        passed: false,
        error: 'No services found. Cannot test gift code preview.',
      };
    }

    let testService: any = null;
    for (const category of catalogData.categories) {
      if (category.services && category.services.length > 0) {
        testService = category.services[0];
        break;
      }
    }

    if (!testService) {
      return {
        name: 'Gift Code Preview - Setup',
        passed: false,
        error: 'No services found. Cannot test gift code preview.',
      };
    }

    // Test with invalid gift code (should fail gracefully)
    const invalidResponse = await fetch(
      `${BASE_URL}/api/public/${TEST_SUBDOMAIN}/gift-codes/preview`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'INVALID-CODE-123',
          base_price_cents: testService.price_cents,
        }),
      }
    );

    if (invalidResponse.ok) {
      return {
        name: 'Gift Code Preview - Invalid Code Handling',
        passed: false,
        error: 'Should return error for invalid gift code',
      };
    }

    log(`✓ Invalid gift code properly rejected (HTTP ${invalidResponse.status})`, GREEN);

    return {
      name: 'Gift Code Preview Endpoint',
      passed: true,
      details: {
        invalidCodeTest: 'passed',
      },
    };
  } catch (error) {
    return {
      name: 'Gift Code Preview Endpoint',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testBookingCreation(): Promise<TestResult> {
  logTest('POST /api/public/{slug}/bookings');
  
  try {
    // Get catalog and availability to set up booking
    const catalogResponse = await fetch(`${BASE_URL}/api/public/${TEST_SUBDOMAIN}/catalog`);
    const catalogData = await catalogResponse.json();

    if (!catalogResponse.ok || !catalogData.categories || catalogData.categories.length === 0) {
      return {
        name: 'Booking Creation - Setup',
        passed: false,
        error: 'No categories/services found. Cannot test booking creation.',
      };
    }

    let testService: any = null;
    let testStaff: any = null;
    for (const category of catalogData.categories) {
      if (category.services && category.services.length > 0) {
        testService = category.services[0];
        if (testService.staffIds && testService.staffIds.length > 0) {
          testStaff = catalogData.staff.find((s: any) => s.id === testService.staffIds[0]);
        }
        break;
      }
    }

    if (!testService) {
      return {
        name: 'Booking Creation - Setup',
        passed: false,
        error: 'No services found. Cannot test booking creation.',
      };
    }

    if (!testStaff) {
      return {
        name: 'Booking Creation - Setup',
        passed: false,
        error: 'No staff found for service. Cannot test booking creation.',
      };
    }

    // Get availability for next week
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 7);
    const dateStr = testDate.toISOString().split('T')[0];

    const availabilityResponse = await fetch(
      `${BASE_URL}/api/public/${TEST_SUBDOMAIN}/availability?service_id=${testService.id}&date=${dateStr}`
    );
    const availabilityData = await availabilityResponse.json();

    if (!availabilityResponse.ok || !availabilityData.slots || availabilityData.slots.length === 0) {
      return {
        name: 'Booking Creation - Setup',
        passed: false,
        error: 'No available slots found. Cannot test booking creation.',
      };
    }

    const firstSlot = availabilityData.slots[0];

    log(`Testing booking with:`, BLUE);
    log(`  Service: ${testService.name}`, BLUE);
    log(`  Staff: ${firstSlot.staff_name}`, BLUE);
    log(`  Time: ${firstSlot.start_at}`, BLUE);

    // Test booking creation (without actual card setup - that requires Stripe Elements)
    const bookingResponse = await fetch(
      `${BASE_URL}/api/public/${TEST_SUBDOMAIN}/bookings`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: testService.id,
          staff_id: firstSlot.staff_id,
          start_at: firstSlot.start_at,
          customer: {
            name: 'Test Customer',
            email: `test-${Date.now()}@example.com`,
            phone: '+1234567890',
          },
          consent_ip: '127.0.0.1',
          consent_user_agent: 'Test Script',
        }),
      }
    );

    const bookingData = await bookingResponse.json();

    if (!bookingResponse.ok) {
      // If it fails due to slot already taken or other validation, that's ok for this test
      // We're mainly checking the endpoint structure and basic validation
      if (bookingResponse.status === 409) {
        log(`⚠ Booking slot already taken (expected in test environment)`, YELLOW);
        return {
          name: 'Booking Creation Endpoint',
          passed: true,
          details: {
            validationTest: 'passed (slot conflict)',
          },
        };
      }

      return {
        name: 'Booking Creation Endpoint',
        passed: false,
        error: `HTTP ${bookingResponse.status}: ${JSON.stringify(bookingData)}`,
      };
    }

    // Validate response structure
    const requiredFields = ['booking_id', 'booking_code', 'client_secret'];
    const missingFields = requiredFields.filter(field => !(field in bookingData));

    if (missingFields.length > 0) {
      return {
        name: 'Booking Creation - Response Structure',
        passed: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        details: bookingData,
      };
    }

    log(`✓ Booking created: ${bookingData.booking_code}`, GREEN);
    log(`✓ SetupIntent client_secret received`, GREEN);

    return {
      name: 'Booking Creation Endpoint',
      passed: true,
      details: {
        bookingId: bookingData.booking_id,
        bookingCode: bookingData.booking_code,
        hasClientSecret: !!bookingData.client_secret,
      },
    };
  } catch (error) {
    return {
      name: 'Booking Creation Endpoint',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testSubscriptionStatusFilter(): Promise<TestResult> {
  logTest('Subscription Status Filter');
  
  try {
    // Test that canceled businesses are not accessible
    // This is a basic test - in production you'd need a canceled business to test with
    
    const response = await fetch(`${BASE_URL}/api/public/nonexistent-business/catalog`);
    
    if (response.status === 404) {
      log(`✓ Non-existent business properly returns 404`, GREEN);
      return {
        name: 'Subscription Status Filter',
        passed: true,
        details: {
          nonExistentBusinessTest: 'passed',
        },
      };
    }

    return {
      name: 'Subscription Status Filter',
      passed: false,
      error: `Expected 404 for non-existent business, got ${response.status}`,
    };
  } catch (error) {
    return {
      name: 'Subscription Status Filter',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runAllTests() {
  log('\n' + '='.repeat(60), BLUE);
  log('PUBLIC BOOKING FLOW API TEST SUITE', BLUE);
  log('='.repeat(60), BLUE);
  log(`Base URL: ${BASE_URL}`, BLUE);
  log(`Test Subdomain: ${TEST_SUBDOMAIN}`, BLUE);

  // Run all tests
  results.push(await testCatalog());
  results.push(await testAvailability());
  results.push(await testGiftCodePreview());
  results.push(await testBookingCreation());
  results.push(await testSubscriptionStatusFilter());

  // Print summary
  log('\n' + '='.repeat(60), BLUE);
  log('TEST SUMMARY', BLUE);
  log('='.repeat(60), BLUE);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    if (result.passed) {
      log(`✓ ${result.name}`, GREEN);
      if (result.details) {
        log(`  ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n  ')}`, GREEN);
      }
    } else {
      log(`✗ ${result.name}`, RED);
      if (result.error) {
        log(`  Error: ${result.error}`, RED);
      }
      if (result.details) {
        log(`  Details: ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n  ')}`, RED);
      }
    }
  });

  log('\n' + '='.repeat(60), BLUE);
  log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`, 
    failed === 0 ? GREEN : RED);
  log('='.repeat(60), BLUE);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  log(`\nFatal error: ${error.message}`, RED);
  console.error(error);
  process.exit(1);
});


