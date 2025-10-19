/**
 * Debug endpoint to check environment variables
 * DELETE THIS FILE after debugging is complete
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const hasTranslateKey = !!process.env.GOOGLE_TRANSLATE_API_KEY;
  const keyPreview = process.env.GOOGLE_TRANSLATE_API_KEY 
    ? `${process.env.GOOGLE_TRANSLATE_API_KEY.substring(0, 10)}...` 
    : 'NOT_FOUND';

  return NextResponse.json({
    status: 'debug-env',
    timestamp: new Date().toISOString(),
    env_check: {
      GOOGLE_TRANSLATE_API_KEY_present: hasTranslateKey,
      GOOGLE_TRANSLATE_API_KEY_preview: keyPreview,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    },
    instructions: 'DELETE /api/debug-env after debugging. This exposes partial key info.',
  });
}
