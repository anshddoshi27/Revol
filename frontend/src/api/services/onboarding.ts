/**
 * Onboarding API Service
 * 
 * Service functions for onboarding-related API endpoints.
 * Handles business registration and subdomain validation.
 */

import { tithiApiClient } from '../client';
import type {
  OnboardingRegisterRequest,
  OnboardingRegisterResponse,
  SubdomainCheckResponse,
} from '../types/onboarding';

/**
 * Onboarding API service
 */
export const onboardingService = {
  /**
   * Register a new business with subdomain generation
   */
  register: async (data: OnboardingRegisterRequest): Promise<OnboardingRegisterResponse> => {
    const client = tithiApiClient();
    return client.post<OnboardingRegisterResponse>('/onboarding/register', data);
  },

  /**
   * Check if a subdomain is available
   */
  checkSubdomain: async (subdomain: string): Promise<SubdomainCheckResponse> => {
    const client = tithiApiClient();
    return client.get<SubdomainCheckResponse>(`/onboarding/check-subdomain/${subdomain}`);
  },
};

/**
 * Utility functions for onboarding
 */
export const onboardingUtils = {
  /**
   * Generate a slug from business name
   */
  generateSlug: (businessName: string): string => {
    return businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  },

  /**
   * Validate subdomain format
   */
  validateSubdomain: (subdomain: string): { isValid: boolean; error?: string } => {
    if (!subdomain) {
      return { isValid: false, error: 'Subdomain is required' };
    }

    if (subdomain.length < 2) {
      return { isValid: false, error: 'Subdomain must be at least 2 characters' };
    }

    if (subdomain.length > 50) {
      return { isValid: false, error: 'Subdomain must be less than 50 characters' };
    }

    // Check format: lowercase letters, numbers, and hyphens only
    const validFormat = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain);
    if (!validFormat) {
      return { 
        isValid: false, 
        error: 'Subdomain can only contain lowercase letters, numbers, and hyphens' 
      };
    }

    // Check for reserved words
    const reservedWords = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'blog', 'shop', 'store'];
    if (reservedWords.includes(subdomain)) {
      return { isValid: false, error: 'This subdomain is reserved' };
    }

    return { isValid: true };
  },

  /**
   * Get next available staff color
   */
  getNextStaffColor: (usedColors: string[]): string => {
    const { STAFF_COLORS } = require('../types/onboarding');
    const availableColors = STAFF_COLORS.filter(color => !usedColors.includes(color));
    return availableColors[0] || STAFF_COLORS[0];
  },
};
