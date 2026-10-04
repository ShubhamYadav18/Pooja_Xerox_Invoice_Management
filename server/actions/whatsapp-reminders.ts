"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/authz";
import { getActiveProfile } from "@/server/profile";

const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";
const DEFAULT_TEST_PHONE = "919324290047";
const META_API_VERSION = "v19.0";

export interface ClientReminderDraft {
  customerId: string;
  customerName: string;
  contactPerson: string;
  mobile: string;
  totalAmount: string;
  invoiceNumbers: string[];
  message: string;
}

export interface WhatsAppReminderResult {
  success: boolean;
  error?: string;
  ownerBriefing?: string;
  clientMessages?: ClientReminderDraft[];
  totalUnpaid?: number;
  totalCount?: number;
  targetPhone?: string;
}

const ownerBriefingSchema = z.object({ ownerBriefing: z.string().trim().min(1).max(6000) }).strict();
const clientMessageSchema = z.object({ message: z.string().trim().min(1).max(2500) }).strict();

function formatIndianPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  throw new Error("Enter a valid 10-digit Indian WhatsApp number");
}

async function generateGroqJson<T>(
  model: string,
  apiKey: string,
  messages: { role: "system" | "user"; content: string }[],
  schema: z.ZodType<T>
): Promise<T> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "PoojaXerox/1.0"
    },
    body: JSON.stringify({ model, response_format: { type: "json_object" }, messages, temperature: 0.2 })
  });

  if (!response.ok) {
    throw new Error(`Groq API error (${response.status}): ${await response.text()}`);
  }

  const content = (await response.json()).choices?.[0]?.message?.content?.trim() || "{}";
  try {
    return schema.parse(JSON.parse(content));
  } catch (error) {
    if (error instanceof z.ZodError) throw new Error("Groq returned an invalid message structure");
    throw new Error("Groq returned invalid JSON");
  }
}

export async function generatePendingPaymentBriefing(targetPhone?: string): Promise<WhatsAppReminderResult> {
  try {
    await requireAdmin();
    const profile = await getActiveProfile();
  const formattedPhone = formatIndianPhone(targetPhone || (process.env.WHATSAPP_OWNER_PHONE || DEFAULT_TEST_PHONE));
    const unpaidInvoices = await prisma.invoice.findMany({
      where: { profileId: profile.id, paymentStatus: "UNPAID", status: "ISSUED" },
      include: { customer: { select: { id: true, companyName: true, contactPerson: true, mobile: true } } },
      orderBy: { invoiceDate: "asc" }
    });

    if (unpaidInvoices.length === 0) {
      return {
        success: true,
        ownerBriefing: "All payments are up to date. There are currently no unpaid issued invoices.",
        clientMessages: [],
        totalUnpaid: 0,
        totalCount: 0,
        targetPhone: formattedPhone
      };
    }

    const today = new Date();
    const formatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
    const invoices = unpaidInvoices.map((invoice) => {
      const amount = Number(invoice.grandTotal);
      return {
        invoiceNumber: invoice.invoiceNumber,
        date: formatter.format(new Date(invoice.invoiceDate)),
        amount,
        customerId: invoice.customer.id,
        customerName: invoice.customer.companyName,
        contactPerson: invoice.customer.contactPerson || "Accounts Team",
        mobile: invoice.customer.mobile || "",
        daysOverdue: Math.max(0, Math.floor((today.getTime() - new Date(invoice.invoiceDate).getTime()) / 86_400_000))
      };
    });
    const totalUnpaid = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set in environment variables");
    const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

    const { ownerBriefing } = await generateGroqJson(
      model,
      apiKey,
      [
        { role: "system", content: `You are a professional financial controller for '${profile.name}'. You MUST output valid JSON only.` },
        {
          role: "user",
          content: `Analyze these unpaid issued invoices as of ${formatter.format(today)}:\n${JSON.stringify(invoices)}\n\nOutput a JSON object with EXACTLY one key, "ownerBriefing". It is a short, private WhatsApp ACTION QUEUE for the business owner only. Use plain text and clean spacing. Never use asterisks, underscores, backticks, Markdown, or decorative symbols. You may use only restrained professional emojis such as 📌, ⚠️, 📅, and ✅ where they improve scanning.

Include only:
1. A title and date.
2. "Action Required": only invoices that are more than 30 days overdue, grouped by client, with invoice number, amount, and age in days. If there are none, say "No invoices are over 30 days overdue."
3. A one-line "Summary": total unpaid amount and total count of unpaid issued invoices.
4. A one-line "Next step": state how many client reminder drafts were prepared for invoices more than 30 days overdue.

Do NOT include top owing clients, rankings, recent/current invoice lists, individual invoices that are 30 days old or newer, or any unnecessary financial analysis. Do not include client reminder drafts.`
        }
      ],
      ownerBriefingSchema
    );

    const groups = new Map<string, typeof invoices>();
    for (const invoice of invoices.filter((item) => item.daysOverdue > 30)) {
      const group = groups.get(invoice.customerId) ?? [];
      group.push(invoice);
      groups.set(invoice.customerId, group);
    }

    const clientMessages: ClientReminderDraft[] = [];
    for (const [customerId, clientInvoices] of groups) {
      const first = clientInvoices[0];
      const totalAmount = clientInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
      const { message } = await generateGroqJson(
        model,
        apiKey,
        [
          { role: "system", content: "You draft warm, respectful client payment reminders for an Indian business. Output valid JSON only." },
          {
            role: "user",
            content: `Draft a very polite and warm WhatsApp payment reminder in Indian business English. Use this EXACT structure with blank lines between each section:\n\n1. Greeting line: Dear [Contact Person],\n2. Blank line\n3. Warm one-line opening sentence\n4. Blank line\n5. Line: "Kindly note the following pending invoice(s):"\n6. Each invoice on its own separate line: Invoice No. [X] dated [date] for Rs. [amount]\n7. Blank line\n8. Line: Total outstanding: Rs. [total]\n9. Blank line\n10. One polite sentence requesting payment at earliest convenience\n11. Blank line\n12. Regards,\n13. ${profile.name}\n\nRules: Plain text only. No markdown, no asterisks, no bullet symbols, no dashes. Do NOT offer to resend invoices. Do NOT ask if they need documents.\n\n${JSON.stringify({ customerName: first.customerName, contactPerson: first.contactPerson, invoices: clientInvoices.map(({ invoiceNumber, date, amount, daysOverdue }) => ({ invoiceNumber, date, amount, daysOverdue })), totalAmount })}\n\nOutput a JSON object with EXACTLY one key, "message".`
          }
        ],
        clientMessageSchema
      );

      clientMessages.push({
        customerId,
        customerName: first.customerName,
        contactPerson: first.contactPerson,
        mobile: first.mobile,
        totalAmount: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(totalAmount),
        invoiceNumbers: clientInvoices.map((invoice) => invoice.invoiceNumber),
        message
      });
    }

    return {
      success: true,
      ownerBriefing,
      clientMessages,
      totalUnpaid,
      totalCount: unpaidInvoices.length,
      targetPhone: formattedPhone
    };
  } catch (error) {
    console.error("Error generating WhatsApp briefing:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to generate briefing" };
  }
}

async function sendMetaWhatsAppMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  message: string
): Promise<{ to: string; success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message }
        })
      }
    );
    const json = await response.json() as { messages?: { id: string }[]; error?: { message: string } };
    if (!response.ok || json.error) {
      return { to, success: false, error: json.error?.message ?? `HTTP ${response.status}` };
    }
    return { to, success: true };
  } catch (error) {
    return { to, success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

export async function sendWhatsAppMessageViaBot(
  phone: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requireAdmin();

    const token = process.env.WHATSAPP_META_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token) return { success: false, message: "WHATSAPP_META_TOKEN is not set in environment variables." };
    if (!phoneNumberId) return { success: false, message: "WHATSAPP_PHONE_NUMBER_ID is not set in environment variables." };
    if (!message.trim()) throw new Error("A WhatsApp message is required");

    const formattedCaller = formatIndianPhone(phone);
    const directResult = await sendMetaWhatsAppMessage(phoneNumberId, token, formattedCaller, message);
    return directResult.success
      ? { success: true, message: `Sent to: ${directResult.to}` }
      : { success: false, message: `Failed to send to ${directResult.to}: ${directResult.error}` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to send via Meta WhatsApp API" };
  }
}
