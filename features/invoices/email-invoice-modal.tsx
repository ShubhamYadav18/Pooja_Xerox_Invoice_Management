"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, Mail, Send, X } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { sendInvoiceEmail } from "@/server/actions/send-invoice-email";

interface EmailInvoiceModalProps {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string | null;
  grandTotal: number;
  businessName?: string;
  businessEmail?: string;
}

export function EmailInvoiceModal({
  invoiceId,
  invoiceNumber,
  customerName,
  customerEmail,
  grandTotal,
  businessName = "Pooja Xerox",
  businessEmail
}: EmailInvoiceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [toEmail, setToEmail] = useState(customerEmail || "");
  const [ccEmail, setCcEmail] = useState("");
  const [subject, setSubject] = useState(
    `Invoice #${invoiceNumber} from ${businessName}`
  );
  const [message, setMessage] = useState(
    `Dear ${customerName},\n\nPlease find attached your tax invoice #${invoiceNumber} for ${formatCurrency(grandTotal)}.\n\nKindly acknowledge receipt and arrange for payment at your earliest convenience.\n\nThank you for your business!\n\nWarm regards,\n${businessName}`
  );
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleOpen() {
    setToEmail(customerEmail || "");
    setSubject(`Invoice #${invoiceNumber} from ${businessName}`);
    setMessage(
      `Dear ${customerName},\n\nPlease find attached your tax invoice #${invoiceNumber} for ${formatCurrency(grandTotal)}.\n\nKindly acknowledge receipt and arrange for payment at your earliest convenience.\n\nThank you for your business!\n\nWarm regards,\n${businessName}`
    );
    setStatus(null);
    setIsOpen(true);
  }

  async function handleSend() {
    if (!toEmail.trim()) {
      setStatus({ type: "error", text: "Please enter a recipient email address." });
      return;
    }

    setSending(true);
    setStatus(null);

    try {
      // 1. Locate the invoice sheet element on page
      const element = document.querySelector<HTMLElement>(".invoice-sheet");
      if (!element) {
        setStatus({
          type: "error",
          text: "Invoice preview not found in page. Please make sure the invoice is displayed."
        });
        setSending(false);
        return;
      }

      // 2. Generate PDF via html2canvas & jsPDF
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        windowWidth: Math.ceil(element.getBoundingClientRect().width),
        windowHeight: Math.ceil(element.getBoundingClientRect().height),
        scrollX: 0,
        scrollY: 0
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight, undefined, "FAST");

      const pdfDataUri = pdf.output("datauristring");
      const pdfBase64 = pdfDataUri.split(",")[1];

      // 3. Call server action to send email with attachment
      const res = await sendInvoiceEmail({
        invoiceId,
        to: toEmail.trim(),
        cc: ccEmail.trim() || undefined,
        subject: subject.trim(),
        message: message.trim(),
        pdfBase64,
        filename: `Invoice-${invoiceNumber}.pdf`
      });

      if (res.success) {
        setStatus({
          type: "success",
          text: res.message || "Invoice emailed successfully!"
        });
        // Auto-close modal after brief delay
        setTimeout(() => {
          setIsOpen(false);
          setStatus(null);
        }, 2200);
      } else {
        setStatus({
          type: "error",
          text: res.error || "Failed to send email."
        });
      }
    } catch (err: unknown) {
      const errObj = err as Error;
      setStatus({
        type: "error",
        text: errObj.message || "An unexpected error occurred while preparing or sending the invoice."
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={handleOpen}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border-blue-600/40 bg-blue-50 text-blue-800 hover:bg-blue-100"
      >
        <Mail className="h-4 w-4" />
        Send via Email
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-xl border bg-card p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Email Invoice #{invoiceNumber}</h2>
                  <p className="text-xs text-muted-foreground">
                    Sending from: <span className="font-medium text-foreground">{businessName}</span>
                    {businessEmail ? ` (${businessEmail})` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-4 space-y-4 overflow-y-auto pr-1">
              {/* Status Message */}
              {status && (
                <div
                  className={`flex items-start gap-2.5 rounded-lg p-3 text-xs leading-relaxed ${
                    status.type === "success"
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  }`}
                >
                  {status.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                  )}
                  <span>{status.text}</span>
                </div>
              )}

              {/* Recipient To */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground">
                    To (Client Email) <span className="text-destructive">*</span>
                  </label>
                  {customerEmail && customerEmail !== toEmail && (
                    <button
                      type="button"
                      onClick={() => setToEmail(customerEmail)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Use customer email: {customerEmail}
                    </button>
                  )}
                </div>
                <Input
                  type="email"
                  placeholder="accounts@clientcompany.com"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  disabled={sending}
                  required
                />
              </div>

              {/* CC */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  CC (Optional, comma-separated)
                </label>
                <Input
                  type="text"
                  placeholder="owner@poojaxerox.com, partner@gmail.com"
                  value={ccEmail}
                  onChange={(e) => setCcEmail(e.target.value)}
                  disabled={sending}
                />
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Subject Line <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sending}
                  required
                />
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Email Message Note
                </label>
                <Textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={sending}
                  className="font-sans text-xs"
                />
              </div>

              {/* Attachment chip */}
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-foreground">Attachment:</span>
                <span className="font-mono text-muted-foreground">Invoice-{invoiceNumber}.pdf</span>
                <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  Auto-Generated PDF
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-5 flex items-center justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsOpen(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSend}
                disabled={sending || !toEmail.trim()}
                className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending Email & PDF...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Invoice Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
