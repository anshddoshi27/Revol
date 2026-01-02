/**
 * Notification sender implementations for SendGrid (email) and Twilio (SMS)
 */

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email via SendGrid
 */
export async function sendEmailViaSendGrid(
  to: string,
  subject: string,
  body: string,
  fromEmail?: string
): Promise<SendEmailResult> {
  const sendGridApiKey = process.env.SENDGRID_API_KEY;
  const sendGridFromEmail = fromEmail || process.env.SENDGRID_FROM_EMAIL || 'noreply@revol.com';

  if (!sendGridApiKey) {
    console.error('SENDGRID_API_KEY not configured');
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
            subject: subject,
          },
        ],
        from: {
          email: sendGridFromEmail,
          name: 'Revol',
        },
        content: [
          {
            type: 'text/plain',
            value: body,
          },
          {
            type: 'text/html',
            value: body.replace(/\n/g, '<br>'), // Simple HTML conversion
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid API error:', response.status, errorText);
      return {
        success: false,
        error: `SendGrid API error: ${response.status}`,
      };
    }

    // SendGrid returns message ID in X-Message-Id header
    const messageId = response.headers.get('X-Message-Id') || undefined;

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    console.error('Error sending email via SendGrid:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send SMS via Twilio
 */
export async function sendSMSViaTwilio(
  to: string,
  body: string
): Promise<SendSMSResult> {
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    console.error('Twilio credentials not configured');
    return {
      success: false,
      error: 'SMS service not configured',
    };
  }

  try {
    // Format phone number (ensure it starts with +)
    const formattedTo = to.startsWith('+') ? to : `+${to.replace(/[^\d]/g, '')}`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', twilioFromNumber);
    formData.append('To', formattedTo);
    formData.append('Body', body);

    // Base64 encode credentials for Basic auth
    const credentials = `${twilioAccountSid}:${twilioAuthToken}`;
    const base64Credentials = btoa(credentials);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${base64Credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Twilio API error: ${response.status}`;
      
      // Parse error details for better error messages
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMessage = `Twilio API error: ${response.status} - ${errorData.message}`;
          
          // Check for common trial account errors
          if (errorData.code === 21211 || errorData.message?.includes('not a valid') || errorData.message?.includes('unverified')) {
            errorMessage += '\n💡 This phone number needs to be verified in Twilio Console (trial accounts can only send to verified numbers).';
            errorMessage += '\n   Verify at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified';
          }
        }
      } catch {
        // If parsing fails, use the raw error text
        if (errorText.includes('unverified') || errorText.includes('not verified')) {
          errorMessage += '\n💡 This phone number needs to be verified in Twilio Console (trial accounts can only send to verified numbers).';
          errorMessage += '\n   Verify at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified';
        }
      }
      
      console.error('Twilio API error:', response.status, errorText);
      return {
        success: false,
        error: errorMessage,
      };
    }

    const data = await response.json();

    return {
      success: true,
      messageId: data.sid,
    };
  } catch (error) {
    console.error('Error sending SMS via Twilio:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

