const META_API_VERSION = "v19.0";

function ownerPhones() {
  return [...new Set([
    process.env.WHATSAPP_OWNER_PHONE,
    process.env.WHATSAPP_OWNER_PHONE_2,
  ].filter((phone): phone is string => Boolean(phone && phone !== "91XXXXXXXXXX")))];
}

async function sendText(to: string, body: string) {
  const token = process.env.WHATSAPP_META_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return;

  const response = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Meta WhatsApp API returned HTTP ${response.status}`);
  }
}

// ─── 1. Per-reminder owner confirmation ───────────────────────────────────────
// Fires once per customer email successfully sent during the cron/manual run.
// Gated by WHATSAPP_EMAIL_CONFIRMATIONS=true. Test-email runs are blocked at
// the call site (payment-reminder-cron.ts) before this function is reached.

export async function notifyOwnersOfReminderEmail(details: {
  profileName: string;
  customerName: string;
  invoiceNumber: string;
  recipientEmail: string;
  amount: string;
  reminderNumber: number;
  maxReminders: number;
  daysOverdue: number;
}) {
  if (process.env.WHATSAPP_EMAIL_CONFIRMATIONS?.trim().toLowerCase() !== "true") {
    return;
  }

  const overdueLabel =
    details.daysOverdue <= 0
      ? "New (issued today)"
      : `${details.daysOverdue} day${details.daysOverdue !== 1 ? "s" : ""} outstanding`;

  const message = [
    `✅ Reminder Email Sent`,
    `Business  : ${details.profileName}`,
    `Invoice   : #${details.invoiceNumber}`,
    `Customer  : ${details.customerName}`,
    `Amount    : ${details.amount}`,
    `Reminder  : ${details.reminderNumber} of ${details.maxReminders}`,
    `Overdue   : ${overdueLabel}`,
    `Email To  : ${details.recipientEmail}`,
  ].join("\n");

  const results = await Promise.allSettled(ownerPhones().map((phone) => sendText(phone, message)));
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[PaymentReminder] WhatsApp confirmation failed:", result.reason);
    }
  }
}

// ─── 2. Monthly financial report ──────────────────────────────────────────────
// Sent as a separate, on-demand or scheduled WhatsApp to all owner phones.
// One message per company profile — call this function once per profile.

export interface MonthlyReportData {
  profileName: string;
  monthLabel: string;          // e.g. "October 2026"
  totalReceived: number;       // sum of grandTotal for PAID invoices this month
  paidCount: number;
  pendingInvoices: {
    invoiceNumber: string;
    customerName: string;
    amount: number;
    daysOverdue: number;
    reminderCount: number;
  }[];
  totalPending: number;        // sum of grandTotal for all UNPAID ISSUED invoices
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function sendMonthlyFinancialReport(data: MonthlyReportData): Promise<void> {
  const lines: string[] = [
    `📊 Monthly Report — ${data.profileName}`,
    `🗓 ${data.monthLabel}`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `💰 Received This Month`,
    `   Total  : ${formatINR(data.totalReceived)}`,
    `   Paid   : ${data.paidCount} invoice${data.paidCount !== 1 ? "s" : ""}`,
    ``,
  ];

  if (data.pendingInvoices.length === 0) {
    lines.push(`✅ No pending invoices — all clear!`);
  } else {
    lines.push(`📋 Pending Invoices (${data.pendingInvoices.length})`);
    lines.push(`   Total Due : ${formatINR(data.totalPending)}`);
    lines.push(``);

    data.pendingInvoices.forEach((inv, i) => {
      const overdueLabel =
        inv.daysOverdue <= 0 ? "New" : `${inv.daysOverdue}d overdue`;
      lines.push(
        `${i + 1}. #${inv.invoiceNumber} — ${inv.customerName}`
      );
      lines.push(
        `   ${formatINR(inv.amount)}  |  ${overdueLabel}  |  ${inv.reminderCount} reminder${inv.reminderCount !== 1 ? "s" : ""} sent`
      );
    });
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_Pooja Xerox Invoice System_`);

  const message = lines.join("\n");

  const results = await Promise.allSettled(
    ownerPhones().map((phone) => sendText(phone, message))
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        `[MonthlyReport] WhatsApp failed (${data.profileName}):`,
        result.reason
      );
    }
  }
}
