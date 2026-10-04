"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  FolderDown,
  Loader2,
  X
} from "lucide-react";
import { Button, Select } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceTemplate } from "@/features/invoices/invoice-template";
import {
  getAvailableInvoiceMonths,
  getInvoicesForMonth,
  type MonthOption
} from "@/server/actions/bulk-invoices";

export function BulkDownloadZipModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [includeCsv, setIncludeCsv] = useState(true);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; currentItem?: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Invoice currently being rendered offscreen into the DOM
  const [renderingInvoice, setRenderingInvoice] = useState<any | null>(null);
  const [renderSettings, setRenderSettings] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadMonths();
    }
  }, [isOpen]);

  async function loadMonths() {
    setLoadingMonths(true);
    setStatusMessage(null);
    try {
      const data = await getAvailableInvoiceMonths();
      setMonths(data);
      if (data.length > 0) {
        setSelectedMonth(data[0].key);
      }
    } catch {
      setStatusMessage({ type: "error", text: "Failed to load invoice months." });
    } finally {
      setLoadingMonths(false);
    }
  }

  const selectedMonthData = months.find((m) => m.key === selectedMonth);

  async function handleDownloadZip() {
    if (!selectedMonth) return;

    setIsGenerating(true);
    setStatusMessage(null);
    setProgress({ current: 0, total: 1, currentItem: "Fetching invoice records..." });

    try {
      const res = await getInvoicesForMonth(selectedMonth);
      if (!res.success || !res.invoices) {
        setStatusMessage({ type: "error", text: res.error || "Unable to fetch invoices." });
        setIsGenerating(false);
        return;
      }

      const invoices = res.invoices;
      const settings = res.settings;
      const profileName = res.profileName || "Pooja_Xerox";

      if (invoices.length === 0) {
        setStatusMessage({ type: "error", text: `No invoices found for ${selectedMonth}.` });
        setIsGenerating(false);
        return;
      }

      setRenderSettings(settings);

      // Lazy load html2canvas & jsPDF
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const zip = new JSZip();

      // Loop through each invoice, render offscreen, capture, and add to zip
      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        const customerName = inv.billToName || inv.customer?.companyName || "Customer";

        setProgress({
          current: i + 1,
          total: invoices.length,
          currentItem: `Rendering Invoice #${inv.invoiceNumber} (${customerName})`
        });

        // Set the active invoice to be mounted into our hidden DOM target
        setRenderingInvoice(inv);

        // Small delay to allow React to paint the DOM with styles & images
        await new Promise((r) => setTimeout(r, 60));

        const element = document.querySelector<HTMLElement>("#bulk-render-container .invoice-sheet");
        if (element) {
          const canvas = await html2canvas(element, {
            scale: 2, // 2x gives great clarity while keeping memory & speed optimal for batch zipping
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
          pdf.addImage(imgData, "PNG", 0, 0, 210, 297, undefined, "FAST");

          const pdfBlob = pdf.output("blob");
          const safeCust = customerName.replace(/[^a-zA-Z0-9_\- ]/g, "").trim().replace(/\s+/g, "_");
          const pdfFilename = `Invoice_${inv.invoiceNumber}_${safeCust}.pdf`;

          zip.file(pdfFilename, pdfBlob);
        }
      }

      // Clear offscreen render
      setRenderingInvoice(null);

      // Optionally include CSV summary for Accountant / CA
      if (includeCsv) {
        setProgress({
          current: invoices.length,
          total: invoices.length,
          currentItem: "Generating CA Summary Spreadsheet (CSV)..."
        });

        const headers = [
          "Invoice Number",
          "Invoice Date",
          "Customer Name",
          "GSTIN",
          "Billing Period",
          "Tax Mode",
          "Subtotal (Rs)",
          "CGST Rate",
          "CGST Amount (Rs)",
          "SGST Rate",
          "SGST Amount (Rs)",
          "IGST Rate",
          "IGST Amount (Rs)",
          "Grand Total (Rs)",
          "Payment Status"
        ];

        const rows = invoices.map((inv: any) => [
          `"${inv.invoiceNumber}"`,
          `"${formatDate(inv.invoiceDate)}"`,
          `"${(inv.billToName || inv.customer?.companyName || "").replace(/"/g, '""')}"`,
          `"${inv.billToGstin || inv.customer?.gstin || "-"}"`,
          `"${inv.billingMonth || selectedMonth}"`,
          `"${inv.taxMode || "CGST_SGST"}"`,
          Number(inv.subtotal || 0).toFixed(2),
          `"${inv.cgstRate || 0}%"`,
          Number(inv.cgstAmount || 0).toFixed(2),
          `"${inv.sgstRate || 0}%"`,
          Number(inv.sgstAmount || 0).toFixed(2),
          `"${inv.igstRate || 0}%"`,
          Number(inv.igstAmount || 0).toFixed(2),
          Number(inv.grandTotal || 0).toFixed(2),
          `"${inv.paymentStatus || "UNPAID"}"`
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\r\n");
        const safeMonth = selectedMonth.replace(/\s+/g, "_");
        zip.file(`Invoices_Summary_${safeMonth}.csv`, csvContent);
      }

      // Step 3: Compress into ZIP
      setProgress({
        current: invoices.length,
        total: invoices.length,
        currentItem: "Packaging into ZIP archive..."
      });

      const zipBlob = await zip.generateAsync({ type: "blob" }, (metadata) => {
        if (metadata.percent) {
          setProgress({
            current: invoices.length,
            total: invoices.length,
            currentItem: `Compressing ZIP (${Math.round(metadata.percent)}%)...`
          });
        }
      });

      // Step 4: Trigger native browser download
      const safeProfile = profileName.replace(/[^a-zA-Z0-9_\-]/g, "_");
      const safeMonth = selectedMonth.replace(/\s+/g, "_");
      const zipFilename = `${safeProfile}_Invoices_${safeMonth}.zip`;

      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setStatusMessage({
        type: "success",
        text: `Downloaded ${invoices.length} invoices in ${zipFilename} successfully!`
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Bulk ZIP error:", error);
      setStatusMessage({
        type: "error",
        text: error.message || "Failed to generate ZIP file."
      });
    } finally {
      setIsGenerating(false);
      setProgress(null);
      setRenderingInvoice(null);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 border-indigo-600/40 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
      >
        <FolderDown className="h-4 w-4" />
        Download Month ZIP
      </Button>

      {/* Hidden offscreen container for pixel-perfect PDF rendering */}
      <div
        id="bulk-render-container"
        style={{
          position: "fixed",
          left: "-9999px",
          top: "0",
          width: "210mm",
          zIndex: -1,
          opacity: 1,
          pointerEvents: "none"
        }}
        aria-hidden="true"
      >
        {renderingInvoice && renderSettings && (
          <InvoiceTemplate invoice={renderingInvoice} settings={renderSettings} />
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl border bg-card p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <Archive className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Download Monthly Invoices (ZIP)</h2>
                  <p className="text-xs text-muted-foreground">
                    Batch compile all invoices for a month into PDF and download as a single ZIP.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isGenerating && setIsOpen(false)}
                disabled={isGenerating}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-4 space-y-4">
              {/* Status Message */}
              {statusMessage && (
                <div
                  className={`flex items-start gap-2.5 rounded-lg p-3 text-xs leading-relaxed ${
                    statusMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  }`}
                >
                  {statusMessage.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Month Selection */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Select Month
                </label>
                {loadingMonths ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    Loading available invoice months...
                  </div>
                ) : (
                  <Select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    disabled={isGenerating || months.length === 0}
                  >
                    {months.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label} ({m.count} invoices — {formatCurrency(m.totalAmount)})
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              {/* Month Details Box */}
              {selectedMonthData && (
                <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Invoices in Batch</div>
                    <div className="text-base font-bold text-foreground">
                      {selectedMonthData.count} invoices
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Batch Total Amount</div>
                    <div className="text-base font-bold text-indigo-700">
                      {formatCurrency(selectedMonthData.totalAmount)}
                    </div>
                  </div>
                </div>
              )}

              {/* CSV Summary Checkbox */}
              <div className="rounded-lg border p-3 bg-card">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCsv}
                    onChange={(e) => setIncludeCsv(e.target.checked)}
                    disabled={isGenerating}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                      Include CA / GST Summary Spreadsheet (CSV)
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Includes an Excel/CSV file listing all invoice numbers, customer names, GSTINs, tax modes, and totals inside the ZIP.
                    </p>
                  </div>
                </label>
              </div>

              {/* Progress Bar (Visible during generation) */}
              {isGenerating && progress && (
                <div className="space-y-2 rounded-lg border bg-indigo-50/60 border-indigo-100 p-3.5">
                  <div className="flex items-center justify-between text-xs font-medium text-indigo-900">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                      {progress.currentItem || "Processing..."}
                    </span>
                    <span>
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                      style={{
                        width: `${Math.max(5, (progress.current / Math.max(1, progress.total)) * 100)}%`
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-indigo-700">
                    Please keep this window open while PDFs are being compiled and bundled.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsOpen(false)}
                disabled={isGenerating}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={handleDownloadZip}
                disabled={isGenerating || !selectedMonthData || selectedMonthData.count === 0}
                className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating ZIP...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download ZIP Archive
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
