/**
 * POST /api/auth/phone/send-otp
 * 
 * Send OTP code to phone number via Twilio
 * Stores OTP in Redis with 10-minute expiry
 */

import { NextResponse } from 'next/server';
import { redis } from '@/lib/supabase';
import crypto from 'crypto';

// Twilio configuration (optional - can use other SMS providers)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

export async function POST(req: Request) {
  try {
    const { phoneNumber } = await req.json();

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    // Validate phone number format (basic check)
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Store OTP in Redis with 10-minute expiry
    const otpKey = `otp:${normalizedPhone}`;
    await redis.setex(otpKey, 600, otp); // 10 minutes

    console.log('[OTP] Generated for', normalizedPhone, ':', otp);

    // Send OTP via Twilio (if configured)
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        
        const formData = new URLSearchParams();
        formData.append('To', `+${normalizedPhone}`);
        formData.append('From', TWILIO_PHONE_NUMBER);
        formData.append('Body', `Your Leo verification code is: ${otp}\n\nThis code expires in 10 minutes.`);

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('[OTP] Twilio error:', error);
          throw new Error('Failed to send SMS');
        }

        console.log('[OTP] Sent via Twilio to', normalizedPhone);
      } catch (twilioError) {
        console.error('[OTP] Twilio send failed:', twilioError);
        // Continue anyway - in development, we can check Redis logs
      }
    } else {
      // Development mode - log OTP to console
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📱 DEV MODE: OTP for', normalizedPhone);
      console.log('🔐 Code:', otp);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      // In production, don't return the OTP!
      ...(process.env.NODE_ENV === 'development' && { dev_otp: otp }),
    });
  } catch (err) {
    console.error('[OTP] Send error:', err);
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
