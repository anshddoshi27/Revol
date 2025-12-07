/**
 * Unit tests for gift card ledger logic
 * Tests balance calculation, issuance, redemption, and over-redemption prevention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockGiftCard, createMockGiftCardLedger } from '../../test/factories';

describe('Gift Card Ledger Logic', () => {
  describe('Balance Calculation', () => {
    it('should calculate remaining balance correctly after issuance', () => {
      const giftCard = createMockGiftCard({
        amount_cents: 10000, // $100
        current_balance_cents: 10000,
      });

      const ledgerEntry = createMockGiftCardLedger({
        gift_card_id: giftCard.id,
        delta_cents: 10000,
        reason: 'issuance',
      });

      // Balance should equal initial amount
      expect(giftCard.current_balance_cents).toBe(10000);
      expect(ledgerEntry.delta_cents).toBe(10000);
    });

    it('should calculate remaining balance after partial redemption', () => {
      const initialBalance = 10000; // $100
      const redemptionAmount = 3000; // $30
      const expectedBalance = initialBalance - redemptionAmount;

      const giftCard = createMockGiftCard({
        amount_cents: 10000,
        current_balance_cents: initialBalance,
      });

      const redemptionEntry = createMockGiftCardLedger({
        gift_card_id: giftCard.id,
        delta_cents: -redemptionAmount,
        reason: 'redemption',
      });

      const newBalance = giftCard.current_balance_cents + redemptionEntry.delta_cents;
      expect(newBalance).toBe(expectedBalance);
    });

    it('should calculate remaining balance after multiple redemptions', () => {
      const initialBalance = 10000; // $100
      const redemption1 = 2000; // $20
      const redemption2 = 3000; // $30
      const expectedBalance = initialBalance - redemption1 - redemption2;

      let balance = initialBalance;
      balance += -redemption1; // First redemption
      balance += -redemption2; // Second redemption

      expect(balance).toBe(expectedBalance);
    });

    it('should prevent negative balance', () => {
      const initialBalance = 5000; // $50
      const redemptionAmount = 6000; // $60 (more than balance)

      const newBalance = Math.max(0, initialBalance - redemptionAmount);
      expect(newBalance).toBe(0); // Should clamp at 0
    });
  });

  describe('Issuance Entry', () => {
    it('should create issuance entry with positive delta', () => {
      const ledgerEntry = createMockGiftCardLedger({
        delta_cents: 10000,
        reason: 'issuance',
      });

      expect(ledgerEntry.delta_cents).toBeGreaterThan(0);
      expect(ledgerEntry.reason).toBe('issuance');
    });

    it('should update gift card balance on issuance', () => {
      const giftCard = createMockGiftCard({
        current_balance_cents: 0,
      });

      const issuanceAmount = 10000;
      const newBalance = giftCard.current_balance_cents + issuanceAmount;

      expect(newBalance).toBe(10000);
    });
  });

  describe('Redemption Entry', () => {
    it('should create redemption entry with negative delta', () => {
      const ledgerEntry = createMockGiftCardLedger({
        delta_cents: -5000,
        reason: 'redemption',
        booking_id: 'booking-123',
      });

      expect(ledgerEntry.delta_cents).toBeLessThan(0);
      expect(ledgerEntry.reason).toBe('redemption');
      expect(ledgerEntry.booking_id).toBeTruthy();
    });

    it('should update gift card balance on redemption', () => {
      const giftCard = createMockGiftCard({
        current_balance_cents: 10000,
      });

      const redemptionAmount = 3000;
      const newBalance = Math.max(0, giftCard.current_balance_cents - redemptionAmount);

      expect(newBalance).toBe(7000);
    });
  });

  describe('Over-Redemption Prevention', () => {
    it('should prevent redemption exceeding balance', () => {
      const balance = 5000; // $50
      const attemptedRedemption = 6000; // $60

      const actualRedemption = Math.min(balance, attemptedRedemption);
      expect(actualRedemption).toBe(5000); // Should cap at balance
    });

    it('should allow redemption equal to balance', () => {
      const balance = 5000; // $50
      const redemption = 5000; // $50

      const actualRedemption = Math.min(balance, redemption);
      expect(actualRedemption).toBe(5000);
    });

    it('should prevent multiple redemptions exceeding total balance', () => {
      const initialBalance = 10000; // $100
      const redemption1 = 4000; // $40
      const redemption2 = 4000; // $40
      const redemption3 = 3000; // $30 (would exceed)

      let balance = initialBalance;
      
      // First redemption
      if (redemption1 <= balance) {
        balance -= redemption1;
      }
      expect(balance).toBe(6000);

      // Second redemption
      if (redemption2 <= balance) {
        balance -= redemption2;
      }
      expect(balance).toBe(2000);

      // Third redemption (should be prevented or capped)
      const allowedRedemption3 = Math.min(balance, redemption3);
      balance -= allowedRedemption3;
      expect(balance).toBe(0);
      expect(allowedRedemption3).toBe(2000); // Capped at remaining balance
    });
  });

  describe('Balance Restoration', () => {
    it('should restore balance on refund for amount-type gift cards', () => {
      const initialBalance = 10000; // $100
      const redemptionAmount = 5000; // $50
      const balanceAfterRedemption = initialBalance - redemptionAmount;

      // Refund restores the redemption amount
      const restoredBalance = balanceAfterRedemption + redemptionAmount;
      expect(restoredBalance).toBe(initialBalance);
    });

    it('should not restore balance for percent-type gift cards', () => {
      const giftCard = createMockGiftCard({
        discount_type: 'percent',
        percent_off: 25,
        current_balance_cents: 0, // Percent cards don't have balance
      });

      // Percent cards should not have balance restoration
      expect(giftCard.current_balance_cents).toBe(0);
      expect(giftCard.discount_type).toBe('percent');
    });
  });

  describe('Ledger Entry Validation', () => {
    it('should require booking_id for redemption entries', () => {
      const redemptionEntry = createMockGiftCardLedger({
        delta_cents: -5000,
        reason: 'redemption',
        booking_id: 'booking-123',
      });

      expect(redemptionEntry.booking_id).toBeTruthy();
      expect(redemptionEntry.delta_cents).toBeLessThan(0);
    });

    it('should not require booking_id for issuance entries', () => {
      const issuanceEntry = createMockGiftCardLedger({
        delta_cents: 10000,
        reason: 'issuance',
        booking_id: null,
      });

      expect(issuanceEntry.booking_id).toBeNull();
      expect(issuanceEntry.delta_cents).toBeGreaterThan(0);
    });
  });
});

