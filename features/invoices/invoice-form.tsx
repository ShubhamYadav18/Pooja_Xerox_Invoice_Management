"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";
import { formatCurrency } from "@/lib/utils";

type Customer = {
  id: string;
  companyName: string;
  gstin: string | null;
  state: string;
  stateCode: string;
  branches: {
    id: string;
    name: string;
    address: string;
  }[];
};

type Item = {
  branchId: string;
  particulars: string;
  sacCode: string;
  uom: string;
  qty: number;
  rate: number;
};

type InitialInvoice = {
  invoiceNumber: string;
  invoiceDate: string;
  customerId: string;
  status?: "DRAFT" | "ISSUED" | "CANCELLED";
  notes?: string | null;
  items: Item[];
};

const blankItem: Item = {
  branchId: "",
  particulars: "",
  sacCode: "998912",
  uom: "Nos",
  qty: 1,
  rate: 0
};

export function InvoiceForm({
  customers,
  action,
  error,
  initialInvoice
}: {
  customers: Customer[];
  action: (formData: FormData) => void;
  error?: string;
  initialInvoice?: InitialInvoice;
}) {
  const draftKey = initialInvoice ? `invoice-draft-${initialInvoice.invoiceNumber}` : "invoice-draft-new";
  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoice?.invoiceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(initialInvoice?.invoiceDate ?? new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState(initialInvoice?.customerId ?? "");
  const [status, setStatus] = useState<"DRAFT" | "ISSUED" | "CANCELLED">(initialInvoice?.status ?? "ISSUED");
  const [notes, setNotes] = useState(initialInvoice?.notes ?? "");
  const [items, setItems] = useState<Item[]>(initialInvoice?.items?.length ? initialInvoice.items : [blankItem]);

  useEffect(() => {
    if (initialInvoice) return;
    const saved = window.localStorage.getItem(draftKey);
    if (!saved) return;
    const draft = JSON.parse(saved) as InitialInvoice;
    setInvoiceNumber(draft.invoiceNumber ?? "");
    setInvoiceDate(draft.invoiceDate ?? new Date().toISOString().slice(0, 10));
    setCustomerId(draft.customerId ?? "");
    setStatus(draft.status ?? "ISSUED");
    setNotes(draft.notes ?? "");
    setItems(draft.items?.length ? draft.items : [blankItem]);
  }, [draftKey, initialInvoice]);

  useEffect(() => {
    const payload = { invoiceNumber, invoiceDate, customerId, status, notes, items };
    window.localStorage.setItem(draftKey, JSON.stringify(payload));
  }, [customerId, draftKey, invoiceDate, invoiceNumber, items, notes, status]);

  const customer = customers.find((entry) => entry.id === customerId);
  const totals = useMemo(() => calculateInvoiceTotals(items), [items]);

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  return (
    <form action={action} className="grid gap-6">
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      ) : null}
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <section className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-4">
        <Field label="Invoice Number">
          <Input name="invoiceNumber" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} required />
        </Field>
        <Field label="Invoice Date">
          <Input name="invoiceDate" type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} required />
        </Field>
        <Field label="Customer">
          <Select name="customerId" value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
            <option value="">Select customer</option>
            {customers.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.companyName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" value={status} onChange={(event) => setStatus(event.target.value as "DRAFT" | "ISSUED" | "CANCELLED")}>
            <option value="ISSUED">Issued</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </Field>
        {customer ? (
          <div className="rounded-md bg-muted p-3 text-sm md:col-span-4">
            <p className="font-medium">{customer.companyName}</p>
            <p>GSTIN: {customer.gstin || "Not set"}</p>
            <p>
              State: {customer.state} ({customer.stateCode})
            </p>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="grid gap-3 border-b p-4 sm:flex sm:items-center sm:justify-between">
          <h2 className="font-semibold">Invoice Items</h2>
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setItems((current) => [...current, blankItem])}>
            <Plus className="h-4 w-4" />
            Add Row
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">S.No.</th>
                <th className="p-3">Branch</th>
                <th className="p-3">Particulars</th>
                <th className="p-3">SAC</th>
                <th className="p-3">UOM</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Rate</th>
                <th className="p-3">Amount</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-t">
                  <td className="p-3">{index + 1}</td>
                  <td className="p-3">
                    <Select value={item.branchId} onChange={(event) => updateItem(index, { branchId: event.target.value })}>
                      <option value="">None</option>
                      {customer?.branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="p-3">
                    <Input value={item.particulars} onChange={(event) => updateItem(index, { particulars: event.target.value })} required />
                  </td>
                  <td className="p-3">
                    <Input value={item.sacCode} onChange={(event) => updateItem(index, { sacCode: event.target.value })} required />
                  </td>
                  <td className="p-3">
                    <Input value={item.uom} onChange={(event) => updateItem(index, { uom: event.target.value })} required />
                  </td>
                  <td className="p-3">
                    <Input type="number" min="0" step="0.01" value={item.qty} onChange={(event) => updateItem(index, { qty: Number(event.target.value) })} required />
                  </td>
                  <td className="p-3">
                    <Input type="number" min="0" step="0.01" value={item.rate} onChange={(event) => updateItem(index, { rate: Number(event.target.value) })} required />
                  </td>
                  <td className="p-3 font-medium">{formatCurrency(item.qty * item.rate)}</td>
                  <td className="p-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 px-3"
                      onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_360px]">
        <Field label="Notes">
          <Textarea name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <div className="rounded-lg border bg-card p-4">
          <div className="grid gap-2 text-sm">
            <Row label="Total Before Tax" value={formatCurrency(totals.subtotal)} />
            <Row label="CGST @ 9%" value={formatCurrency(totals.cgstAmount)} />
            <Row label="SGST @ 9%" value={formatCurrency(totals.sgstAmount)} />
            <Row label="Total Tax" value={formatCurrency(totals.taxAmount)} />
            <Row label="Grand Total" value={formatCurrency(totals.grandTotal)} strong />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{totals.amountInWords}</p>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" className="w-full sm:w-auto">Save Invoice</Button>
      </div>
    </form>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t pt-2 text-base font-semibold" : "flex justify-between"}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
