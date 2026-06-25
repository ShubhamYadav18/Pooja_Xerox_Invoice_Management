import { BusinessSettings, Customer, CustomerBranch, Invoice, InvoiceItem } from "@prisma/client";
import { formatCurrency, formatDate } from "@/lib/utils";

type InvoiceWithDetails = Invoice & {
  customer: Customer;
  items: (InvoiceItem & { branch: CustomerBranch | null })[];
};

export function InvoiceTemplate({
  invoice,
  settings
}: {
  invoice: InvoiceWithDetails;
  settings: BusinessSettings;
}) {
  const billToName = invoice.billToName || invoice.customer.companyName;
  const billToGstin = invoice.billToGstin || invoice.customer.gstin || "-";
  const billToState = invoice.billToState || invoice.customer.state;
  const billToStateCode = invoice.billToStateCode || invoice.customer.stateCode;
  const billToAddress = invoice.billToAddress || invoice.items.find((item) => item.branch)?.branch?.address || invoice.customer.state;
  const isPE = settings.businessName?.toLowerCase().includes("pooja enterprises");

  return (
    <div className="invoice-sheet mx-auto bg-white p-0 text-black shadow print:shadow-none">
      <div className="invoice-padding">
        <div className="invoice-frame">
          <header className="invoice-header">
            <div className="grid grid-cols-[32mm_1fr_32mm] items-center gap-2">
              <div className="flex justify-center">
                <img src={settings.logoUrl || "/poojaenterpiseslogo.png"} alt={`${settings.businessName} logo`} className="h-[28mm] w-[28mm] object-contain mix-blend-multiply" />
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold">{settings.invoiceHeaderText}</p>
                <h1 className="mt-1 text-[36px] font-black text-red-600 leading-none tracking-normal">{settings.businessName}</h1>
                <p className="mx-auto mt-2 max-w-[160mm] text-balance text-[10px] leading-4">{settings.businessAddress}</p>
                <p className="text-[10px] leading-4">Email: {settings.email || "-"} | Contact: {settings.contactNumber || "-"}</p>
                <p className="text-[10px] leading-4">GSTIN: {settings.gstNumber}</p>
              </div>
              <div className="flex justify-center">
                <img src="/images.png" alt="Ganesh Logo" className="h-[20mm] w-[20mm] object-contain mix-blend-multiply" />
              </div>
            </div>
          </header>

          <div className="invoice-banner">
            <span>{isPE ? "Invoice" : "Tax Invoice"}</span>
          </div>

          <section className="invoice-details-grid">
            <div className="invoice-details-cell">
              <p>
                <strong>Customer Name:</strong> {billToName}
              </p>
              <p>
                <strong>GSTIN:</strong> {billToGstin}
              </p>
              <p>
                <strong>Address:</strong> {billToAddress}
              </p>
            </div>
            <div className="p-2.5">
              <p>
                <strong>Invoice Number:</strong> {invoice.invoiceNumber}
              </p>
              <p>
                <strong>Invoice Date:</strong> {formatDate(invoice.invoiceDate)}
              </p>
              <p>
                <strong>State:</strong> {billToState}
              </p>
              <p>
                <strong>State Code:</strong> {billToStateCode}
              </p>
              {invoice.billingMonth ? (
                <p>
                  <strong>Billing Month:</strong> {invoice.billingMonth}
                </p>
              ) : null}
              {invoice.machineModel ? (
                <p>
                  <strong>Machine:</strong> {invoice.machineModel}
                </p>
              ) : null}
              {invoice.poNumber ? (
                <p>
                  <strong>PO No:</strong> {invoice.poNumber}
                </p>
              ) : null}
            </div>
          </section>

          <div className={`invoice-items-box relative${invoice.items.length > 5 ? " invoice-items-compact" : ""}`}>
            <div className="invoice-column-guides" aria-hidden="true">
              <span style={{ left: "11mm" }} />
              <span style={{ left: "84mm" }} />
              <span style={{ left: "106mm" }} />
              <span style={{ left: "124mm" }} />
              <span style={{ left: "140mm" }} />
              <span style={{ left: "164mm" }} />
            </div>
            {isPE ? (
              <div className="absolute bottom-1 left-[13mm] text-[10px] font-medium text-red-600 uppercase tracking-wide">
                Labour Charges Only
              </div>
            ) : null}
            <table className="invoice-table">
              <colgroup>
                <col className="w-[11mm]" />
                <col className="w-[73mm]" />
                <col className="w-[22mm]" />
                <col className="w-[18mm]" />
                <col className="w-[16mm]" />
                <col className="w-[24mm]" />
                <col className="w-[28mm]" />
              </colgroup>
              <thead>
                <tr>
                  <Th>S.No.</Th>
                  <Th>Particulars</Th>
                  <Th>SAC Code</Th>
                  <Th>UOM</Th>
                  <Th>Qty</Th>
                  <Th>Rate</Th>
                  <Th>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <Td className="text-center">{item.srNo}</Td>
                    <Td>
                      <div className="font-medium whitespace-pre-wrap">{item.particulars}</div>
                      {item.branch ? <div className="mt-1 text-[9px]">Branch: {item.branch.name}</div> : null}
                    </Td>
                    <Td className="text-center">{item.sacCode}</Td>
                    <Td className="text-center">{item.uom}</Td>
                    <Td className="text-right">{Number(item.qty) ? String(item.qty) : ""}</Td>
                    <Td className="text-right">{Number(item.rate) ? formatCurrency(String(item.rate)) : ""}</Td>
                    <Td className="text-right">{Number(item.amount) ? formatCurrency(String(item.amount)) : ""}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="invoice-total-grid">
            <div className="invoice-total-words">
              <p className="font-bold">Total Invoice Amount in Words</p>
              <p className="mt-1">{invoice.amountInWords}</p>
            </div>
            {Number(invoice.taxAmount) > 0 ? (
              <div>
                <Total label="Total Amount before Tax" value={formatCurrency(String(invoice.subtotal))} />
                {invoice.taxMode === "IGST" ? (
                  <Total label={`Add: IGST @ ${invoice.igstRate}%`} value={formatCurrency(String(invoice.igstAmount))} />
                ) : (
                  <>
                    <Total label={`Add: CGST @ ${invoice.cgstRate}%`} value={formatCurrency(String(invoice.cgstAmount))} />
                    <Total label={`Add: SGST @ ${invoice.sgstRate}%`} value={formatCurrency(String(invoice.sgstAmount))} />
                  </>
                )}
                <Total label="Total Tax Amount" value={formatCurrency(String(invoice.taxAmount))} />
                <Total label="Total Amount after Tax" value={formatCurrency(String(invoice.grandTotal))} strong />
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateRows: "1fr auto", background: "#f8fcfc" }}>
                <div style={{ borderBottom: "1px solid #174e57" }} />
                <Total label="TOTAL" value={formatCurrency(String(invoice.grandTotal))} strong />
              </div>
            )}
          </section>

          <section className="invoice-footer-grid">
            <div className="invoice-terms">
              <p className="font-bold">Terms & Conditions</p>
              <div className="mt-1 whitespace-pre-line leading-5">{settings.terms}</div>
              <div className="mt-3 max-w-[115mm] leading-4">
                <p className="font-bold">Bank Details</p>
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <p>Bank: {settings.bankName ?? "IndusInd Bank"}</p>
                  <p>A/c No.: {settings.bankAccountNo ?? "201003022109"}</p>
                  <p>Branch: {settings.bankBranch ?? "Four Bungalows, Mumbai"}</p>
                  <p>IFSC: {settings.bankIfsc ?? "INDB0001074"}</p>
                </div>
              </div>
            </div>
            <div className="p-2.5 text-center">
              <p>Certified that the particulars given above are true and correct.</p>
              <p className="mt-2 font-bold">For {settings.businessName}</p>
              <div className="mt-3 flex h-24 items-center justify-center gap-3">
                {settings.stampUrl ? <img alt="Stamp" src={settings.stampUrl} className="max-h-20 max-w-28" /> : null}
                {settings.signatureUrl ? <img alt="Signature" src={settings.signatureUrl} className="max-h-24 max-w-48 object-contain" /> : null}
              </div>
              <p className="mt-2 font-bold">Authorised Signatory</p>
            </div>
          </section>

          {settings.footerText ? <footer className="invoice-footer-text">{settings.footerText}</footer> : null}
        </div>
      </div>
    </div>
  );
}

function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`text-center font-bold ${className ?? ""}`}>
      <span className="invoice-th-content">{props.children}</span>
    </th>
  );
}

function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`p-1.5 align-top ${className ?? ""}`} {...props} />;
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`invoice-total-row ${strong ? "font-bold" : ""}`}>
      <div className="invoice-total-label">{label}</div>
      <div className="p-1.5 text-right">{value}</div>
    </div>
  );
}
