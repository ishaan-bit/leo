/**
 * POST /api/auth/phone/verify-otp
 * 
 * Verify OTP code and create authenticated session
 * Creates user account if first time, or logs in existing user
 */

import { NextResponse } from 'next/server';
import { redis } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'your-secret-key'
);

export async function POST(req: Request) {
  try {
    const { phoneNumber, code } = await req.json();

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: 'Phone number and code are required' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid code format' },
        { status: 400 }
      );
    }

    // Retrieve stored OTP from Redis
    const otpKey = `otp:${normalizedPhone}`;
    const storedOtp = await redis.get(otpKey);

    if (!storedOtp) {
      return NextResponse.json(
        { error: 'Code expired or invalid' },
        { status: 401 }
      );
    }

    // Verify OTP matches
    if (storedOtp !== code) {
      return NextResponse.json(
        { error: 'Invalid code' },
        { status: 401 }
      );
    }

    // Delete OTP after successful verification (one-time use)
    await redis.del(otpKey);

    console.log('[OTP] Verified successfully for', normalizedPhone);

    // Check if user exists
    const userId = `phone:${normalizedPhone}`;
    let userData = await redis.hgetall(`user:${userId}`);

    if (!userData || Object.keys(userData).length === 0) {
      // Create new user
      userData = {
        id: userId,
        phone: normalizedPhone,
        auth_method: 'phone',
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
      };

      await redis.hset(`user:${userId}`, userData);
      console.log('[OTP] Created new user:', userId);
    } else {
      // Update last login
      await redis.hset(`user:${userId}`, {
        last_login: new Date().toISOString(),
      });
      console.log('[OTP] Existing user logged in:', userId);
    }

    // Create session token (JWT)
    const sessionToken = await new SignJWT({
      userId,
      phone: normalizedPhone,
      authMethod: 'phone',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d') // 30 days
      .sign(JWT_SECRET);

    // Store session in Redis (optional - for server-side session tracking)
    const sessionId = uuidv4();
    await redis.setex(
      `session:${sessionId}`,
      60 * 60 * 24 * 30, // 30 days
      JSON.stringify({
        userId,
        phone: normalizedPhone,
        createdAt: new Date().toISOString(),
      })
    );

    // Set session cookie
    const response = NextResponse.json({
      success: true,
      userId,
      message: 'Authenticated successfully',
    });

    response.cookies.set('leo-phone-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[OTP] Verify error:', err);
    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
