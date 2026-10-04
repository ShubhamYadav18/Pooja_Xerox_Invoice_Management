"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/authz";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getProfileSmtpConfig, createTransporterForProfile } from "@/server/email-config";

const sendEmailSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  to: z.string().email("Please enter a valid recipient email address"),
  cc: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const emails = val.split(",").map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) return true;
    return emails.every((e) => z.string().email().safeParse(e).success);
  }, "Please enter valid comma-separated CC email addresses"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().optional(),
  pdfBase64: z.string().min(1, "PDF content is missing"),
  filename: z.string().optional()
});

export type SendInvoiceEmailInput = z.infer<typeof sendEmailSchema>;

export interface SendInvoiceEmailResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<SendInvoiceEmailResult> {
  await requireAdmin();

  const validated = sendEmailSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || "Invalid input data"
    };
  }

  const { invoiceId, to, cc, subject, message, pdfBase64, filename } = validated.data;

  // Fetch invoice details for email body and profile-scoped credentials
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      profile: {
        include: {
          settings: true
        }
      }
    }
  });

  if (!invoice) {
    return { success: false, error: "Invoice not found" };
  }

  // Determine SMTP config based on profile (Pooja Xerox vs Pooja Enterprises)
  const smtpConfig = getProfileSmtpConfig(invoice.profile);
  if (!smtpConfig.configured) {
    return {
      success: false,
      error: `SMTP credentials for ${smtpConfig.profileName} are not configured yet in .env (${smtpConfig.missingEnvVar}). Please add them to your environment variables.`
    };
  }

  const settings = invoice.profile?.settings;
  const businessName = settings?.businessName || invoice.profile?.name || smtpConfig.profileName;
  const fromAddress = smtpConfig.from;
  const formattedAmount = formatCurrency(String(invoice.grandTotal));
  const formattedDate = formatDate(invoice.invoiceDate);
  const pdfFilename = filename || `Invoice-${invoice.invoiceNumber}.pdf`;

  // Create profile-specific transporter
  const transporter = createTransporterForProfile(smtpConfig);

  // Prepare custom message paragraphs
  const customMessageHtml = message
    ? message
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p style="margin: 0 0 12px; color: #374151; line-height: 1.6;">${p}</p>`)
        .join("")
    : `<p style="margin: 0 0 12px; color: #374151; line-height: 1.6;">Please find attached invoice <strong>#${invoice.invoiceNumber}</strong> for your recent order.</p>`;

  // Bank details block if configured
  const bankDetailsHtml = settings?.bankName && settings?.bankAccountNo
    ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <h4 style="margin: 0 0 8px; color: #1e293b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Bank Payment Details</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
          <tr>
            <td style="padding: 4px 0; font-weight: 600; width: 140px;">Bank Name:</td>
            <td style="padding: 4px 0;">${settings.bankName}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: 600;">Account Number:</td>
            <td style="padding: 4px 0; font-family: monospace; font-size: 14px; color: #0f172a;">${settings.bankAccountNo}</td>
          </tr>
          ${settings.bankIfsc ? `<tr><td style="padding: 4px 0; font-weight: 600;">IFSC Code:</td><td style="padding: 4px 0; font-family: monospace;">${settings.bankIfsc}</td></tr>` : ""}
          ${settings.bankBranch ? `<tr><td style="padding: 4px 0; font-weight: 600;">Branch:</td><td style="padding: 4px 0;">${settings.bankBranch}</td></tr>` : ""}
        </table>
      </div>
    `
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
              <!-- Header banner -->
              <tr>
                <td style="background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 28px 32px; text-align: left;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">${businessName}</h1>
                  ${settings?.businessAddress ? `<p style="margin: 6px 0 0; color: #bfdbfe; font-size: 12px; line-height: 1.4;">${settings.businessAddress}</p>` : ""}
                  ${settings?.gstNumber ? `<p style="margin: 4px 0 0; color: #93c5fd; font-size: 12px; font-weight: 500;">GSTIN: ${settings.gstNumber}</p>` : ""}
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding: 32px;">
                  <div style="font-size: 14px; color: #374151;">
                    ${customMessageHtml}
                  </div>

                  <!-- Invoice Summary Box -->
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin: 24px 0; overflow: hidden;">
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
                          ${invoice.billingMonth ? `
                          <tr>
                            <td style="font-size: 13px; color: #6b7280; padding-bottom: 6px;">Billing Period</td>
                            <td align="right" style="font-size: 13px; color: #111827; padding-bottom: 6px;">${invoice.billingMonth}</td>
                          </tr>` : ""}
                          <tr style="border-top: 1px dashed #d1d5db;">
                            <td style="font-size: 15px; font-weight: 700; color: #111827; padding-top: 10px;">Total Amount</td>
                            <td align="right" style="font-size: 18px; font-weight: 800; color: #2563eb; padding-top: 10px;">${formattedAmount}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Bank Details -->
                  ${bankDetailsHtml}

                  <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
                    <p style="margin: 0; font-size: 13px; color: #1e40af;">
                      📎 The official PDF invoice has been attached to this email for your accounting records.
                    </p>
                  </div>

                  <p style="margin: 24px 0 0; font-size: 14px; color: #4b5563; line-height: 1.5;">
                    If you have any questions regarding this invoice, please feel free to reach out to us.
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
                    This is an automated invoice transmission generated by ${businessName} Invoice Management System.
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

  // Prepare clean buffer from base64
  const base64Data = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
  const pdfBuffer = Buffer.from(base64Data, "base64");

  try {
    await transporter.sendMail({
      from: fromAddress,
      to,
      cc: cc && cc.trim() ? cc.split(",").map((e) => e.trim()).filter(Boolean) : undefined,
      subject,
      text: `${message || `Please find attached invoice #${invoice.invoiceNumber}`}\n\nInvoice: #${invoice.invoiceNumber}\nAmount: ${formattedAmount}\nDate: ${formattedDate}\n\nBest regards,\n${businessName}`,
      html: htmlContent,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    });

    return {
      success: true,
      message: `Invoice #${invoice.invoiceNumber} was successfully emailed to ${to}${cc ? ` (CC: ${cc})` : ""}!`
    };
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    console.error("Error sending invoice email:", error);

    let userFriendlyError = error.message || "Failed to send email.";
    if (error.code === "EAUTH") {
      userFriendlyError =
        "Email Authentication Failed: Invalid Gmail username or App Password. If using Gmail, make sure 2-Step Verification is ON and use a 16-character App Password (not your normal Gmail password).";
    } else if (error.code === "ECONNECTION" || error.code === "ETIMEDOUT") {
      userFriendlyError = `Could not connect to SMTP server (${smtpConfig.host}:${smtpConfig.port}). Please check your network and SMTP settings.`;
    }

    return {
      success: false,
      error: userFriendlyError
    };
  }
}
