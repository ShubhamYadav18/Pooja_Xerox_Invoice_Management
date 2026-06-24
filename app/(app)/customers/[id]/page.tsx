import { redirect } from "next/navigation";
import { createBranch, deleteBranch, deleteCustomer, updateBranch, updateCustomer } from "@/server/actions/customers";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/server/profile";

export default async function CustomerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const profileId = await getActiveProfileId();
  const customer = await prisma.customer.findFirst({
    where: { id, profileId },
    include: { branches: { orderBy: { name: "asc" } } }
  });
  if (!customer) redirect("/customers");

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{customer.companyName}</h1>
          <p className="text-sm text-muted-foreground">Customer profile and branch locations.</p>
        </div>
        <form action={deleteCustomer.bind(null, customer.id)}>
          <Button variant="danger" className="w-full sm:w-auto">Delete Customer</Button>
        </form>
      </div>
      {query.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </div>
      ) : null}

      <Card className="p-4">
        <form action={updateCustomer.bind(null, customer.id)} className="grid gap-4 md:grid-cols-4">
          <Field label="Company Name">
            <Input name="companyName" defaultValue={customer.companyName} required />
          </Field>
          <Field label="GSTIN">
            <Input name="gstin" defaultValue={customer.gstin ?? ""} />
          </Field>
          <Field label="State">
            <Input name="state" defaultValue={customer.state} required />
          </Field>
          <Field label="State Code">
            <Input name="stateCode" defaultValue={customer.stateCode} required />
          </Field>
          <Field label="Contact Person">
            <Input name="contactPerson" defaultValue={customer.contactPerson ?? ""} />
          </Field>
          <Field label="Mobile">
            <Input name="mobile" defaultValue={customer.mobile ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={customer.email ?? ""} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full">Save Changes</Button>
          </div>
        </form>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <Card className="p-4">
          <h2 className="mb-4 font-semibold">Add Branch</h2>
          <form action={createBranch} className="grid gap-4">
            <input type="hidden" name="customerId" value={customer.id} />
            <Field label="Branch Name">
              <Input name="name" required />
            </Field>
            <Field label="Complete Address">
              <Textarea name="address" required />
            </Field>
            <Field label="City">
              <Input name="city" required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="State">
                <Input name="state" defaultValue={customer.state} required />
              </Field>
              <Field label="State Code">
                <Input name="stateCode" defaultValue={customer.stateCode} required />
              </Field>
            </div>
            <Button type="submit">Add Branch</Button>
          </form>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b p-4 font-semibold">Branches</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3">Branch</th>
                  <th className="p-3">City</th>
                  <th className="p-3">Address</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {customer.branches.map((branch) => (
                  <tr key={branch.id} className="border-t align-top">
                    <td className="p-3">
                      <form id={`branch-${branch.id}`} action={updateBranch.bind(null, branch.id)} className="grid gap-2">
                        <input type="hidden" name="customerId" value={customer.id} />
                        <Input name="name" defaultValue={branch.name} required />
                        <div className="grid grid-cols-2 gap-2">
                          <Input name="city" defaultValue={branch.city} required />
                          <Input name="stateCode" defaultValue={branch.stateCode} required />
                        </div>
                      </form>
                    </td>
                    <td className="p-3">
                      <Input form={`branch-${branch.id}`} name="state" defaultValue={branch.state} required />
                    </td>
                    <td className="p-3">
                      <Textarea form={`branch-${branch.id}`} name="address" defaultValue={branch.address} required />
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button form={`branch-${branch.id}`} type="submit" variant="secondary" className="h-8 px-3">Save</Button>
                        <form action={deleteBranch.bind(null, branch.id, customer.id)}>
                          <Button variant="secondary" className="h-8 px-3">Delete</Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
