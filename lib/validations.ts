import { z } from "zod";

export const customerSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  gstin: z.string().optional(),
  state: z.string().min(2, "State is required"),
  stateCode: z.string().min(1, "State code is required"),
  contactPerson: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal(""))
});

export const branchSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().min(2, "Branch name is required"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  stateCode: z.string().min(1, "State code is required")
});

export const invoiceItemSchema = z.object({
  branchId: z.string().optional(),
  particulars: z.string().min(2),
  sacCode: z.string().min(1),
  uom: z.string().min(1),
  qty: z.coerce.number().positive(),
  rate: z.coerce.number().nonnegative()
});

export const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required").max(60),
  invoiceDate: z.coerce.date(),
  customerId: z.string().min(1),
  notes: z.string().optional(),
  status: z.enum(["DRAFT", "ISSUED", "CANCELLED"]).default("ISSUED"),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required")
});

export const settingsSchema = z.object({
  businessName: z.string().min(2),
  businessAddress: z.string().min(5),
  gstNumber: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  contactNumber: z.string().optional(),
  logoUrl: z.string().optional(),
  stampUrl: z.string().optional(),
  signatureUrl: z.string().optional(),
  terms: z.string().min(5),
  cgstPercent: z.coerce.number().min(0).max(100),
  sgstPercent: z.coerce.number().min(0).max(100),
  footerText: z.string().optional(),
  invoiceHeaderText: z.string().min(2)
});
