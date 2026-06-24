"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

type TemplateItem = {
  id: string;
  srNo: number;
  branchId: string | null;
  itemType: "FIXED" | "METER" | "EXTRA_COPY" | "TEXT";
  particulars: string;
  sacCode: string;
  uom: string;
  qty: number;
  rate: number;
  amount: number;
  startCount: number | null;
  endCount: number | null;
  freeQty: number | null;
};

type Template = {
  id: string;
  customerId: string;
  name: string;
  code: string;
  billToAddress: string;
  billToGstin: string | null;
  billToState: string;
  billToStateCode: string;
  placeLabel: string | null;
  machineModel: string | null;
  poNumber: string | null;
  taxMode: "CGST_SGST" | "IGST";
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  items: TemplateItem[];
};

type Customer = {
  id: string;
  companyName: string;
  branches: {
    id: string;
    name: string;
    address: string;
  }[];
  templates: Template[];
};

export function TemplateInvoiceForm({
  customers,
  action,
  error
}: {
  customers: Customer[];
  action: (formData: FormData) => void;
  error?: string;
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const templates = useMemo(() => customers.find((customer) => customer.id === customerId)?.templates ?? [], [customerId, customers]);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [extraCopyEnabled, setExtraCopyEnabled] = useState(false);
  const selectedTemplate = templates.find((template) => template.id === templateId) ?? templates[0];
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const isNbsTemplate = selectedTemplate?.code === "NBS-CONSOLIDATED";
  const selectedTemplateBranchIds = new Set(selectedTemplate?.items.map((item) => item.branchId).filter(Boolean));
  const extraCopyBranches = isNbsTemplate
    ? selectedCustomer?.branches.filter((branch) => selectedTemplateBranchIds.has(branch.id)) ?? []
    : selectedCustomer?.branches ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const billingMonth = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date());

  function changeCustomer(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    const nextTemplates = customers.find((customer) => customer.id === nextCustomerId)?.templates ?? [];
    setTemplateId(nextTemplates[0]?.id ?? "");
    setExtraCopyEnabled(false);
  }

  return (
    <form action={action} className="grid gap-6">
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      ) : null}

      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Customer">
            <Select value={customerId} onChange={(event) => changeCustomer(event.target.value)} required>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Invoice Template">
            <Select
              name="templateId"
              value={templateId}
              onChange={(event) => {
                setTemplateId(event.target.value);
                setExtraCopyEnabled(false);
              }}
              required
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Invoice Date">
            <Input name="invoiceDate" type="date" defaultValue={today} required />
          </Field>
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            <p className="font-medium">Invoice number auto-generates from 633 onward.</p>
            <p className="text-muted-foreground">Billing month: {billingMonth}</p>
          </div>
        </div>
      </Card>

      {selectedTemplate ? (
        <>
          <Card className="p-4">
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p>
                <strong>Address:</strong> {selectedTemplate.billToAddress}
              </p>
              <p>
                <strong>GSTIN:</strong> {selectedTemplate.billToGstin || "-"}
              </p>
              <p>
                <strong>State:</strong> {selectedTemplate.billToState} ({selectedTemplate.billToStateCode})
              </p>
              <p>
                <strong>Tax:</strong> {selectedTemplate.taxMode === "IGST" ? `IGST @ ${selectedTemplate.igstRate}%` : `CGST @ ${selectedTemplate.cgstRate}% + SGST @ ${selectedTemplate.sgstRate}%`}
              </p>
              {selectedTemplate.machineModel ? (
                <p>
                  <strong>Machine:</strong> {selectedTemplate.machineModel}
                </p>
              ) : null}
              {selectedTemplate.poNumber ? (
                <p>
                  <strong>PO:</strong> {selectedTemplate.poNumber}
                </p>
              ) : null}
            </div>
          </Card>

          {isNbsTemplate ? (
            <Card className="p-4">
              <div className="grid gap-4 md:grid-cols-[220px_1fr_160px_160px]">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="extraCopyEnabled"
                    checked={extraCopyEnabled}
                    onChange={(event) => setExtraCopyEnabled(event.target.checked)}
                    className="h-4 w-4"
                  />
                  Add Extra Copy
                </label>
                <Field label="Branch">
                  <Select name="extraCopyBranchId" disabled={!extraCopyEnabled} required={extraCopyEnabled}>
                    <option value="">Select branch</option>
                    {extraCopyBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} - {branch.address}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Qty">
                  <Input name="extraCopyQty" type="number" min="0" step="0.01" disabled={!extraCopyEnabled} required={extraCopyEnabled} />
                </Field>
                <Field label="Rate">
                  <Input name="extraCopyRate" type="number" min="0" step="0.01" defaultValue="0.5" disabled={!extraCopyEnabled} required={extraCopyEnabled} />
                </Field>
              </div>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <div className="border-b p-4">
              <h2 className="font-semibold">Template Rows</h2>
              <p className="text-sm text-muted-foreground">Only meter and copy-count rows need monthly values.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-3">S.No.</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Particulars</th>
                    <th className="p-3">Start</th>
                    <th className="p-3">End</th>
                    <th className="p-3">Free</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Rate</th>
                    <th className="p-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTemplate.items.map((item) => (
                    <tr key={item.id} className="border-t align-top">
                      <td className="p-3">{item.srNo || ""}</td>
                      <td className="p-3">{item.itemType}</td>
                      <td className="p-3 font-medium whitespace-pre-line">{item.particulars}</td>
                      <td className="p-3">
                        {item.itemType === "METER" ? (
                          <Input name={`startCount:${item.id}`} type="number" required />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3">
                        {item.itemType === "METER" ? (
                          <Input name={`endCount:${item.id}`} type="number" required />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3">{item.freeQty ? item.freeQty : "-"}</td>
                      <td className="p-3">
                        {item.itemType === "EXTRA_COPY" ? (
                          <Input name={`qty:${item.id}`} type="number" step="0.01" defaultValue={item.qty} />
                        ) : (
                          item.qty || "-"
                        )}
                      </td>
                      <td className="p-3">
                        {item.itemType === "METER" || item.itemType === "EXTRA_COPY" ? (
                          <Input name={`rate:${item.id}`} type="number" step="0.01" defaultValue={item.rate} />
                        ) : (
                          formatCurrency(item.rate)
                        )}
                      </td>
                      <td className="p-3">{item.amount ? formatCurrency(item.amount) : "Auto"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-6 text-sm text-muted-foreground">
          No active templates found. Use <Link className="text-primary underline" href="/invoices/new?mode=custom">custom invoice mode</Link> for now.
        </Card>
      )}

      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <Link href="/invoices/new?mode=custom" className="text-sm text-primary underline">
          Custom manual invoice
        </Link>
        <Button disabled={!selectedTemplate} className="w-full sm:w-auto">Generate Invoice</Button>
      </div>
    </form>
  );
}
