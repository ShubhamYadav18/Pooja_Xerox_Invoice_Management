"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function PdfActions({ invoiceNumber }: { invoiceNumber: string }) {
  async function downloadPdf() {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const element = document.querySelector<HTMLElement>(".invoice-sheet");
    if (!element) return;

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
    pdf.save(`invoice-${invoiceNumber}.pdf`);
  }

  return (
    <div className="no-print mb-4 grid gap-2 sm:flex sm:justify-end">
      <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Print
      </Button>
      <Button type="button" className="w-full sm:w-auto" onClick={downloadPdf}>
        <Download className="h-4 w-4" />
        Download PDF
      </Button>
    </div>
  );
}
