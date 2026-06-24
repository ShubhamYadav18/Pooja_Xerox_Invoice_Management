import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@poojaxerox.local";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 12);
  const existingAdmin = await prisma.user.findFirst();
  const poojaXerox = await prisma.businessProfile.upsert({
    where: { code: "POOJA_XEROX" },
    update: {
      name: "Pooja Xerox",
      invoiceFormat: "POOJA_XEROX",
      invoiceNumberFloor: 632,
      isActive: true
    },
    create: {
      code: "POOJA_XEROX",
      name: "Pooja Xerox",
      invoiceFormat: "POOJA_XEROX",
      invoiceNumberFloor: 632
    }
  });

  const poojaEnterprises = await prisma.businessProfile.upsert({
    where: { code: "POOJA_ENTERPRISES" },
    update: {
      name: "Pooja Enterprises",
      invoiceFormat: "POOJA_ENTERPRISES",
      isActive: true
    },
    create: {
      code: "POOJA_ENTERPRISES",
      name: "Pooja Enterprises",
      invoiceFormat: "POOJA_ENTERPRISES",
      invoiceNumberFloor: 726
    }
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { email, name: "Admin", passwordHash }
    });
  } else {
    await prisma.user.create({
      data: {
        email,
        name: "Admin",
        passwordHash
      }
    });
  }

  // Pooja Xerox settings
  const pxSettingsData = {
    profileId: poojaXerox.id,
    businessName: "POOJA XEROX",
    businessAddress: "Room no 8, Hira Seth Chawl, no,1 Worli koli wada Ground floor,\nWaras lane, Worli Mumbai - 400030",
    gstNumber: "27ADOPY1935F1Z3",
    email: "pooja.xerox2007@gmail.com",
    contactNumber: "+91-9820490779 / 9699113554",
    logoUrl: "/PoojaXerox_Logo.png",
    signatureUrl: "/poojaXeroxsign.png",
    terms:
      "Interest @ 18% will be charged on all invoices not paid within 30 days.\nPlease draw cheque in favour of POOJA XEROX.",
    footerText: "Thank you for your business.",
    invoiceHeaderText: "|| SHREE GANESHAY NAMAH ||",
    bankName: "IndusInd Bank",
    bankAccountNo: "201003022109",
    bankBranch: "Four Bungalows, Mumbai",
    bankIfsc: "INDB0001074"
  };

  const existingPxSettings = await prisma.businessSettings.findFirst({ where: { profileId: poojaXerox.id } });
  if (existingPxSettings) {
    await prisma.businessSettings.update({ where: { id: existingPxSettings.id }, data: pxSettingsData });
  } else {
    await prisma.businessSettings.create({ data: pxSettingsData });
  }

  // Pooja Enterprises settings
  const peSettingsData = {
    profileId: poojaEnterprises.id,
    businessName: "POOJA ENTERPRISES",
    businessAddress: "Gala No. 4, Rane Estate, Opp. Deepak Building,\nKadam Wadi, Mukund Hospital,\nAndheri (E), Mumbai - 400093",
    gstNumber: "",
    email: "poojaenterprises.onesix@gmail.com",
    contactNumber: "+91-9820490779 / 7738333529",
    logoUrl: "/poojaenterpiseslogo.png",
    signatureUrl: "/poojaenterpisessign.png",
    terms: "Interest @ 18% will be charged on all invoices not paid within 30 days.\nPlease draw cheque in favour of POOJA ENTERPRISES.",
    footerText: "E. & O.E.",
    invoiceHeaderText: "|| SHREE GANESHAY NAMAH ||",
    cgstPercent: 0,
    sgstPercent: 0,
    bankName: "Kotak Mahindra Bank Ltd.",
    bankAccountNo: "6546126396",
    bankBranch: "Moreshwar Building, Hanuman Road, Mumbai",
    bankIfsc: "KKBK0000664"
  };

  const existingPeSettings = await prisma.businessSettings.findFirst({ where: { profileId: poojaEnterprises.id } });
  if (existingPeSettings) {
    await prisma.businessSettings.update({ where: { id: existingPeSettings.id }, data: peSettingsData });
  } else {
    await prisma.businessSettings.create({ data: peSettingsData });
  }

  await prisma.customer.updateMany({ where: { profileId: null }, data: { profileId: poojaXerox.id } });
  await prisma.invoiceTemplate.updateMany({ where: { profileId: null }, data: { profileId: poojaXerox.id } });
  await prisma.invoice.updateMany({ where: { profileId: null }, data: { profileId: poojaXerox.id } });
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
