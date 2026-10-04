"use server";

import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getProfileSmtpConfig, createTransporterForProfile, ProfileSmtpConfig } from "@/server/email-config";
import { requireAdmin } from "@/server/authz";
import { notifyOwnersOfReminderEmail } from "@/server/whatsapp-notifications";

// ─── Configuration ────────────────────────────────────────────────────────────
const REMINDER_COOLDOWN_DAYS = 7;   // Min days between reminders for same invoice
const MAX_REMINDERS = 3;            // Stop after this many reminders per invoice
const MIN_OVERDUE_DAYS = 0;         // Send first reminder as soon as invoice is ISSUED

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ReminderResult {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  recipientEmail: string;
  reminderCount: number;
  daysOverdue: number;
  success: boolean;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

export interface CronRunSummary {
  processedAt: string;
  totalUnpaid: number;
  eligible: number;
  sent: number;
  skipped: number;
  failed: number;
  results: ReminderResult[];
}

export async function runPaymentRemindersManually() {
  await requireAdmin();
  return runPaymentReminderCron();
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────
export async function runPaymentReminderCron(opts: {
  testEmail?: string;
  testReminderNumber?: number;
  profileCode?: string;
} = {}): Promise<CronRunSummary> {
  const { testEmail, testReminderNumber, profileCode } = opts;
  const now = new Date();
  const summary: CronRunSummary = {
    processedAt: now.toISOString(),
    totalUnpaid: 0,
    eligible: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    results: [],
  };


  // Fetch all UNPAID + ISSUED invoices (optionally filtered by profile)
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      paymentStatus: "UNPAID",
      status: "ISSUED",
      ...(profileCode ? { profile: { code: profileCode } } : {}),
    },
    include: {
      customer: true,
      profile: {
        include: { settings: true },
      },
    },
    orderBy: { invoiceDate: "asc" },
  });

  summary.totalUnpaid = unpaidInvoices.length;

  for (const invoice of unpaidInvoices) {
    const customerEmail = testEmail ?? invoice.customer.email?.trim();
    const invoiceDate = new Date(invoice.invoiceDate);
    const daysOverdue = Math.floor(
      (now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const resultBase: Omit<ReminderResult, "success"> = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer.companyName,
      recipientEmail: customerEmail || "(no email)",
      reminderCount: invoice.reminderCount + 1,
      daysOverdue,
    };

    // ── Check: Profile SMTP Configuration ───────────────────────────────────
    const smtpConfig = getProfileSmtpConfig(invoice.profile);
    if (!smtpConfig.configured) {
      summary.skipped++;
      summary.results.push({
        ...resultBase,
        success: false,
        skipped: true,
        skipReason: `SMTP credentials for ${smtpConfig.profileName} not configured in .env (${smtpConfig.missingEnvVar})`,
      });
      continue;
    }

    // ── Skip: No email address ──────────────────────────────────────────────
    if (!customerEmail) {
      summary.skipped++;
      summary.results.push({
        ...resultBase,
        success: false,
        skipped: true,
        skipReason: "No customer email on file",
      });
      continue;
    }

    // ── In test mode: skip all business rule checks ─────────────────────────
    if (!testEmail) {
      // ── Skip: Automated reminders toggled off by user in Settings ─────────
      if (invoice.profile?.settings?.reminderEmailsEnabled === false) {
        summary.skipped++;
        summary.results.push({
          ...resultBase,
          success: false,
          skipped: true,
          skipReason: `Automated reminder emails turned OFF in Settings for ${invoice.profile?.name ?? "profile"}`,
        });
        continue;
      }

      // ── Skip: Max reminders reached ───────────────────────────────────────
      if (invoice.reminderCount >= MAX_REMINDERS) {
        summary.skipped++;
        summary.results.push({
          ...resultBase,
          success: false,
          skipped: true,
          skipReason: `Max reminders (${MAX_REMINDERS}) already sent`,
        });
        continue;
      }

      // ── Skip: Cooldown not elapsed ────────────────────────────────────────
      if (invoice.lastReminderSentAt) {
        const daysSinceLast = Math.floor(
          (now.getTime() - new Date(invoice.lastReminderSentAt).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (daysSinceLast < REMINDER_COOLDOWN_DAYS) {
          summary.skipped++;
          summary.results.push({
            ...resultBase,
            success: false,
            skipped: true,
            skipReason: `Cooldown active — last reminder sent ${daysSinceLast}d ago (need ${REMINDER_COOLDOWN_DAYS}d)`,
          });
          continue;
        }
      } else if (daysOverdue < MIN_OVERDUE_DAYS) {
        summary.skipped++;
        summary.results.push({
          ...resultBase,
          success: false,
          skipped: true,
          skipReason: `Invoice only ${daysOverdue}d old — first reminder after ${MIN_OVERDUE_DAYS}d`,
        });
        continue;
      }
    }

    // ── Eligible: Send reminder ─────────────────────────────────────────────
    summary.eligible++;
    const reminderNumber = testReminderNumber ?? (invoice.reminderCount + 1);
    const sendResult = await sendReminderEmail({
      invoice,
      reminderNumber,
      daysOverdue,
      overrideEmail: testEmail,
      smtpConfig,
    });

    if (sendResult.success) {
      // Only update DB counters in production mode (not test mode)
      if (!testEmail) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            lastReminderSentAt: now,
            reminderCount: { increment: 1 },
          },
        });
      }
      summary.sent++;
      summary.results.push({ ...resultBase, success: true });
      // Send owner confirmation (test-email runs excluded).
      if (!testEmail) {
        await notifyOwnersOfReminderEmail({
          profileName: smtpConfig.profileName,
          customerName: invoice.customer.companyName,
          invoiceNumber: invoice.invoiceNumber,
          recipientEmail: customerEmail,
          amount: formatCurrency(String(invoice.grandTotal)),
          reminderNumber,
          maxReminders: MAX_REMINDERS,
          daysOverdue,
        });
      }
    } else {
      summary.failed++;
      summary.results.push({
        ...resultBase,
        success: false,
        error: sendResult.error,
      });
    }
  }

  return summary;
}

// ─── Email Sending ────────────────────────────────────────────────────────────
interface SendReminderEmailOptions {
  invoice: Awaited<ReturnType<typeof prisma.invoice.findMany>>[number] & {
    customer: { companyName: string; email?: string | null };
    profile: {
      code: string;
      name: string;
      settings?: {
        businessName?: string | null;
        businessAddress?: string | null;
        gstNumber?: string | null;
        contactNumber?: string | null;
        email?: string | null;
        bankName?: string | null;
        bankAccountNo?: string | null;
        bankIfsc?: string | null;
        bankBranch?: string | null;
      } | null;
    } | null;
  };
  reminderNumber: number;
  daysOverdue: number;
  overrideEmail?: string;
  smtpConfig: ProfileSmtpConfig;
}

async function sendReminderEmail({
  invoice,
  reminderNumber,
  daysOverdue,
  overrideEmail,
  smtpConfig,
}: SendReminderEmailOptions): Promise<{ success: boolean; error?: string }> {
  const settings = invoice.profile?.settings;
  const businessName = settings?.businessName || invoice.profile?.name || smtpConfig.profileName;
  const fromAddress = smtpConfig.from;
  const recipientEmail = overrideEmail?.trim() || invoice.customer.email?.trim() || "";
  const formattedAmount = formatCurrency(String(invoice.grandTotal));
  const formattedDate = formatDate(invoice.invoiceDate);

  // Subject changes with escalation (all polite and respectful)
  const urgencyLabel =
    reminderNumber === 1
      ? "Friendly Reminder"
      : reminderNumber === 2
      ? "2nd Reminder — Payment Pending"
      : "3rd Reminder — Payment Pending";

  const subject = `[${urgencyLabel}] Invoice #${invoice.invoiceNumber} — ₹${formattedAmount} Due`;

  // Urgency styling:
  // Reminder 1: Friendly blue
  // Reminder 2 & 3: Courteous warm amber (no aggressive/mandating red alerts)
  const urgencyColor =
    reminderNumber === 1 ? "#2563eb" : "#d97706";
  const urgencyBg =
    reminderNumber === 1 ? "#eff6ff" : "#fffbeb";
  const urgencyBorder =
    reminderNumber === 1 ? "#bfdbfe" : "#fde68a";
  const urgencyIcon =
    reminderNumber === 1 ? "🔔" : reminderNumber === 2 ? "⚠️" : "📝";

  const overdueLine =
    daysOverdue <= 0
      ? "This invoice was issued today and is currently pending payment."
      : `This invoice has been outstanding for <strong>${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}</strong>.`;

  // Polite messaging across all reminders — non-mandating and courteous
  const urgencyMessage =
    reminderNumber === 1
      ? `We wanted to send a gentle reminder that Invoice <strong>#${invoice.invoiceNumber}</strong> is pending payment. ${overdueLine}`
      : reminderNumber === 2
      ? `This is a follow-up reminder. ${overdueLine} Kindly process the payment at your earliest convenience to avoid any disruption.`
      : `This is a follow-up reminder regarding Invoice <strong>#${invoice.invoiceNumber}</strong>. ${overdueLine} We would appreciate it if you could kindly check and arrange for the payment at your convenience.`;

  const bankDetailsHtml =
    settings?.bankName && settings?.bankAccountNo
      ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <h4 style="margin: 0 0 8px; color: #1e293b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Bank Payment Details</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
          <tr><td style="padding: 4px 0; font-weight: 600; width: 140px;">Bank Name:</td><td style="padding: 4px 0;">${settings.bankName}</td></tr>
          <tr><td style="padding: 4px 0; font-weight: 600;">Account Number:</td><td style="padding: 4px 0; font-family: monospace; font-size: 14px; color: #0f172a;">${settings.bankAccountNo}</td></tr>
          ${settings.bankIfsc ? `<tr><td style="padding: 4px 0; font-weight: 600;">IFSC Code:</td><td style="padding: 4px 0; font-family: monospace;">${settings.bankIfsc}</td></tr>` : ""}
          ${settings.bankBranch ? `<tr><td style="padding: 4px 0; font-weight: 600;">Branch:</td><td style="padding: 4px 0;">${settings.bankBranch}</td></tr>` : ""}
        </table>
      </div>`
      : "";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f9; padding: 30px 10px;">
        <tr>
          <td align="center">
            <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 28px 32px; text-align: left;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">${businessName}</h1>
                  ${settings?.businessAddress ? `<p style="margin: 6px 0 0; color: #bfdbfe; font-size: 12px; line-height: 1.4;">${settings.businessAddress}</p>` : ""}
                  ${settings?.gstNumber ? `<p style="margin: 4px 0 0; color: #93c5fd; font-size: 12px; font-weight: 500;">GSTIN: ${settings.gstNumber}</p>` : ""}
                </td>
              </tr>

              <!-- Reminder Badge -->
              <tr>
                <td style="padding: 0 32px; padding-top: 24px;">
                  <div style="display: inline-block; background-color: ${urgencyBg}; border: 1px solid ${urgencyBorder}; border-radius: 6px; padding: 8px 14px;">
                    <span style="color: ${urgencyColor}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${urgencyIcon} Payment Reminder ${reminderNumber} of ${MAX_REMINDERS}
                    </span>
                  </div>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding: 20px 32px 32px;">
                  <p style="font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 12px;">
                    Dear <strong>${invoice.customer.companyName}</strong>,
                  </p>
                  <p style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0 0 20px;">
                    ${urgencyMessage}
                  </p>

                  <!-- Invoice Summary -->
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin: 0 0 24px; overflow: hidden;">
                    <tr>
                      <td style="padding: 18px 20px;">
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="font-size: 13px; color: #6b7280; padding-bottom: 6px;">Invoice Number</td>
                            <td align="right" style="font-size: 14px; font-weight: 700; color: #111827; padding-bottom: 6px;">${invoice.invoiceNumber}</td>
                          </tr>
                          <tr>
                            <td style="font-size: 13px; color: #6b7280; padding-bottom: 6px;">Invoice Date</td>
                            <td align="right" style="font-size: 13px; color: #111827; padding-bottom: 6px;">${formattedDate}</td>
                          </tr>
                          ${invoice.billingMonth ? `<tr><td style="font-size: 13px; color: #6b7280; padding-bottom: 6px;">Billing Period</td><td align="right" style="font-size: 13px; color: #111827; padding-bottom: 6px;">${invoice.billingMonth}</td></tr>` : ""}
                          <tr>
                            <td style="font-size: 13px; color: #6b7280; padding-bottom: 6px;">Days Outstanding</td>
                            <td align="right" style="font-size: 13px; color: ${urgencyColor}; font-weight: 700; padding-bottom: 6px;">${daysOverdue > 0 ? `${daysOverdue} days` : "New"}</td>
                          </tr>
                          <tr style="border-top: 1px dashed #d1d5db;">
                            <td style="font-size: 15px; font-weight: 700; color: #111827; padding-top: 10px;">Amount Due</td>
                            <td align="right" style="font-size: 20px; font-weight: 800; color: ${urgencyColor}; padding-top: 10px;">${formattedAmount}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Bank Details -->
                  ${bankDetailsHtml}

                  <p style="margin: 20px 0 0; font-size: 14px; color: #4b5563; line-height: 1.5;">
                    If you have already made the payment, please disregard this message and share the transaction details with us for reconciliation.
                    If you have any questions or concerns, please do not hesitate to contact us.
                  </p>

                  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f3f4f6; font-size: 13px; color: #4b5563;">
                    <p style="margin: 0; font-weight: 600; color: #111827;">Warm regards,</p>
                    <p style="margin: 4px 0 0; font-size: 14px; font-weight: 700; color: #2563eb;">${businessName}</p>
                    ${settings?.contactNumber ? `<p style="margin: 2px 0 0; color: #6b7280;">Contact: ${settings.contactNumber}</p>` : ""}
                    ${settings?.email ? `<p style="margin: 2px 0 0; color: #6b7280;">Email: ${settings.email}</p>` : ""}
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                    This is an automated payment reminder from ${businessName} Invoice Management System.
                    You are receiving this because you have a pending invoice with us.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const transporter = createTransporterForProfile(smtpConfig);

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject,
      text: `Payment Reminder ${reminderNumber} of ${MAX_REMINDERS}\n\nDear ${invoice.customer.companyName},\n\nThis is a reminder that Invoice #${invoice.invoiceNumber} for ${formattedAmount} (dated ${formattedDate}) is still pending payment${daysOverdue > 0 ? ` (${daysOverdue} days outstanding)` : ""}.\n\nPlease arrange the payment at your earliest convenience.\n\nIf you have already paid, please disregard this message.\n\nWarm regards,\n${businessName}`,
      html: htmlContent,
    });
    return { success: true };
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error(`[PaymentReminder] Failed for invoice ${invoice.invoiceNumber} (${smtpConfig.profileName}):`, error.message);
    return { success: false, error: error.message || "Unknown SMTP error" };
  }
}
