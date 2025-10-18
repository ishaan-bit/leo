import { NextRequest, NextResponse } from "next/server";
import { savePigName, isPigNamed } from "@/domain/pig/pig.storage";

export async function POST(req: NextRequest) {
  const { pigId, name } = await req.json();
  
  if (!pigId || !name) {
    return NextResponse.json(
      { error: "pigId and name are required" }, 
      { status: 400 }
    );
  }

  // Validate name length
  if (name.trim().length < 2) {
    return NextResponse.json(
      { error: "Name must be at least 2 characters" }, 
      { status: 400 }
    );
  }

  // Check if already named (optional - remove if you want to allow renaming)
  if (isPigNamed(pigId)) {
    return NextResponse.json(
      { error: "This pig has already been named" }, 
      { status: 400 }
    );
  }

  // Save to server-side storage (persists across browsers/devices)
  try {
    savePigName(pigId, name.trim());
    
    return NextResponse.json({ 
      ok: true, 
      pigId, 
      name: name.trim() 
    });
  } catch (error) {
    console.error('Error saving pig name:', error);
    return NextResponse.json(
      { error: "Failed to save name" }, 
      { status: 500 }
    );
  }
}
