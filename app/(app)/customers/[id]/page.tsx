import { redirect } from "next/navigation";
import {
  createBranch,
  deleteBranch,
  deleteCustomer,
  deleteTemplate,
  deleteTemplateItem,
  updateBranch,
  updateCustomer,
  updateTemplate,
  updateTemplateItem,
  addTemplateItem
} from "@/server/actions/customers";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
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

  const templates = await prisma.invoiceTemplate.findMany({
    where: { customerId: id },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { srNo: "asc" }] },
      branch: { select: { name: true } }
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{customer.companyName}</h1>
          <p className="text-sm text-muted-foreground">Customer profile, branch locations, and invoice templates.</p>
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
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3 w-[200px]">Branch Name</th>
                  <th className="p-3 w-[150px]">City</th>
                  <th className="p-3 w-[200px]">State & Code</th>
                  <th className="p-3">Address</th>
                  <th className="p-3 w-[160px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customer.branches.map((branch) => (
                  <tr key={branch.id} className="border-t align-top">
                    <td className="p-3">
                      <form id={`branch-${branch.id}`} action={updateBranch.bind(null, branch.id)}>
                        <input type="hidden" name="customerId" value={customer.id} />
                        <Input name="name" defaultValue={branch.name} required />
                      </form>
                    </td>
                    <td className="p-3">
                      <Input form={`branch-${branch.id}`} name="city" defaultValue={branch.city} required />
                    </td>
                    <td className="p-3">
                      <div className="grid grid-cols-[1fr_70px] gap-2">
                        <Input form={`branch-${branch.id}`} name="state" defaultValue={branch.state} required />
                        <Input form={`branch-${branch.id}`} name="stateCode" defaultValue={branch.stateCode} required />
                      </div>
                    </td>
                    <td className="p-3">
                      <Textarea form={`branch-${branch.id}`} name="address" defaultValue={branch.address} required className="min-h-[40px] resize-y" />
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button form={`branch-${branch.id}`} type="submit" variant="secondary" className="h-9 px-3">Save</Button>
                        <form action={deleteBranch.bind(null, branch.id, customer.id)}>
                          <Button variant="secondary" className="h-9 px-3">Delete</Button>
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

      {/* ===== TEMPLATES SECTION ===== */}
      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">Invoice Templates</h2>
        {templates.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No templates found for this customer.</Card>
        ) : null}
        {templates.map((template) => (
          <Card key={template.id} className="overflow-hidden">
            {/* Template Header */}
            <div className={`border-b p-4 ${template.isActive ? "bg-card" : "bg-muted/50 opacity-75"}`}>
              <form id={`tpl-${template.id}`} action={updateTemplate.bind(null, template.id)}>
                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Template Name">
                    <Input name="name" defaultValue={template.name} required />
                  </Field>
                  <Field label="Bill-To Name">
                    <Input name="billToName" defaultValue={template.billToName} required />
                  </Field>
                  <Field label="Bill-To GSTIN">
                    <Input name="billToGstin" defaultValue={template.billToGstin ?? ""} />
                  </Field>
                  <Field label="Bill-To State & Code">
                    <div className="grid grid-cols-[1fr_70px] gap-2">
                      <Input name="billToState" defaultValue={template.billToState} required />
                      <Input name="billToStateCode" defaultValue={template.billToStateCode} required />
                    </div>
                  </Field>
                  <Field label="Bill-To Address">
                    <Input name="billToAddress" defaultValue={template.billToAddress} required />
                  </Field>
                  <Field label="PO Number">
                    <Input name="poNumber" defaultValue={template.poNumber ?? ""} />
                  </Field>
                  <Field label="Machine Model">
                    <Input name="machineModel" defaultValue={template.machineModel ?? ""} />
                  </Field>
                  <Field label="Place Label">
                    <Input name="placeLabel" defaultValue={template.placeLabel ?? ""} />
                  </Field>
                  <Field label="Tax Mode">
                    <Select name="taxMode" defaultValue={template.taxMode}>
                      <option value="CGST_SGST">CGST + SGST</option>
                      <option value="IGST">IGST</option>
                    </Select>
                  </Field>
                  <Field label="CGST %">
                    <Input name="cgstRate" type="number" step="0.01" defaultValue={Number(template.cgstRate)} />
                  </Field>
                  <Field label="SGST %">
                    <Input name="sgstRate" type="number" step="0.01" defaultValue={Number(template.sgstRate)} />
                  </Field>
                  <Field label="IGST %">
                    <Input name="igstRate" type="number" step="0.01" defaultValue={Number(template.igstRate)} />
                  </Field>
                  <Field label="Active">
                    <Select name="isActive" defaultValue={template.isActive ? "true" : "false"}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </Select>
                  </Field>
                  <div className="flex items-end gap-2">
                    <Button form={`tpl-${template.id}`} type="submit" variant="secondary" className="h-10 px-4">Save Template</Button>
                    <form action={deleteTemplate.bind(null, template.id)}>
                      <Button variant="danger" className="h-10 px-4">Delete</Button>
                    </form>
                  </div>
                </div>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">
                Code: {template.code} &middot; {template.isActive ? "✅ Active" : "❌ Inactive"} &middot; {template.items.length} item(s)
              </p>
            </div>

            {/* Template Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-3 w-[50px]">Sr</th>
                    <th className="p-3 w-[90px]">Type</th>
                    <th className="p-3 w-[120px]">Branch</th>
                    <th className="p-3">Particulars</th>
                    <th className="p-3 w-[100px]">SAC Code</th>
                    <th className="p-3 w-[70px]">UOM</th>
                    <th className="p-3 w-[80px]">Qty</th>
                    <th className="p-3 w-[100px]">Rate</th>
                    <th className="p-3 w-[100px]">Amount</th>
                    <th className="p-3 w-[130px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {template.items.map((item) => (
                    <tr key={item.id} className="border-t align-top">
                      <td className="p-3">{item.srNo}</td>
                      <td className="p-3">
                        <form id={`item-${item.id}`} action={updateTemplateItem.bind(null, item.id)}>
                          <Select name="itemType" defaultValue={item.itemType} className="h-9 text-xs">
                            <option value="FIXED">FIXED</option>
                            <option value="METER">METER</option>
                            <option value="EXTRA_COPY">EXTRA_COPY</option>
                            <option value="TEXT">TEXT</option>
                          </Select>
                        </form>
                      </td>
                      <td className="p-3">
                        <Select form={`item-${item.id}`} name="branchId" defaultValue={item.branchId ?? ""} className="h-9 text-xs">
                          <option value="">None</option>
                          {customer.branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="p-3">
                        <Textarea form={`item-${item.id}`} name="particulars" defaultValue={item.particulars} required className="min-h-[40px] resize-y text-xs" />
                      </td>
                      <td className="p-3">
                        <Input form={`item-${item.id}`} name="sacCode" defaultValue={item.sacCode} className="h-9 text-xs" />
                      </td>
                      <td className="p-3">
                        <Input form={`item-${item.id}`} name="uom" defaultValue={item.uom} className="h-9 text-xs" />
                      </td>
                      <td className="p-3">
                        <Input form={`item-${item.id}`} name="qty" type="number" step="0.01" defaultValue={Number(item.qty)} className="h-9 text-xs" />
                      </td>
                      <td className="p-3">
                        <Input form={`item-${item.id}`} name="rate" type="number" step="0.01" defaultValue={Number(item.rate)} className="h-9 text-xs" />
                      </td>
                      <td className="p-3 text-xs font-medium">{Number(item.amount).toLocaleString("en-IN")}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button form={`item-${item.id}`} type="submit" variant="secondary" className="h-8 px-2 text-xs">Save</Button>
                          <form action={deleteTemplateItem.bind(null, item.id, template.id)}>
                            <Button variant="secondary" className="h-8 px-2 text-xs">Del</Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Add New Item Row */}
                  <tr className="border-t bg-muted/30 align-top">
                    <td className="p-3 text-xs text-muted-foreground">New</td>
                    <td className="p-3">
                      <form id={`add-item-${template.id}`} action={addTemplateItem}>
                        <input type="hidden" name="templateId" value={template.id} />
                        <Select name="itemType" defaultValue="FIXED" className="h-9 text-xs">
                          <option value="FIXED">FIXED</option>
                          <option value="METER">METER</option>
                          <option value="EXTRA_COPY">EXTRA_COPY</option>
                          <option value="TEXT">TEXT</option>
                        </Select>
                      </form>
                    </td>
                    <td className="p-3">
                      <Select form={`add-item-${template.id}`} name="branchId" defaultValue="" className="h-9 text-xs">
                        <option value="">None</option>
                        {customer.branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="p-3">
                      <Input form={`add-item-${template.id}`} name="particulars" placeholder="Particulars" required className="h-9 text-xs" />
                    </td>
                    <td className="p-3">
                      <Input form={`add-item-${template.id}`} name="sacCode" defaultValue="997314" className="h-9 text-xs" />
                    </td>
                    <td className="p-3">
                      <Input form={`add-item-${template.id}`} name="uom" defaultValue="" className="h-9 text-xs" />
                    </td>
                    <td className="p-3">
                      <Input form={`add-item-${template.id}`} name="qty" type="number" step="0.01" defaultValue="1" className="h-9 text-xs" />
                    </td>
                    <td className="p-3">
                      <Input form={`add-item-${template.id}`} name="rate" type="number" step="0.01" defaultValue="0" className="h-9 text-xs" />
                    </td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right">
                      <Button form={`add-item-${template.id}`} type="submit" variant="secondary" className="h-8 px-2 text-xs">Add</Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
