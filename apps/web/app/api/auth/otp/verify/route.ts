/**
 * Verify OTP Code
 * Validates the code and returns verification status
 * The actual session creation happens via NextAuth Credentials provider
 */

import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SID;

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, code } = await req.json();

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: 'Phone number and code are required' },
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

    // Check verification code
    const verificationCheck = await client.verify.v2
      .services(verifySid)
      .verificationChecks
      .create({ to: phoneNumber, code });

    console.log('[OTP] Verification check:', phoneNumber, 'Status:', verificationCheck.status);

    if (verificationCheck.status !== 'approved') {
      return NextResponse.json(
        { error: 'Invalid or expired code', verified: false },
        { status: 400 }
      );
    }

    return NextResponse.json({
      verified: true,
      phoneNumber,
    });
  } catch (error: any) {
    console.error('[OTP] Error verifying code:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify code', verified: false },
      { status: 500 }
    );
  }
}
