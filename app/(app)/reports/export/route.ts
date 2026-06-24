import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/server/authz";
import { getActiveProfileId } from "@/server/profile";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");
  const format = params.get("format") ?? "csv";
  const profileId = await getActiveProfileId();
  const invoices = await prisma.invoice.findMany({
    where: {
      profileId,
      ...(from || to
        ? {
            invoiceDate: {
              gte: from ? new Date(from) : undefined,
              lte: to ? new Date(`${to}T23:59:59`) : undefined
            }
          }
        : {})
    },
    include: { customer: true },
    orderBy: { invoiceDate: "asc" }
  });
  const header = ["Invoice Number", "Date", "Customer", "Taxable", "CGST", "SGST", "Total GST", "Grand Total"];
  const rows = invoices.map((invoice) => [
    invoice.invoiceNumber,
    invoice.invoiceDate.toISOString().slice(0, 10),
    invoice.customer.companyName,
    invoice.subtotal,
    invoice.cgstAmount,
    invoice.sgstAmount,
    invoice.taxAmount,
    invoice.grandTotal
  ]);

  if (format === "xls") {
    const html = `<!doctype html><html><body><table><thead><tr>${header
      .map((cell) => `<th>${escapeHtml(cell)}</th>`)
      .join("")}</tr></thead><tbody>${rows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`)
      .join("")}</tbody></table></body></html>`;

    return new NextResponse(html, {
      headers: {
        "content-type": "application/vnd.ms-excel; charset=utf-8",
        "content-disposition": "attachment; filename=invoice-report.xls"
      }
    });
  }

  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=invoice-report.csv"
    }
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
