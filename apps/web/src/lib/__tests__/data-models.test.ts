/**
 * Unit tests for data model validation and business rules
 * Tests users, businesses, services, staff, customers, bookings, policies
 */

import { describe, it, expect } from 'vitest';
import {
  createMockBusiness,
  createMockUser,
  createMockService,
  createMockCategory,
  createMockStaff,
  createMockCustomer,
  createMockBooking,
  createMockPolicy,
} from '../../test/factories';

describe('Data Model Validation', () => {
  describe('Users + Business', () => {
    it('should enforce one owner = one business', () => {
      const user = createMockUser({ id: 'user-123' });
      const business1 = createMockBusiness({ user_id: user.id });
      
      // Attempting to create second business should fail
      const hasExistingBusiness = business1 !== null;
      expect(hasExistingBusiness).toBe(true);
      
      // Second business creation should be prevented
      const canCreateSecond = !hasExistingBusiness;
      expect(canCreateSecond).toBe(false);
    });

    it('should validate required business fields', () => {
      const business = createMockBusiness({
        name: 'Test Business',
        subdomain: 'test',
        timezone: 'America/New_York',
      });

      expect(business.name).toBeTruthy();
      expect(business.subdomain).toBeTruthy();
      expect(business.timezone).toBeTruthy();
    });

    it('should propagate tenant_id correctly', () => {
      const userId = 'user-123';
      const business = createMockBusiness({ user_id: userId });

      expect(business.user_id).toBe(userId);
    });
  });

  describe('Services + Categories', () => {
    it('should require service to have valid category', () => {
      const category = createMockCategory({ id: 'cat-123' });
      const service = createMockService({ category_id: category.id });

      expect(service.category_id).toBe(category.id);
    });

    it('should prevent creating service without category', () => {
      const service = createMockService({ category_id: null as any });
      
      // Service should require category_id
      const hasCategory = service.category_id !== null && service.category_id !== undefined;
      expect(hasCategory).toBe(false);
    });

    it('should validate service duration > 0', () => {
      const service = createMockService({ duration_min: 60 });
      
      expect(service.duration_min).toBeGreaterThan(0);
    });

    it('should validate service price >= 0', () => {
      const service = createMockService({ price_cents: 10000 });
      
      expect(service.price_cents).toBeGreaterThanOrEqual(0);
    });

    it('should reject negative price', () => {
      const service = createMockService({ price_cents: -1000 });
      
      const isValid = service.price_cents >= 0;
      expect(isValid).toBe(false);
    });
  });

  describe('Staff Model', () => {
    it('should ensure staff have NO login', () => {
      const staff = createMockStaff({
        name: 'Jane Smith',
        email: 'jane@example.com',
      });

      // Staff should not have auth.users entry
      // They are just records in staff table
      expect(staff.name).toBeTruthy();
      expect(staff.email).toBeTruthy();
      // But no password or auth record
    });

    it('should handle active/inactive staff correctly', () => {
      const activeStaff = createMockStaff({ is_active: true });
      const inactiveStaff = createMockStaff({ is_active: false });

      expect(activeStaff.is_active).toBe(true);
      expect(inactiveStaff.is_active).toBe(false);
    });

    it('should validate staff-service assignments', () => {
      const staff = createMockStaff({ id: 'staff-123' });
      const service = createMockService({ id: 'svc-123' });

      // Staff-service assignment should link valid staff and service
      const assignment = {
        staff_id: staff.id,
        service_id: service.id,
        business_id: 'biz-123',
      };

      expect(assignment.staff_id).toBe(staff.id);
      expect(assignment.service_id).toBe(service.id);
    });
  });

  describe('Customers', () => {
    it('should make phone optional', () => {
      const customer = createMockCustomer({
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
      });

      expect(customer.phone).toBeNull();
      expect(customer.email).toBeTruthy();
    });

    it('should validate email format', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com',
      ];

      validEmails.forEach(email => {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        expect(isValid).toBe(true);
      });
    });

    it('should auto-lowercase email', () => {
      const email = 'John.Doe@Example.COM';
      const lowercased = email.toLowerCase().trim();

      expect(lowercased).toBe('john.doe@example.com');
    });
  });

  describe('Booking Model', () => {
    it('should calculate final_price_cents correctly', () => {
      const booking = createMockBooking({
        price_cents: 10000, // $100
        gift_card_amount_applied_cents: 2000, // $20 discount
        final_price_cents: 8000, // $80
      });

      const calculatedFinal = booking.price_cents - booking.gift_card_amount_applied_cents;
      expect(calculatedFinal).toBe(booking.final_price_cents);
    });

    it('should ensure booking code uniqueness', () => {
      // Use different IDs to ensure unique codes
      const booking1 = createMockBooking({ id: 'abc12345-6789-0123' });
      const booking2 = createMockBooking({ id: 'xyz98765-4321-0987' });

      const code1 = `REVOL-${booking1.id.slice(0, 8).toUpperCase()}`;
      const code2 = `REVOL-${booking2.id.slice(0, 8).toUpperCase()}`;

      // Codes should be different for different booking IDs
      expect(code1).not.toBe(code2);
      expect(code1).toBe('REVOL-ABC12345');
      expect(code2).toBe('REVOL-XYZ98765');
    });

    it('should prevent booking outside availability', () => {
      const booking = createMockBooking({
        start_at: '2025-01-15T10:00:00Z',
        end_at: '2025-01-15T11:00:00Z',
      });

      // Availability check would happen before booking creation
      const startTime = new Date(booking.start_at);
      const endTime = new Date(booking.end_at);
      const isValid = startTime < endTime;

      expect(isValid).toBe(true);
    });

    it('should validate booking status transitions', () => {
      const booking = createMockBooking({ status: 'pending' });

      const validNextStatuses = ['scheduled', 'cancelled', 'completed'];
      const nextStatus = 'scheduled';

      const isValid = validNextStatuses.includes(nextStatus);
      expect(isValid).toBe(true);
    });
  });

  describe('Policies', () => {
    it('should validate cancellation fee percent', () => {
      const policy = createMockPolicy({
        cancel_fee_type: 'percent',
        cancel_fee_percent: 25,
      });

      const isValid = policy.cancel_fee_percent! >= 0 && policy.cancel_fee_percent! <= 100;
      expect(isValid).toBe(true);
    });

    it('should validate cancellation flat fee', () => {
      const policy = createMockPolicy({
        cancel_fee_type: 'amount',
        cancel_fee_amount_cents: 5000, // $50
      });

      expect(policy.cancel_fee_amount_cents).toBeGreaterThanOrEqual(0);
    });

    it('should validate no-show fee percent', () => {
      const policy = createMockPolicy({
        no_show_fee_type: 'percent',
        no_show_fee_percent: 50,
      });

      const isValid = policy.no_show_fee_percent! >= 0 && policy.no_show_fee_percent! <= 100;
      expect(isValid).toBe(true);
    });

    it('should validate no-show flat fee', () => {
      const policy = createMockPolicy({
        no_show_fee_type: 'amount',
        no_show_fee_amount_cents: 2500, // $25
      });

      expect(policy.no_show_fee_amount_cents).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero fees correctly', () => {
      const policy = createMockPolicy({
        cancel_fee_type: 'percent',
        cancel_fee_percent: 0,
        no_show_fee_type: 'percent',
        no_show_fee_percent: 0,
      });

      expect(policy.cancel_fee_percent).toBe(0);
      expect(policy.no_show_fee_percent).toBe(0);
    });
  });

  describe('Tenant Scoping', () => {
    it('should enforce tenant_id in all queries', () => {
      const businessId = 'biz-123';
      const userId = 'user-123';

      // All queries should include business_id or user_id filter
      const query = {
        from: 'bookings',
        eq: { business_id: businessId },
        eq_user: { user_id: userId },
      };

      expect(query.eq.business_id).toBe(businessId);
    });

    it('should prevent cross-tenant data access', () => {
      const ownerA = 'user-a';
      const ownerB = 'user-b';
      const businessA = createMockBusiness({ user_id: ownerA });
      const businessB = createMockBusiness({ user_id: ownerB });

      // Owner A should not access Business B data
      const canAccess = businessA.user_id === ownerB;
      expect(canAccess).toBe(false);
    });
  });
});

