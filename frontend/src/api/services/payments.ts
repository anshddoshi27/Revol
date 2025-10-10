/**
 * Payment Service
 * 
 * Service for handling payment-related API operations including Stripe integration,
 * wallet configuration, KYC verification, and go-live functionality.
 */

import { apiClient } from '../client';
import type {
  PaymentSetupData,
  WalletConfig,
  KYCData,
  GoLiveData,
  CreatePaymentSetupRequest,
  CreatePaymentSetupResponse,
  UpdateWalletConfigRequest,
  CreateKYCRequest,
  UpdateKYCRequest,
  GoLiveRequest,
  GoLiveResponse,
  StripeSetupIntent,
  StripePaymentMethod,
} from '../types/payments';

/**
 * Payment Service Class
 */
class PaymentService {
  /**
   * Create a Stripe setup intent for subscription payment
   */
  async createSetupIntent(request: CreatePaymentSetupRequest): Promise<CreatePaymentSetupResponse> {
    const response = await apiClient.post<CreatePaymentSetupResponse>(
      '/admin/payments/setup-intent',
      request
    );
    return response.data;
  }

  /**
   * Confirm a Stripe setup intent
   */
  async confirmSetupIntent(setupIntentId: string, paymentMethodId: string): Promise<StripeSetupIntent> {
    const response = await apiClient.post<StripeSetupIntent>(
      `/admin/payments/setup-intent/${setupIntentId}/confirm`,
      { payment_method: paymentMethodId }
    );
    return response.data;
  }

  /**
   * Get payment setup data for a tenant
   */
  async getPaymentSetup(tenantId: string): Promise<PaymentSetupData> {
    const response = await apiClient.get<PaymentSetupData>(
      `/admin/payments/setup/${tenantId}`
    );
    return response.data;
  }

  /**
   * Update wallet configuration
   */
  async updateWalletConfig(tenantId: string, request: UpdateWalletConfigRequest): Promise<WalletConfig> {
    const response = await apiClient.put<WalletConfig>(
      `/admin/payments/wallets/${tenantId}`,
      request
    );
    return response.data;
  }

  /**
   * Create KYC data
   */
  async createKYC(tenantId: string, request: CreateKYCRequest): Promise<KYCData> {
    const response = await apiClient.post<KYCData>(
      `/admin/payments/kyc/${tenantId}`,
      request
    );
    return response.data;
  }

  /**
   * Update KYC data
   */
  async updateKYC(tenantId: string, request: UpdateKYCRequest): Promise<KYCData> {
    const response = await apiClient.put<KYCData>(
      `/admin/payments/kyc/${tenantId}`,
      request
    );
    return response.data;
  }

  /**
   * Get KYC data for a tenant
   */
  async getKYC(tenantId: string): Promise<KYCData> {
    const response = await apiClient.get<KYCData>(
      `/admin/payments/kyc/${tenantId}`
    );
    return response.data;
  }

  /**
   * Go live with the business
   */
  async goLive(tenantId: string, request: GoLiveRequest): Promise<GoLiveResponse> {
    const response = await apiClient.post<GoLiveResponse>(
      `/admin/payments/go-live/${tenantId}`,
      request
    );
    return response.data;
  }

  /**
   * Get go-live status
   */
  async getGoLiveStatus(tenantId: string): Promise<GoLiveData> {
    const response = await apiClient.get<GoLiveData>(
      `/admin/payments/go-live/${tenantId}`
    );
    return response.data;
  }

  /**
   * Validate payment setup completeness
   */
  async validatePaymentSetup(tenantId: string): Promise<{
    is_complete: boolean;
    missing_fields: string[];
    can_go_live: boolean;
  }> {
    const response = await apiClient.get<{
      is_complete: boolean;
      missing_fields: string[];
      can_go_live: boolean;
    }>(`/admin/payments/validate/${tenantId}`);
    return response.data;
  }

  /**
   * Get Stripe payment methods for a customer
   */
  async getPaymentMethods(tenantId: string): Promise<StripePaymentMethod[]> {
    const response = await apiClient.get<StripePaymentMethod[]>(
      `/admin/payments/methods/${tenantId}`
    );
    return response.data;
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(tenantId: string, paymentMethodId: string): Promise<void> {
    await apiClient.delete(`/admin/payments/methods/${tenantId}/${paymentMethodId}`);
  }

  /**
   * Test payment setup (for development)
   */
  async testPaymentSetup(tenantId: string): Promise<{
    setup_intent_status: string;
    payment_method_attached: boolean;
    subscription_active: boolean;
  }> {
    const response = await apiClient.get<{
      setup_intent_status: string;
      payment_method_attached: boolean;
      subscription_active: boolean;
    }>(`/admin/payments/test/${tenantId}`);
    return response.data;
  }
}

// Create and export the service instance
export const paymentService = new PaymentService();

// Export the service class for testing
export { PaymentService };

