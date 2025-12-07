/**
 * Tests for notification senders (SendGrid and Twilio)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmailViaSendGrid, sendSMSViaTwilio } from '../notification-senders';

// Mock fetch globally
global.fetch = vi.fn();

describe('SendGrid Email Sender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
    process.env.SENDGRID_FROM_EMAIL = 'test@tithi.com';
  });

  afterEach(() => {
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
  });

  it('should send email successfully', async () => {
    const mockResponse = {
      ok: true,
      status: 202,
      headers: new Headers({
        'X-Message-Id': 'test-message-id-123',
      }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const result = await sendEmailViaSendGrid(
      'customer@example.com',
      'Test Subject',
      'Test body content'
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('test-message-id-123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-sendgrid-key',
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('customer@example.com'),
      })
    );
  });

  it('should include HTML and plain text content', async () => {
    const mockResponse = {
      ok: true,
      status: 202,
      headers: new Headers(),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await sendEmailViaSendGrid(
      'customer@example.com',
      'Test Subject',
      'Line 1\nLine 2'
    );

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.content).toHaveLength(2);
    expect(body.content[0].type).toBe('text/plain');
    expect(body.content[0].value).toBe('Line 1\nLine 2');
    expect(body.content[1].type).toBe('text/html');
    expect(body.content[1].value).toBe('Line 1<br>Line 2');
  });

  it('should use default from email if not provided', async () => {
    const mockResponse = {
      ok: true,
      status: 202,
      headers: new Headers(),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await sendEmailViaSendGrid('customer@example.com', 'Subject', 'Body');

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.from.email).toBe('test@tithi.com');
  });

  it('should use custom from email if provided', async () => {
    const mockResponse = {
      ok: true,
      status: 202,
      headers: new Headers(),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await sendEmailViaSendGrid(
      'customer@example.com',
      'Subject',
      'Body',
      'custom@example.com'
    );

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.from.email).toBe('custom@example.com');
  });

  it('should handle API errors', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const result = await sendEmailViaSendGrid(
      'customer@example.com',
      'Subject',
      'Body'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('SendGrid API error');
  });

  it('should handle missing API key', async () => {
    delete process.env.SENDGRID_API_KEY;

    const result = await sendEmailViaSendGrid(
      'customer@example.com',
      'Subject',
      'Body'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Email service not configured');
  });

  it('should handle network errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const result = await sendEmailViaSendGrid(
      'customer@example.com',
      'Subject',
      'Body'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});

describe('Twilio SMS Sender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
    process.env.TWILIO_FROM_NUMBER = '+1234567890';
  });

  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
  });

  it('should send SMS successfully', async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      json: async () => ({ sid: 'SM1234567890abcdef' }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const result = await sendSMSViaTwilio('+1987654321', 'Test message');

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('SM1234567890abcdef');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.twilio.com/2010-04-01/Accounts/test-account-sid/Messages.json',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Basic'),
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      })
    );
  });

  it('should format phone number correctly (adds + if missing)', async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      json: async () => ({ sid: 'SM123' }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await sendSMSViaTwilio('1987654321', 'Test message');

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = callArgs[1].body;

    expect(body).toContain('To=%2B1987654321'); // URL encoded +
  });

  it('should keep + if already present', async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      json: async () => ({ sid: 'SM123' }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await sendSMSViaTwilio('+1987654321', 'Test message');

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = callArgs[1].body;

    expect(body).toContain('To=%2B1987654321');
  });

  it('should remove non-digit characters when adding +', async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      json: async () => ({ sid: 'SM123' }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await sendSMSViaTwilio('(987) 654-3210', 'Test message');

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = callArgs[1].body;

    expect(body).toContain('To=%2B9876543210');
  });

  it('should use correct Basic Auth encoding', async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      json: async () => ({ sid: 'SM123' }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await sendSMSViaTwilio('+1987654321', 'Test');

    const callArgs = (global.fetch as any).mock.calls[0];
    const authHeader = callArgs[1].headers.Authorization;

    expect(authHeader).toMatch(/^Basic /);
    // Should be base64 encoded credentials
    const base64Part = authHeader.replace('Basic ', '');
    const decoded = atob(base64Part);
    expect(decoded).toBe('test-account-sid:test-auth-token');
  });

  it('should include From, To, and Body in form data', async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      json: async () => ({ sid: 'SM123' }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await sendSMSViaTwilio('+1987654321', 'Test message body');

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = callArgs[1].body;

    expect(body).toContain('From=%2B1234567890');
    expect(body).toContain('To=%2B1987654321');
    expect(body).toContain('Body=Test+message+body');
  });

  it('should handle API errors', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      text: async () => 'Invalid phone number',
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const result = await sendSMSViaTwilio('+1987654321', 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Twilio API error');
  });

  it('should handle missing credentials', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;

    const result = await sendSMSViaTwilio('+1987654321', 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMS service not configured');
  });

  it('should handle network errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const result = await sendSMSViaTwilio('+1987654321', 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});

