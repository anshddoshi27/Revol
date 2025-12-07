/**
 * Unit tests for gift card discount calculation and policy fee math
 * Tests all pricing scenarios including edge cases
 */

import { describe, it, expect } from 'vitest';

/**
 * Calculate final price after gift card discount
 */
function calculateFinalPrice(
  basePriceCents: number,
  giftCardType: 'amount' | 'percent' | null,
  giftCardValue: number
): number {
  if (!giftCardType) {
    return basePriceCents;
  }

  if (giftCardType === 'amount') {
    // Amount-type: discount is min of balance and base price
    const discount = Math.min(basePriceCents, giftCardValue);
    return Math.max(0, basePriceCents - discount);
  } else {
    // Percent-type: discount is percentage of base price
    const discount = Math.round(basePriceCents * (giftCardValue / 100));
    return Math.max(0, basePriceCents - discount);
  }
}

/**
 * Calculate no-show or cancellation fee
 */
function calculateFee(
  basePriceCents: number,
  feeType: 'amount' | 'percent',
  feeValue: number
): number {
  if (feeType === 'amount') {
    return feeValue;
  } else {
    return Math.round(basePriceCents * (feeValue / 100));
  }
}

describe('Gift Card Discount Calculation', () => {
  describe('Amount-type gift cards', () => {
    it('should apply full discount when balance exceeds price', () => {
      const basePrice = 10000; // $100
      const giftCardBalance = 5000; // $50
      const finalPrice = calculateFinalPrice(basePrice, 'amount', giftCardBalance);
      
      expect(finalPrice).toBe(5000); // $50 remaining
    });

    it('should apply partial discount when balance is less than price', () => {
      const basePrice = 10000; // $100
      const giftCardBalance = 3000; // $30
      const finalPrice = calculateFinalPrice(basePrice, 'amount', giftCardBalance);
      
      expect(finalPrice).toBe(7000); // $70 remaining
    });

    it('should not allow negative prices', () => {
      const basePrice = 3000; // $30
      const giftCardBalance = 5000; // $50 (more than price)
      const finalPrice = calculateFinalPrice(basePrice, 'amount', giftCardBalance);
      
      expect(finalPrice).toBe(0); // Clamped at $0
    });

    it('should handle zero balance', () => {
      const basePrice = 10000; // $100
      const giftCardBalance = 0;
      const finalPrice = calculateFinalPrice(basePrice, 'amount', giftCardBalance);
      
      expect(finalPrice).toBe(10000); // No discount
    });
  });

  describe('Percent-type gift cards', () => {
    it('should apply 20% discount correctly', () => {
      const basePrice = 10000; // $100
      const percentOff = 20;
      const finalPrice = calculateFinalPrice(basePrice, 'percent', percentOff);
      
      expect(finalPrice).toBe(8000); // $80 (20% off)
    });

    it('should apply 50% discount correctly', () => {
      const basePrice = 10000; // $100
      const percentOff = 50;
      const finalPrice = calculateFinalPrice(basePrice, 'percent', percentOff);
      
      expect(finalPrice).toBe(5000); // $50 (50% off)
    });

    it('should handle 100% discount (free)', () => {
      const basePrice = 10000; // $100
      const percentOff = 100;
      const finalPrice = calculateFinalPrice(basePrice, 'percent', percentOff);
      
      expect(finalPrice).toBe(0); // Free
    });

    it('should round discount amounts correctly', () => {
      const basePrice = 9999; // $99.99
      const percentOff = 33; // 33% off
      const finalPrice = calculateFinalPrice(basePrice, 'percent', percentOff);
      
      // 33% of $99.99 = $32.9967, rounded = $33.00
      // Final = $99.99 - $33.00 = $66.99
      expect(finalPrice).toBe(6699); // Rounded correctly
    });

    it('should not allow negative prices', () => {
      const basePrice = 1000; // $10
      const percentOff = 150; // 150% (invalid but should handle)
      const finalPrice = calculateFinalPrice(basePrice, 'percent', percentOff);
      
      expect(finalPrice).toBe(0); // Clamped at $0
    });
  });

  describe('No gift card', () => {
    it('should return base price when no gift card', () => {
      const basePrice = 10000; // $100
      const finalPrice = calculateFinalPrice(basePrice, null, 0);
      
      expect(finalPrice).toBe(10000); // No change
    });
  });
});

describe('Policy Fee Calculation', () => {
  describe('Flat fee (amount)', () => {
    it('should charge flat fee regardless of price', () => {
      const basePrice = 10000; // $100
      const fee = calculateFee(basePrice, 'amount', 2500); // $25 flat fee
      
      expect(fee).toBe(2500); // $25
    });

    it('should handle zero fee', () => {
      const basePrice = 10000; // $100
      const fee = calculateFee(basePrice, 'amount', 0);
      
      expect(fee).toBe(0); // No fee
    });

    it('should handle fee larger than price', () => {
      const basePrice = 1000; // $10
      const fee = calculateFee(basePrice, 'amount', 5000); // $50 fee
      
      expect(fee).toBe(5000); // Fee is still $50 (business decision)
    });
  });

  describe('Percent fee', () => {
    it('should calculate 50% fee correctly', () => {
      const basePrice = 10000; // $100
      const fee = calculateFee(basePrice, 'percent', 50);
      
      expect(fee).toBe(5000); // $50 (50% of $100)
    });

    it('should calculate 25% fee correctly', () => {
      const basePrice = 8000; // $80
      const fee = calculateFee(basePrice, 'percent', 25);
      
      expect(fee).toBe(2000); // $20 (25% of $80)
    });

    it('should round percent fees correctly', () => {
      const basePrice = 9999; // $99.99
      const fee = calculateFee(basePrice, 'percent', 33);
      
      // 33% of $99.99 = $32.9967, rounded = $33.00
      expect(fee).toBe(3300); // Rounded to $33.00
    });

    it('should handle zero percent fee', () => {
      const basePrice = 10000; // $100
      const fee = calculateFee(basePrice, 'percent', 0);
      
      expect(fee).toBe(0); // No fee
    });

    it('should handle 100% fee (full price)', () => {
      const basePrice = 10000; // $100
      const fee = calculateFee(basePrice, 'percent', 100);
      
      expect(fee).toBe(10000); // $100 (100% of price)
    });
  });

  describe('No-show fee scenarios', () => {
    it('should calculate no-show fee from final price (after gift card)', () => {
      const basePrice = 10000; // $100
      const finalPrice = 8000; // $80 (after $20 gift card)
      const noShowFee = calculateFee(finalPrice, 'percent', 50);
      
      expect(noShowFee).toBe(4000); // $40 (50% of $80, not $100)
    });

    it('should handle flat no-show fee', () => {
      const finalPrice = 10000; // $100
      const noShowFee = calculateFee(finalPrice, 'amount', 2500); // $25 flat
      
      expect(noShowFee).toBe(2500); // $25
    });
  });

  describe('Cancellation fee scenarios', () => {
    it('should calculate cancellation fee from final price', () => {
      const basePrice = 15000; // $150
      const finalPrice = 12000; // $120 (after $30 gift card)
      const cancelFee = calculateFee(finalPrice, 'percent', 50);
      
      expect(cancelFee).toBe(6000); // $60 (50% of $120)
    });

    it('should handle zero cancellation fee (free cancellation)', () => {
      const finalPrice = 10000; // $100
      const cancelFee = calculateFee(finalPrice, 'percent', 0);
      
      expect(cancelFee).toBe(0); // No fee
    });
  });
});

describe('Price Calculation Edge Cases', () => {
  it('should handle very small prices', () => {
    const basePrice = 1; // $0.01
    const finalPrice = calculateFinalPrice(basePrice, 'percent', 50);
    
    expect(finalPrice).toBe(0); // Rounded down to $0
  });

  it('should handle very large prices', () => {
    const basePrice = 1000000; // $10,000
    const finalPrice = calculateFinalPrice(basePrice, 'percent', 20);
    
    expect(finalPrice).toBe(800000); // $8,000 (20% off)
  });

  it('should handle fractional cents correctly', () => {
    // Test that rounding works correctly for odd percentages
    const basePrice = 999; // $9.99
    const finalPrice = calculateFinalPrice(basePrice, 'percent', 33);
    
    // 33% of $9.99 = $3.2967, rounded = $3.30
    // Final = $9.99 - $3.30 = $6.69
    expect(finalPrice).toBe(669); // $6.69
  });
});



