/**
 * Test data factories for creating mock database records
 * Ensures consistent, repeatable test data
 */

// Generate UUIDs for test data
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateId(prefix = ''): string {
  return prefix ? `${prefix}_${uuidv4()}` : uuidv4();
}

// Factory for creating mock business records
export function createMockBusiness(overrides: Partial<any> = {}) {
  return {
    id: generateId('biz'),
    user_id: generateId('user'),
    name: 'Test Business',
    subdomain: 'test-business',
    timezone: 'America/New_York',
    min_lead_time_minutes: 120,
    max_advance_days: 60,
    subscription_status: 'active',
    notifications_enabled: true,
    stripe_connect_account_id: 'acct_test123',
    restore_gift_card_on_refund: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

// Factory for creating mock user records
export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: generateId('user'),
    email: 'test@example.com',
    phone: '+1234567890',
    full_name: 'Test User',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Factory for creating mock service records
export function createMockService(overrides: Partial<any> = {}) {
  return {
    id: generateId('svc'),
    business_id: generateId('biz'),
    category_id: generateId('cat'),
    name: 'Test Service',
    description: 'Test service description',
    duration_min: 60,
    price_cents: 10000, // $100
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

// Factory for creating mock category records
export function createMockCategory(overrides: Partial<any> = {}) {
  return {
    id: generateId('cat'),
    business_id: generateId('biz'),
    name: 'Test Category',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

// Factory for creating mock staff records
export function createMockStaff(overrides: Partial<any> = {}) {
  return {
    id: generateId('staff'),
    business_id: generateId('biz'),
    name: 'Test Staff',
    email: 'staff@example.com',
    phone: '+1234567890',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

// Factory for creating mock customer records
export function createMockCustomer(overrides: Partial<any> = {}) {
  return {
    id: generateId('cust'),
    business_id: generateId('biz'),
    user_id: generateId('user'),
    name: 'Test Customer',
    email: 'customer@example.com',
    phone: '+1234567890',
    stripe_customer_id: 'cus_test123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Factory for creating mock booking records
export function createMockBooking(overrides: Partial<any> = {}) {
  const startAt = overrides.start_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const durationMin = overrides.duration_min || 60;
  const endAt = new Date(new Date(startAt).getTime() + durationMin * 60 * 1000).toISOString();

  return {
    id: generateId('book'),
    business_id: generateId('biz'),
    user_id: generateId('user'),
    customer_id: generateId('cust'),
    service_id: generateId('svc'),
    staff_id: generateId('staff'),
    status: 'pending',
    start_at: startAt,
    end_at: endAt,
    duration_min: durationMin,
    price_cents: 10000, // $100
    final_price_cents: 10000,
    gift_card_id: null,
    gift_card_amount_applied_cents: 0,
    payment_status: 'none',
    last_money_action: 'none',
    source: 'public',
    policy_snapshot: {},
    policy_hash: 'test_hash',
    consent_at: new Date().toISOString(),
    consent_ip: '127.0.0.1',
    consent_user_agent: 'test-agent',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

// Factory for creating mock gift card records
export function createMockGiftCard(overrides: Partial<any> = {}) {
  return {
    id: generateId('gift'),
    business_id: generateId('biz'),
    user_id: generateId('user'),
    code: 'TESTCODE',
    discount_type: 'amount',
    amount_cents: 5000, // $50
    percent_off: null,
    current_balance_cents: 5000,
    is_active: true,
    expires_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

// Factory for creating mock policy records
export function createMockPolicy(overrides: Partial<any> = {}) {
  return {
    id: generateId('policy'),
    business_id: generateId('biz'),
    user_id: generateId('user'),
    version: 1,
    is_active: true,
    cancellation_policy_text: 'Test cancellation policy',
    no_show_policy_text: 'Test no-show policy',
    refund_policy_text: 'Test refund policy',
    cash_policy_text: 'Test cash policy',
    no_show_fee_type: 'percent',
    no_show_fee_amount_cents: null,
    no_show_fee_percent: 50,
    cancel_fee_type: 'percent',
    cancel_fee_amount_cents: null,
    cancel_fee_percent: 25,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

// Factory for creating mock availability rule records
export function createMockAvailabilityRule(overrides: Partial<any> = {}) {
  return {
    id: generateId('rule'),
    business_id: generateId('biz'),
    service_id: generateId('svc'),
    staff_id: generateId('staff'),
    weekday: 1, // Monday
    start_time: '09:00',
    end_time: '17:00',
    rule_type: 'weekly',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

// Factory for creating mock booking payment records
export function createMockBookingPayment(overrides: Partial<any> = {}) {
  return {
    id: generateId('pay'),
    business_id: generateId('biz'),
    user_id: generateId('user'),
    booking_id: generateId('book'),
    stripe_setup_intent_id: 'seti_test123',
    stripe_payment_intent_id: null,
    amount_cents: 10000,
    money_action: 'none',
    status: 'card_saved',
    application_fee_cents: 0,
    net_amount_cents: 10000,
    currency: 'usd',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Factory for creating mock gift card ledger records
export function createMockGiftCardLedger(overrides: Partial<any> = {}) {
  return {
    id: generateId('ledger'),
    business_id: generateId('biz'),
    user_id: generateId('user'),
    gift_card_id: generateId('gift'),
    booking_id: null,
    delta_cents: 0,
    reason: 'issuance',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Factory for creating mock notification template records
export function createMockNotificationTemplate(overrides: Partial<any> = {}) {
  return {
    id: generateId('template'),
    business_id: generateId('biz'),
    user_id: generateId('user'),
    trigger: 'booking_created',
    channel: 'email',
    subject: 'Test Subject',
    body_markdown: 'Test body with ${customer.name}',
    is_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

// Helper to create a Supabase query builder mock
export function createSupabaseQueryBuilder() {
  const { vi } = require('vitest');
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  return queryBuilder;
}

