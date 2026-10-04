"use client";

import { useTransition, useState } from "react";
import { toggleReminderEmails } from "@/server/actions/reminder-toggle";

export function ReminderEmailToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !enabled;
    setEnabled(next); // optimistic update
    startTransition(async () => {
      try {
        await toggleReminderEmails(next);
      } catch {
        setEnabled(!next); // revert on error
      }
    });
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Automated Payment Reminder Emails</span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              enabled
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
            }`}
          >
            {enabled ? "Active" : "Paused"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? "Automated emails will run daily for pending overdue invoices. Turn off anytime to pause mail delivery (e.g. for a specific month)."
            : "Sending is paused. No automated reminder emails will be sent out until you toggle this back ON."}
        </p>
      </div>

      <div className="flex items-center gap-3 self-end sm:self-center">
        <span className="text-xs font-medium text-muted-foreground">
          {isPending ? "Updating..." : enabled ? "ON" : "OFF"}
        </span>
        <button
          id="reminder-email-toggle"
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle automated reminder emails"
          onClick={handleToggle}
          disabled={isPending}
          className={[
            "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60",
            enabled ? "bg-emerald-600 dark:bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700",
          ].join(" ")}
        >
          <span
            className={[
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200",
              enabled ? "translate-x-5" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </div>
    </div>
  );
}
