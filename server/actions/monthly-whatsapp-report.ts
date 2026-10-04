"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/authz";
import { sendMonthlyFinancialReport, MonthlyReportData } from "@/server/whatsapp-notifications";

// ─── Monthly Financial Report ─────────────────────────────────────────────────
// Queries this month's paid invoices (money received) and all currently pending
// UNPAID + ISSUED invoices, then sends one WhatsApp report per company profile.
// Call this from a cron route or manually from the admin UI.

export async function sendMonthlyWhatsAppReport() {
  await requireAdmin();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const monthLabel = now.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  // Fetch all active profiles
  const profiles = await prisma.businessProfile.findMany({
    select: { id: true, code: true, name: true, settings: { select: { businessName: true } } },
  });

  const results: { profile: string; success: boolean; error?: string }[] = [];

  for (const profile of profiles) {
    try {
      const profileName =
        profile.settings?.businessName || profile.name || profile.code;

      // Money received this month (PAID invoices with paidAt in this month)
      const paidInvoices = await prisma.invoice.findMany({
        where: {
          profileId: profile.id,
          paymentStatus: "PAID",
          paidAt: { gte: monthStart, lte: monthEnd },
        },
        select: { grandTotal: true },
      });

      const totalReceived = paidInvoices.reduce(
        (sum, inv) => sum + Number(inv.grandTotal),
        0
      );

      // All pending invoices (UNPAID + ISSUED), oldest first
      const pending = await prisma.invoice.findMany({
        where: {
          profileId: profile.id,
          paymentStatus: "UNPAID",
          status: "ISSUED",
        },
        include: {
          customer: { select: { companyName: true } },
        },
        orderBy: { invoiceDate: "asc" },
      });

      const pendingInvoices: MonthlyReportData["pendingInvoices"] = pending.map(
        (inv) => ({
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customer.companyName,
          amount: Number(inv.grandTotal),
          daysOverdue: Math.max(
            0,
            Math.floor(
              (now.getTime() - new Date(inv.invoiceDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          ),
          reminderCount: inv.reminderCount,
        })
      );

      const totalPending = pendingInvoices.reduce(
        (sum, inv) => sum + inv.amount,
        0
      );

      await sendMonthlyFinancialReport({
        profileName,
        monthLabel,
        totalReceived,
        paidCount: paidInvoices.length,
        pendingInvoices,
        totalPending,
      });

      results.push({ profile: profileName, success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[MonthlyReport] Failed for profile ${profile.name}:`, msg);
      results.push({ profile: profile.name, success: false, error: msg });
    }
  }

  return results;
}
