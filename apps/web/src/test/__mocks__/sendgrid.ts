/**
 * Mock SendGrid client for unit tests
 * Simulates email sending success and failure
 */

import { vi } from 'vitest';

export const mockSendGridClient = {
  send: vi.fn(),
};

// Default success response
mockSendGridClient.send.mockResolvedValue([
  {
    statusCode: 202,
    body: {},
    headers: {},
  },
  {},
]);

// Helper functions to simulate different scenarios
export const simulateSendGridSuccess = () => {
  mockSendGridClient.send.mockResolvedValueOnce([
    {
      statusCode: 202,
      body: {},
      headers: {},
    },
    {},
  ]);
};

export const simulateSendGridFailure = () => {
  const error = new Error('SendGrid API error');
  mockSendGridClient.send.mockRejectedValueOnce(error);
};

export const resetSendGridMocks = () => {
  vi.clearAllMocks();
  simulateSendGridSuccess();
};

