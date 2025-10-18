import { NextRequest, NextResponse } from "next/server";
import { getPigName } from "@/domain/pig/pig.storage";

export async function GET(_req: NextRequest, { params }: { params: { pigId: string } }) {
  const pigId = params.pigId;
  
  // Fetch from Vercel KV (persists across serverless invocations, browsers, and devices)
  const name = await getPigName(pigId);
  
  return NextResponse.json({ 
    pigId, 
    named: !!name, 
    name 
  });
}
