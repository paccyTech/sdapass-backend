// This endpoint is temporarily disabled due to build issues
// District admin can use the main umuganda-events endpoint for now
import { NextResponse } from "next/server";

export const GET = async () => {
  return NextResponse.json({ 
    message: "This endpoint is temporarily disabled. Please use the main umuganda-events endpoint.",
    status: 503 
  }, { status: 503 });
};
