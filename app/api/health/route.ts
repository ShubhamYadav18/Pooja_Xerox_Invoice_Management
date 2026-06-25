import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// This endpoint is unauthenticated so UptimeRobot can hit it freely.
// It queries the database to ensure Neon stays awake.
export async function GET() {
  try {
    // Run a tiny query to wake up/keep alive the Neon database
    await prisma.businessProfile.count();
    return NextResponse.json({ status: "ok", database: "awake", timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ status: "error", message: "Database connection failed" }, { status: 500 });
  }
}
