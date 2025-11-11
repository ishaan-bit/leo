/**
 * Send OTP to Phone Number
 * Uses Twilio Verify API for secure OTP delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SID;

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate phone number format (E.164)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use E.164 format (e.g., +1234567890)' },
        { status: 400 }
      );
    }

    if (!accountSid || !authToken || !verifySid) {
      console.error('[OTP] Missing Twilio credentials');
      return NextResponse.json(
        { error: 'OTP service not configured' },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);

    // Send verification code
    const verification = await client.verify.v2
      .services(verifySid)
      .verifications
      .create({ to: phoneNumber, channel: 'sms' });

    console.log('[OTP] Sent verification to:', phoneNumber, 'Status:', verification.status);

    return NextResponse.json({
      success: true,
      status: verification.status,
    });
  } catch (error: any) {
    console.error('[OTP] Error sending verification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
