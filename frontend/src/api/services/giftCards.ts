/**
 * Gift Card API Service
 * 
 * Service functions for gift card configuration and management.
 * These functions handle API calls to the backend gift card endpoints.
 */

import { apiClient } from '../client';
import type {
  GiftCardConfig,
  Denomination,
  GiftCardFormData,
  DenominationFormData,
  GiftCardValidationRequest,
  GiftCardValidationResponse,
  GiftCardStats,
  CreateGiftCardConfigRequest,
  UpdateGiftCardConfigRequest,
  CreateDenominationRequest,
  UpdateDenominationRequest,
} from '../types/giftCards';

// ===== GIFT CARD CONFIGURATION ENDPOINTS =====

/**
 * Get gift card configuration for the current tenant
 */
export const getGiftCardConfig = async (): Promise<GiftCardConfig> => {
  const response = await apiClient.get<GiftCardConfig>('/api/v1/admin/promotions/gift-cards/config');
  return response.data;
};

/**
 * Create or update gift card configuration
 */
export const createOrUpdateGiftCardConfig = async (
  config: CreateGiftCardConfigRequest
): Promise<GiftCardConfig> => {
  const response = await apiClient.post<GiftCardConfig>(
    '/api/v1/admin/promotions/gift-cards/config',
    config
  );
  return response.data;
};

/**
 * Update existing gift card configuration
 */
export const updateGiftCardConfig = async (
  id: string,
  config: UpdateGiftCardConfigRequest
): Promise<GiftCardConfig> => {
  const response = await apiClient.put<GiftCardConfig>(
    `/api/v1/admin/promotions/gift-cards/config/${id}`,
    config
  );
  return response.data;
};

/**
 * Delete gift card configuration
 */
export const deleteGiftCardConfig = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/v1/admin/promotions/gift-cards/config/${id}`);
};

// ===== DENOMINATION ENDPOINTS =====

/**
 * Get all denominations for the current tenant
 */
export const getDenominations = async (): Promise<Denomination[]> => {
  const response = await apiClient.get<Denomination[]>('/api/v1/admin/promotions/gift-cards/denominations');
  return response.data;
};

/**
 * Create a new denomination
 */
export const createDenomination = async (
  denomination: CreateDenominationRequest
): Promise<Denomination> => {
  const response = await apiClient.post<Denomination>(
    '/api/v1/admin/promotions/gift-cards/denominations',
    denomination
  );
  return response.data;
};

/**
 * Update an existing denomination
 */
export const updateDenomination = async (
  id: string,
  denomination: UpdateDenominationRequest
): Promise<Denomination> => {
  const response = await apiClient.put<Denomination>(
    `/api/v1/admin/promotions/gift-cards/denominations/${id}`,
    denomination
  );
  return response.data;
};

/**
 * Delete a denomination
 */
export const deleteDenomination = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/v1/admin/promotions/gift-cards/denominations/${id}`);
};

// ===== GIFT CARD VALIDATION ENDPOINTS =====

/**
 * Validate a gift card code
 */
export const validateGiftCard = async (
  request: GiftCardValidationRequest
): Promise<GiftCardValidationResponse> => {
  const response = await apiClient.post<GiftCardValidationResponse>(
    '/api/v1/promotions/gift-cards/validate',
    request
  );
  return response.data;
};

// ===== GIFT CARD STATS ENDPOINTS =====

/**
 * Get gift card statistics for the current tenant
 */
export const getGiftCardStats = async (): Promise<GiftCardStats> => {
  const response = await apiClient.get<GiftCardStats>('/api/v1/admin/promotions/gift-cards/stats');
  return response.data;
};

// ===== BULK OPERATIONS =====

/**
 * Create multiple denominations at once
 */
export const createMultipleDenominations = async (
  denominations: CreateDenominationRequest[]
): Promise<Denomination[]> => {
  const response = await apiClient.post<Denomination[]>(
    '/api/v1/admin/promotions/gift-cards/denominations/bulk',
    { denominations }
  );
  return response.data;
};

/**
 * Update multiple denominations at once
 */
export const updateMultipleDenominations = async (
  updates: Array<{ id: string; data: UpdateDenominationRequest }>
): Promise<Denomination[]> => {
  const response = await apiClient.put<Denomination[]>(
    '/api/v1/admin/promotions/gift-cards/denominations/bulk',
    { updates }
  );
  return response.data;
};

/**
 * Delete multiple denominations at once
 */
export const deleteMultipleDenominations = async (ids: string[]): Promise<void> => {
  await apiClient.delete('/api/v1/admin/promotions/gift-cards/denominations/bulk', {
    data: { ids }
  });
};

