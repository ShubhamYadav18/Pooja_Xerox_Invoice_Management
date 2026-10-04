import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMonthlyFinancialReport, MonthlyReportData } from "@/server/whatsapp-notifications";

const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";
const META_API_VERSION = "v19.0";

// ─── Auth guard ────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// ─── Meta WhatsApp sender ──────────────────────────────────────────────────
async function sendMetaMessage(to: string, body: string): Promise<{ to: string; ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_META_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return { to, ok: false, error: "Missing WHATSAPP_META_TOKEN or WHATSAPP_PHONE_NUMBER_ID" };

  try {
    const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } })
    });
    const json = await res.json() as { error?: { message: string } };
    if (!res.ok || json.error) return { to, ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    return { to, ok: true };
  } catch (err) {
    return { to, ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ─── Format phone ──────────────────────────────────────────────────────────
function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return null;
}

// ─── Groq helper ───────────────────────────────────────────────────────────
async function groqJson<T>(messages: { role: "system" | "user"; content: string }[]): Promise<T> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, response_format: { type: "json_object" }, messages, temperature: 0.2 })
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const content = ((await res.json()) as { choices: { message: { content: string } }[] }).choices?.[0]?.message?.content?.trim() || "{}";
  return JSON.parse(content) as T;
}

// ─── Main GET handler ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];
  const results = { ownerSent: 0, ownerFailed: 0, clientsSent: 0, clientsFailed: 0 };

  const phone1 = process.env.WHATSAPP_OWNER_PHONE;
  const phone2 = process.env.WHATSAPP_OWNER_PHONE_2;
  const ownerPhones = [
    phone1 && phone1 !== "91XXXXXXXXXX" ? phone1 : null,
    phone2 && phone2 !== "91XXXXXXXXXX" ? phone2 : null
  ].filter(Boolean) as string[];

  try {
    const profiles = await prisma.businessProfile.findMany();
    if (!profiles.length) return NextResponse.json({ error: "No business profiles found" }, { status: 500 });

    const today = new Date();
    const formatter = new Intl.DateTimeFormat("en-IN", {
      day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata"
    });

    for (const profile of profiles) {
      log.push(`\n--- Processing: ${profile.name} ---`);

      const unpaidInvoices = await prisma.invoice.findMany({
        where: { profileId: profile.id, paymentStatus: "UNPAID", status: "ISSUED" },
        include: { customer: { select: { id: true, companyName: true, contactPerson: true, mobile: true } } },
        orderBy: { invoiceDate: "asc" }
      });

      if (unpaidInvoices.length === 0) {
        log.push(`No unpaid invoices for ${profile.name} — skipping.`);
        continue;
      }

      const invoices = unpaidInvoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        date: formatter.format(new Date(inv.invoiceDate)),
        amount: Number(inv.grandTotal),
        customerId: inv.customer.id,
        customerName: inv.customer.companyName,
        contactPerson: inv.customer.contactPerson || "Accounts Team",
        mobile: inv.customer.mobile || "",
        daysOverdue: Math.max(0, Math.floor((today.getTime() - new Date(inv.invoiceDate).getTime()) / 86_400_000))
      }));

      // ── 1. Owner briefing ──────────────────────────────────────────────
      const { ownerBriefing } = await groqJson<{ ownerBriefing: string }>([
        {
          role: "system",
          content: `You are a professional financial controller for '${profile.name}'. Output valid JSON only.`
        },
        {
          role: "user",
          content: `Analyze unpaid invoices as of ${formatter.format(today)}:\n${JSON.stringify(invoices)}\n\nOutput JSON with key "ownerBriefing". Short private WhatsApp action queue for owner. Plain text only, no markdown, no asterisks. Emojis: 📌 ⚠️ 📅 ✅ only.\n\nInclude:\n1. Title + profile name + date.\n2. "Action Required": invoices >30 days overdue grouped by client with invoice number, amount, age.\n3. "Summary": total unpaid amount and count.\n4. "Next step": number of client reminder drafts prepared.`
        }
      ]);

      for (const phone of ownerPhones) {
        const r = await sendMetaMessage(phone, ownerBriefing);
        if (r.ok) { results.ownerSent++; log.push(`✅ [${profile.name}] Owner briefing → ${phone}`); }
        else { results.ownerFailed++; log.push(`❌ [${profile.name}] Owner briefing failed → ${phone}: ${r.error}`); }
      }

      // ── 2. Client reminders (>30 days overdue) → sent to owner ────────
      const groups = new Map<string, typeof invoices>();
      for (const inv of invoices.filter((i) => i.daysOverdue > 30)) {
        const group = groups.get(inv.customerId) ?? [];
        group.push(inv);
        groups.set(inv.customerId, group);
      }

      for (const [, clientInvoices] of groups) {
        const first = clientInvoices[0];
        const totalAmount = clientInvoices.reduce((s, i) => s + i.amount, 0);

        const { message } = await groqJson<{ message: string }>([
          { role: "system", content: "You draft warm, respectful client payment reminders for an Indian business. Output valid JSON only." },
          {
            role: "user",
            content: `Draft a very polite and warm WhatsApp payment reminder in Indian business English. Use this EXACT structure with blank lines between each section:\n\n1. Greeting line: Dear [Contact Person],\n2. Blank line\n3. Warm one-line opening sentence\n4. Blank line\n5. Line: "Kindly note the following pending invoice(s):"\n6. Each invoice on its own separate line: Invoice No. [X] dated [date] for Rs. [amount]\n7. Blank line\n8. Line: Total outstanding: Rs. [total]\n9. Blank line\n10. One polite sentence requesting payment at earliest convenience\n11. Blank line\n12. Regards,\n13. ${profile.name}\n\nRules: Plain text only. No markdown, no asterisks, no bullet symbols, no dashes. Do NOT offer to resend invoices. Do NOT ask if they need documents.\n\n${JSON.stringify({ customerName: first.customerName, contactPerson: first.contactPerson, invoices: clientInvoices.map(({ invoiceNumber, date, amount, daysOverdue }) => ({ invoiceNumber, date, amount, daysOverdue })), totalAmount })}\n\nOutput JSON with key "message".`
          }
        ]);

        const header = `For: ${first.customerName}${first.mobile ? ` | ${first.mobile}` : ""}\n\n`;
        for (const phone of ownerPhones) {
          const r = await sendMetaMessage(phone, header + message);
          if (r.ok) { results.clientsSent++; log.push(`✅ [${profile.name}] Client draft (${first.customerName}) → ${phone}`); }
          else { results.clientsFailed++; log.push(`❌ [${profile.name}] Client draft failed (${first.customerName}) → ${phone}: ${r.error}`); }
        }
      }
    }

    log.push(`\nAll done — Owner briefings: ${results.ownerSent}✅ ${results.ownerFailed}❌ | Client drafts: ${results.clientsSent}✅ ${results.clientsFailed}❌`);

    // ── Monthly financial report — one WhatsApp per profile ─────────────────
    // Shows money received this month and all pending invoices.
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const monthLabel = now.toLocaleDateString("en-IN", {
        month: "long", year: "numeric", timeZone: "Asia/Kolkata",
      });

      for (const profile of profiles) {
        const profileName = profile.name;

        const paidInvoices = await prisma.invoice.findMany({
          where: { profileId: profile.id, paymentStatus: "PAID", paidAt: { gte: monthStart, lte: monthEnd } },
          select: { grandTotal: true },
        });

        const pending = await prisma.invoice.findMany({
          where: { profileId: profile.id, paymentStatus: "UNPAID", status: "ISSUED" },
          include: { customer: { select: { companyName: true } } },
          orderBy: { invoiceDate: "asc" },
        });

        const pendingInvoices: MonthlyReportData["pendingInvoices"] = pending.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customer.companyName,
          amount: Number(inv.grandTotal),
          daysOverdue: Math.max(0, Math.floor((today.getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24))),
          reminderCount: inv.reminderCount,
        }));

        await sendMonthlyFinancialReport({
          profileName,
          monthLabel,
          totalReceived: paidInvoices.reduce((s, inv) => s + Number(inv.grandTotal), 0),
          paidCount: paidInvoices.length,
          pendingInvoices,
          totalPending: pendingInvoices.reduce((s, inv) => s + inv.amount, 0),
        });

        log.push(`✅ [${profileName}] Monthly financial report sent`);
      }
    } catch (reportErr) {
      const msg = reportErr instanceof Error ? reportErr.message : String(reportErr);
      log.push(`❌ Monthly financial report failed: ${msg}`);
    }

    return NextResponse.json({ success: true, results, log });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.push(`💥 Fatal: ${message}`);
    return NextResponse.json({ success: false, error: message, log }, { status: 500 });
  }
}
