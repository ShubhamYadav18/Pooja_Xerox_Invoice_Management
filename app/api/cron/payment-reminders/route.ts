import { NextResponse } from "next/server";
import { runPaymentReminderCron } from "@/server/actions/payment-reminder-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds

export async function GET(req: Request) {
  // ── Security: verify cron secret ──────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Optional query params ──────────────────────────────────────────────────
  const url = new URL(req.url);
  const testEmail = url.searchParams.get("testEmail") ?? undefined;
  const testReminderNumber = url.searchParams.get("testReminderNumber")
    ? Number(url.searchParams.get("testReminderNumber"))
    : undefined;
  const profileCode = url.searchParams.get("profileCode") ?? undefined;

  if (testEmail) {
    console.log(
      `[PaymentReminderCron] ⚠️  TEST MODE — all emails will go to: ${testEmail}${
        testReminderNumber ? ` (forced reminder #${testReminderNumber})` : ""
      }${profileCode ? ` (filtered to profile: ${profileCode})` : ""}`
    );
  }

  try {
    console.log("[PaymentReminderCron] Starting run...");
    const summary = await runPaymentReminderCron({ testEmail, testReminderNumber, profileCode });

    console.log(
      `[PaymentReminderCron] Done — sent: ${summary.sent}, skipped: ${summary.skipped}, failed: ${summary.failed}`
    );

    return NextResponse.json({
      ok: true,
      testMode: !!testEmail,
      testEmail: testEmail ?? null,
      ...summary,
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("[PaymentReminderCron] Fatal error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Unexpected error in payment reminder cron" },
      { status: 500 }
    );
  }
}
