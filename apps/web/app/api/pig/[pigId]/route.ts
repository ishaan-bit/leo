import { NextRequest, NextResponse } from "next/server";
import { getPigName } from "@/domain/pig/pig.storage";

export async function GET(_req: NextRequest, { params }: { params: { pigId: string } }) {
  const pigId = params.pigId;
  
  // Fetch from server-side storage (persists across browsers/devices)
  const name = getPigName(pigId);
  
  return NextResponse.json({ 
    pigId, 
    named: !!name, 
    name 
  });
}
