import Link from "next/link";
import { createCustomer } from "@/server/actions/customers";
import { Button, Card, Field, Input } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export default async function CustomersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { companyName: { contains: q, mode: "insensitive" } },
            { gstin: { contains: q, mode: "insensitive" } }
          ]
        }
      : undefined,
    orderBy: { companyName: "asc" },
    include: { branches: true }
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-muted-foreground">Maintain customer GST details and branches.</p>
      </div>

      <Card className="p-4">
        <form action={createCustomer} className="grid gap-4 md:grid-cols-4">
          <Field label="Company Name">
            <Input name="companyName" required />
          </Field>
          <Field label="GSTIN">
            <Input name="gstin" />
          </Field>
          <Field label="State">
            <Input name="state" required />
          </Field>
          <Field label="State Code">
            <Input name="stateCode" required />
          </Field>
          <Field label="Contact Person">
            <Input name="contactPerson" />
          </Field>
          <Field label="Mobile">
            <Input name="mobile" />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" />
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full">Add Customer</Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <form>
            <Input name="q" defaultValue={q} placeholder="Search by customer name or GSTIN" />
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Company</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3">State</th>
                <th className="p-3">Branches</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-t">
                  <td className="p-3 font-medium">
                    <Link href={`/customers/${customer.id}`} className="text-primary hover:underline">
                      {customer.companyName}
                    </Link>
                  </td>
                  <td className="p-3">{customer.gstin || "-"}</td>
                  <td className="p-3">{customer.state}</td>
                  <td className="p-3">{customer.branches.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
