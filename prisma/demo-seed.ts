import { PrismaClient } from "@prisma/client";
import { calculateInvoiceTotals } from "../lib/invoice-calculations";

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.businessSettings.findFirst();
  if (settings) {
    await prisma.businessSettings.update({
      where: { id: settings.id },
      data: {
        businessName: "POOJA XEROX",
        businessAddress:
          "Shop No. 12, Near Station Road, Mumbai, Maharashtra - 400001",
        gstNumber: "27ABCDE1234F1Z5",
        email: "poojaxerox@example.com",
        contactNumber: "+91 98765 43210",
        logoUrl: "/images.png",
        terms:
          "Interest @ 18% will be charged on all invoices not paid within 30 days.\nPlease draw cheque in favour of POOJA XEROX.\nSubject to Mumbai jurisdiction.",
        footerText: "Thank you for your business.",
        invoiceHeaderText: "|| SHREE GANESHAY NAMAH ||",
        cgstPercent: 9,
        sgstPercent: 9
      }
    });
  }

  const customer =
    (await prisma.customer.findFirst({
      where: { companyName: "NBS INTERNATIONAL LTD" },
      include: { branches: true }
    })) ??
    (await prisma.customer.create({
      data: {
        companyName: "NBS INTERNATIONAL LTD",
        gstin: "27AAACN1234B1Z2",
        state: "Maharashtra",
        stateCode: "27",
        contactPerson: "Rahul Mehta",
        mobile: "+91 99887 76655",
        email: "accounts@nbsinternational.example",
        branches: {
          create: [
            {
              name: "Andheri",
              address:
                "NBS International Ltd, MIDC Road, Andheri East, Mumbai - 400093",
              city: "Mumbai",
              state: "Maharashtra",
              stateCode: "27"
            },
            {
              name: "Kurla",
              address:
                "NBS International Ltd, LBS Marg, Kurla West, Mumbai - 400070",
              city: "Mumbai",
              state: "Maharashtra",
              stateCode: "27"
            },
            {
              name: "Sewri",
              address:
                "NBS International Ltd, Sewri Industrial Estate, Mumbai - 400015",
              city: "Mumbai",
              state: "Maharashtra",
              stateCode: "27"
            }
          ]
        }
      },
      include: { branches: true }
    }));

  const branches =
    customer.branches.length > 0
      ? customer.branches
      : await prisma.customerBranch.findMany({ where: { customerId: customer.id } });

  const existingInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: "DEMO-001" }
  });
  if (existingInvoice) {
    console.log("Demo invoice already exists: DEMO-001");
    return;
  }

  const items = [
    {
      branchId: branches[0]?.id,
      particulars: "Xerox copies - A4 black and white",
      sacCode: "998912",
      uom: "Nos",
      qty: 1850,
      rate: 1.25
    },
    {
      branchId: branches[1]?.id,
      particulars: "Color printouts - A4",
      sacCode: "998912",
      uom: "Nos",
      qty: 420,
      rate: 8
    },
    {
      branchId: branches[2]?.id,
      particulars: "Spiral binding and lamination",
      sacCode: "998912",
      uom: "Nos",
      qty: 96,
      rate: 35
    },
    {
      branchId: branches[0]?.id,
      particulars: "Scanning and PDF conversion",
      sacCode: "998912",
      uom: "Pages",
      qty: 1250,
      rate: 2.5
    }
  ];

  const totals = calculateInvoiceTotals(items, 9, 9);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: "DEMO-001",
      invoiceDate: new Date(),
      customerId: customer.id,
      status: "ISSUED",
      notes: "Demo invoice for previewing print and PDF layout.",
      subtotal: totals.subtotal,
      cgstRate: totals.cgstRate,
      sgstRate: totals.sgstRate,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      taxAmount: totals.taxAmount,
      grandTotal: totals.grandTotal,
      amountInWords: totals.amountInWords,
      items: {
        create: items.map((item, index) => ({
          srNo: index + 1,
          branchId: item.branchId,
          particulars: item.particulars,
          sacCode: item.sacCode,
          uom: item.uom,
          qty: item.qty,
          rate: item.rate,
          amount: item.qty * item.rate
        }))
      }
    }
  });

  console.log(`Created demo invoice ${invoice.invoiceNumber}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
