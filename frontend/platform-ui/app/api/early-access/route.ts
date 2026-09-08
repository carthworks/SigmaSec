import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, source } = body || {};

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Server-side audit log for early access leads
    console.info(`[PILOT_LEAD] New pilot request received: ${trimmedEmail} (source: ${source || "landing"}, time: ${new Date().toISOString()})`);

    // In production, optionally persist to database or forward to CRM/webhook
    return NextResponse.json({
      success: true,
      message: "Pilot request registered successfully",
      data: {
        email: trimmedEmail,
        registeredAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[PILOT_LEAD_ERROR] Failed to process early access request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
