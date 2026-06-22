import { updateSettings } from "@/server/actions/settings";
import { Card, Field, Input, Textarea, Button } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const settings = await prisma.businessSettings.findFirst();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">All invoice branding and tax defaults are managed here.</p>
      </div>
      <Card className="p-4">
        <form action={updateSettings.bind(null, null)} className="grid gap-4 md:grid-cols-2">
          <Field label="Business Name">
            <Input name="businessName" defaultValue={settings?.businessName ?? "POOJA XEROX"} required />
          </Field>
          <Field label="GST Number">
            <Input name="gstNumber" defaultValue={settings?.gstNumber ?? ""} required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={settings?.email ?? ""} />
          </Field>
          <Field label="Contact Number">
            <Input name="contactNumber" defaultValue={settings?.contactNumber ?? ""} />
          </Field>
          <Field label="Invoice Header Text">
            <Input name="invoiceHeaderText" defaultValue={settings?.invoiceHeaderText ?? "|| SHREE GANESHAY NAMAH ||"} required />
          </Field>
          <Field label="Footer Text">
            <Input name="footerText" defaultValue={settings?.footerText ?? ""} />
          </Field>
          <Field label="Logo URL">
            <Input name="logoUrl" defaultValue={settings?.logoUrl ?? ""} />
          </Field>
          <Field label="Stamp Image URL">
            <Input name="stampUrl" defaultValue={settings?.stampUrl ?? ""} />
          </Field>
          <Field label="Signature Image URL">
            <Input name="signatureUrl" defaultValue={settings?.signatureUrl ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CGST %">
              <Input name="cgstPercent" type="number" step="0.01" defaultValue={String(settings?.cgstPercent ?? 9)} required />
            </Field>
            <Field label="SGST %">
              <Input name="sgstPercent" type="number" step="0.01" defaultValue={String(settings?.sgstPercent ?? 9)} required />
            </Field>
          </div>
          <Field label="Business Address">
            <Textarea name="businessAddress" defaultValue={settings?.businessAddress ?? ""} required />
          </Field>
          <Field label="Terms & Conditions">
            <Textarea name="terms" defaultValue={settings?.terms ?? ""} required />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit">Save Settings</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
