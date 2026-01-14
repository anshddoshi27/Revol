/**
 * Mock Twilio client for unit tests
 * Simulates SMS sending success and failure
 */

import { vi } from 'vitest';

export const mockTwilioClient = {
  messages: {
    create: vi.fn(),
  },
};

// Default success response
mockTwilioClient.messages.create.mockResolvedValue({
  sid: 'SM_test123',
  status: 'queued',
  to: '+1234567890',
  from: '+0987654321',
  body: 'Test message',
});

// Helper functions to simulate different scenarios
export const simulateTwilioSuccess = () => {
  mockTwilioClient.messages.create.mockResolvedValueOnce({
    sid: 'SM_test123',
    status: 'queued',
    to: '+1234567890',
    from: '+0987654321',
    body: 'Test message',
  });
};

export const simulateTwilioFailure = () => {
  const error = new Error('Twilio API error');
  (error as any).code = 21211; // Invalid 'To' number
  mockTwilioClient.messages.create.mockRejectedValueOnce(error);
};

export const resetTwilioMocks = () => {
  vi.clearAllMocks();
  simulateTwilioSuccess();
};

