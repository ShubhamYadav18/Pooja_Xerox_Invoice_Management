"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { runPaymentRemindersManually } from "@/server/actions/payment-reminder-cron";

interface ReminderResult {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  recipientEmail: string;
  reminderCount: number;
  daysOverdue: number;
  success: boolean;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

interface CronSummary {
  processedAt: string;
  totalUnpaid: number;
  eligible: number;
  sent: number;
  skipped: number;
  failed: number;
  results: ReminderResult[];
  error?: string;
}

export function PaymentReminderButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<CronSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const data = await runPaymentRemindersManually() as CronSummary;
      setSummary(data);
      setOpen(true);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || "Failed to contact server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="secondary"
        onClick={handleRun}
        disabled={loading}
        id="run-payment-reminders-btn"
        className="flex items-center gap-2"
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
        {loading ? "Sending Reminders…" : "Send Payment Reminders"}
      </Button>

      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}

      {/* Results modal */}
      {open && summary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
              <div>
                <h2 className="text-lg font-semibold">Payment Reminder Run Complete</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(summary.processedAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 hover:bg-muted transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 divide-x border-b">
              {[
                { label: "Total Unpaid", value: summary.totalUnpaid, color: "text-foreground" },
                { label: "Sent", value: summary.sent, color: "text-emerald-600" },
                { label: "Skipped", value: summary.skipped, color: "text-amber-600" },
                { label: "Failed", value: summary.failed, color: "text-destructive" },
              ].map((s) => (
                <div key={s.label} className="p-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Results list */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {summary.results.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-8">No invoices processed.</p>
              )}
              {summary.results.map((r) => (
                <div
                  key={r.invoiceId}
                  className={`rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
                    r.success
                      ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20"
                      : r.skipped
                      ? "border-muted bg-muted/30"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      Invoice #{r.invoiceNumber} — {r.customerName}
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {r.recipientEmail !== "(no email)" ? r.recipientEmail : "No email on file"}
                      {r.daysOverdue > 0 ? ` · ${r.daysOverdue} days overdue` : ""}
                    </p>
                    {r.skipReason && (
                      <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">⚠ {r.skipReason}</p>
                    )}
                    {r.error && (
                      <p className="text-destructive text-xs mt-1">✗ {r.error}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                      r.success
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                        : r.skipped
                        ? "bg-muted text-muted-foreground"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {r.success ? "✓ Sent" : r.skipped ? "Skipped" : "Failed"}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-3 flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
