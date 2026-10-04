import { endOfMonth, startOfMonth } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/server/authz";
import { getActiveProfileId } from "@/server/profile";

function monthFrom(value: string | null) {
  return /^\d{4}-\d{2}$/.test(value ?? "") ? value! : new Date().toISOString().slice(0, 7);
}
function amount(value: unknown) { return Number(value ?? 0); }
function date(value: Date) { return value.toISOString().slice(0, 10); }

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) return new NextResponse("Unauthorized", { status: 401 });
  const month = monthFrom(request.nextUrl.searchParams.get("month"));
  const dateValue = new Date(`${month}-01T00:00:00`);
  const range = { gte: startOfMonth(dateValue), lte: endOfMonth(dateValue) };
  const profileId = await getActiveProfileId();
  const [invoices, purchases] = await Promise.all([
    prisma.invoice.findMany({ where: { profileId, status: { not: "CANCELLED" }, invoiceDate: range }, include: { customer: true }, orderBy: { invoiceDate: "asc" } }),
    prisma.purchase.findMany({ where: { profileId, billDate: range }, orderBy: { billDate: "asc" } })
  ]);
  const salesRows = invoices.map((invoice) => [invoice.invoiceNumber, date(invoice.invoiceDate), invoice.billToName || invoice.customer.companyName, invoice.billToGstin || invoice.customer.gstin || "", invoice.billToState || invoice.customer.state, amount(invoice.subtotal), amount(invoice.igstAmount), amount(invoice.cgstAmount), amount(invoice.sgstAmount), amount(invoice.grandTotal)]);
  const purchaseRows = purchases.map((purchase) => [purchase.billNumber, date(purchase.billDate), purchase.supplierName, purchase.supplierGstin || "", purchase.stateOfSupply, amount(purchase.taxableAmount), amount(purchase.igstAmount), amount(purchase.cgstAmount), amount(purchase.sgstAmount), amount(purchase.totalAmount)]);
  const totals = (rows: Array<Array<string | number>>) => rows.reduce((result, row) => ({ taxable: result.taxable + Number(row[5]), igst: result.igst + Number(row[6]), cgst: result.cgst + Number(row[7]), sgst: result.sgst + Number(row[8]), total: result.total + Number(row[9]) }), { taxable: 0, igst: 0, cgst: 0, sgst: 0, total: 0 });
  const output = totals(salesRows);
  const input = totals(purchaseRows);
  const workbook = XLSX.utils.book_new();
  appendReportSheet(workbook, dateValue, salesRows, purchaseRows, output, input);
  const file = XLSX.write(workbook, { bookType: "xlsx", type: "buffer", cellStyles: true });
  return new NextResponse(file, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename=ca-gst-report-${month}.xlsx` } });
}

function appendReportSheet(workbook: XLSX.WorkBook, dateValue: Date, salesRows: Array<Array<string | number>>, purchaseRows: Array<Array<string | number>>, output: Totals, input: Totals) {
  const header = ["Reference No.", "Date", "Party Name", "GSTIN", "State", "Taxable Value", "IGST", "CGST", "SGST", "Bill Amount"];
  const reportMonth = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(dateValue);
  const rows: Array<Array<string | number>> = [
    [`CA Monthly GST Report - ${reportMonth}`], [], ["Sales / Output Tax"], header, ...salesRows, [], ["Purchases / Input Tax Credit"], header, ...purchaseRows, [], ["GST Summary"], ["Category", "Taxable Value", "IGST", "CGST", "SGST", "Total Amount"],
    ["Output Tax (Sales)", output.taxable, output.igst, output.cgst, output.sgst, output.total],
    ["Input Tax Credit (Purchases)", input.taxable, input.igst, input.cgst, input.sgst, input.total],
    ["Net Payable / (Credit)", "", output.igst - input.igst, output.cgst - input.cgst, output.sgst - input.sgst, output.cgst + output.sgst + output.igst - input.cgst - input.sgst - input.igst]
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 16 }, { wch: 13 }, { wch: 34 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 16 }];
  worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }, { s: { r: salesRows.length + 5, c: 0 }, e: { r: salesRows.length + 5, c: 9 } }, { s: { r: salesRows.length + purchaseRows.length + 8, c: 0 }, e: { r: salesRows.length + purchaseRows.length + 8, c: 9 } }];
  const sectionRows = [0, 2, salesRows.length + 5, salesRows.length + purchaseRows.length + 8];
  const headerRows = [3, salesRows.length + 6, salesRows.length + purchaseRows.length + 9];
  worksheet["!rows"] = rows.map((_, index) => ({ hpt: index === 0 ? 28 : sectionRows.includes(index) ? 22 : headerRows.includes(index) ? 20 : 18 }));
  styleRow(worksheet, 0, 10, { font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "17365D" } }, alignment: { horizontal: "center", vertical: "center" } });
  styleRow(worksheet, 2, 10, sectionStyle("0F766E"));
  styleRow(worksheet, salesRows.length + 5, 10, sectionStyle("B45309"));
  styleRow(worksheet, salesRows.length + purchaseRows.length + 8, 10, sectionStyle("1E3A8A"));
  for (const row of headerRows) styleRow(worksheet, row, row === headerRows[2] ? 6 : 10, headerStyle);
  styleDataRows(worksheet, 4, salesRows.length, 10, "EAF4FF");
  styleDataRows(worksheet, salesRows.length + 7, purchaseRows.length, 10, "FFF4E5");
  const summaryStart = salesRows.length + purchaseRows.length + 10;
  styleRow(worksheet, summaryStart + 1, 6, summaryStyle("E8F1FB"));
  styleRow(worksheet, summaryStart + 2, 6, summaryStyle("EAF7EE"));
  styleRow(worksheet, summaryStart + 3, 6, summaryStyle("DCFCE7", true));
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  for (let row = 0; row <= range.e.r; row += 1) for (let column = 5; column <= 9; column += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
    if (cell?.t === "n") cell.z = "#,##0.00;[Red](#,##0.00)";
  }
  for (let row = summaryStart + 1; row <= summaryStart + 3; row += 1) for (let column = 1; column <= 5; column += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
    if (cell?.t === "n") cell.z = "#,##0.00;[Red](#,##0.00)";
  }
  XLSX.utils.book_append_sheet(workbook, worksheet, "CA GST Report");
}

type Totals = { taxable: number; igst: number; cgst: number; sgst: number; total: number };

function styleRow(worksheet: XLSX.WorkSheet, row: number, columns: number, style: Record<string, unknown>) {
  for (let column = 0; column < columns; column += 1) {
    const key = XLSX.utils.encode_cell({ r: row, c: column });
    worksheet[key] = worksheet[key] ?? { t: "s", v: "" };
    worksheet[key].s = style;
  }
}

const border = { top: { style: "thin", color: { rgb: "CBD5E1" } }, bottom: { style: "thin", color: { rgb: "CBD5E1" } }, left: { style: "thin", color: { rgb: "CBD5E1" } }, right: { style: "thin", color: { rgb: "CBD5E1" } } };
const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "334155" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border };

function sectionStyle(color: string) {
  return { font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: color } }, alignment: { vertical: "center" }, border };
}

function summaryStyle(color: string, strong = false) {
  return { font: { bold: strong }, fill: { patternType: "solid", fgColor: { rgb: color } }, alignment: { vertical: "center" }, border };
}

function styleDataRows(worksheet: XLSX.WorkSheet, startRow: number, count: number, columns: number, alternateColor: string) {
  for (let row = startRow; row < startRow + count; row += 1) {
    const fill = row % 2 === 0 ? { patternType: "solid", fgColor: { rgb: alternateColor } } : { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
    for (let column = 0; column < columns; column += 1) {
      const key = XLSX.utils.encode_cell({ r: row, c: column });
      worksheet[key] = worksheet[key] ?? { t: "s", v: "" };
      worksheet[key].s = { fill, border, alignment: { horizontal: column >= 5 ? "right" : column === 1 ? "center" : "left", vertical: "center" } };
    }
  }
}
