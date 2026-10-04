"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { createPurchase, deletePurchase, updatePurchase } from "@/server/actions/purchases";

type Supplier = { id: string; name: string; gstin: string | null; state: string };
type Purchase = {
  id: string; billNumber: string; billDate: Date; supplierName: string; supplierGstin: string | null;
  stateOfSupply: string; taxableAmount: { toString(): string }; notes: string | null;
};

export function PurchaseFormDialog({ suppliers, purchase }: { suppliers: Supplier[]; purchase?: Purchase }) {
  const [open, setOpen] = useState(false);
  const [supplierName, setSupplierName] = useState(purchase?.supplierName ?? "");
  const [supplierGstin, setSupplierGstin] = useState(purchase?.supplierGstin ?? "");
  const [state, setState] = useState(purchase?.stateOfSupply ?? "Maharashtra");
  const [taxableAmount, setTaxableAmount] = useState(purchase ? String(purchase.taxableAmount) : "");
  const calculation = useMemo(() => {
    const taxable = Number(taxableAmount) || 0;
    const isMaharashtra = state.trim().toLowerCase() === "maharashtra";
    const cgst = isMaharashtra ? taxable * 0.09 : 0;
    const sgst = isMaharashtra ? taxable * 0.09 : 0;
    const igst = isMaharashtra ? 0 : taxable * 0.18;
    return { isMaharashtra, cgst, sgst, igst, total: taxable + cgst + sgst + igst };
  }, [state, taxableAmount]);
  const action = purchase ? updatePurchase.bind(null, purchase.id) : createPurchase;

  function applySupplier(id: string) {
    const supplier = suppliers.find((entry) => entry.id === id);
    if (!supplier) return;
    setSupplierName(supplier.name);
    setSupplierGstin(supplier.gstin ?? "");
    setState(supplier.state);
  }

  return (
    <>
      <Button type="button" variant={purchase ? "secondary" : "primary"} className={purchase ? "h-9 px-3" : "w-full sm:w-auto"} onClick={() => setOpen(true)}>
        {purchase ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        <span className={purchase ? "sr-only" : ""}>{purchase ? "Edit purchase" : "Add Purchase"}</span>
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-semibold">{purchase ? "Edit Purchase Bill" : "Add Purchase Bill"}</h2>
              <Button type="button" variant="secondary" className="h-9 w-9 p-0" onClick={() => setOpen(false)} title="Close"><X className="h-4 w-4" /></Button>
            </div>
            <form action={action} className="grid gap-4 p-4 md:grid-cols-2">
              {suppliers.length ? <Field label="Saved supplier"><Select defaultValue="" onChange={(event) => applySupplier(event.target.value)}><option value="">Choose to autofill</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</Select></Field> : <div />}
              <Field label="Bill Number"><Input name="billNumber" defaultValue={purchase?.billNumber} required /></Field>
              <Field label="Bill Date"><Input name="billDate" type="date" defaultValue={purchase ? new Date(purchase.billDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)} required /></Field>
              <Field label="Supplier Name"><Input name="supplierName" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} required /></Field>
              <Field label="Supplier GSTIN"><Input name="supplierGstin" value={supplierGstin} onChange={(event) => setSupplierGstin(event.target.value)} /></Field>
              <Field label="State of Supply"><Input name="stateOfSupply" value={state} onChange={(event) => setState(event.target.value)} required /></Field>
              <Field label="Taxable Value"><Input name="taxableAmount" type="number" min="0" step="0.01" value={taxableAmount} onChange={(event) => setTaxableAmount(event.target.value)} required /></Field>
              <div className="rounded-md border bg-muted p-3 text-sm md:col-span-2"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Tax label="CGST" value={calculation.cgst} /><Tax label="SGST" value={calculation.sgst} /><Tax label="IGST" value={calculation.igst} /><Tax label="Total" value={calculation.total} strong /></div><p className="mt-2 text-xs text-muted-foreground">{calculation.isMaharashtra ? "Maharashtra supply: CGST 9% + SGST 9%." : "Inter-state supply: IGST 18%."}</p></div>
              <Field label="Notes" ><Textarea name="notes" defaultValue={purchase?.notes ?? ""} className="min-h-20" /></Field>
              <label className="flex items-center gap-2 self-end pb-3 text-sm"><input name="saveSupplier" type="checkbox" defaultChecked /> Save or update this supplier in the master</label>
              <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">{purchase ? "Update Bill" : "Save Purchase"}</Button></div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function DeletePurchaseButton({ purchaseId }: { purchaseId: string }) {
  const action = deletePurchase.bind(null, purchaseId);
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Delete this purchase bill? This cannot be undone.")) event.preventDefault(); }}><button className="h-9 rounded-md border border-destructive/40 px-3 text-sm text-destructive hover:bg-destructive/10">Delete</button></form>;
}

function Tax({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div><p className="text-muted-foreground">{label}</p><p className={strong ? "font-semibold" : "font-medium"}>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value)}</p></div>;
}
