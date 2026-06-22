import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@poojaxerox.local";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 12);
  const existingAdmin = await prisma.user.findFirst();

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

  const settingsData = {
    businessName: "POOJA XEROX",
    businessAddress: "Room no 8, Hira Seth Chawl, no,1 Worli koli wada Ground floor,\nWaras lane, Worli Mumbai - 400030",
    gstNumber: "27ADOPY1935F1Z3",
    email: "pooja.xerox2007@gmail.com",
    contactNumber: "+91-9820490779 / 9699113554",
    logoUrl: "/PoojaXerox_Logo.png",
    terms:
      "Interest @ 18% will be charged on all invoices not paid within 30 days.\nPlease draw cheque in favour of POOJA XEROX.",
    footerText: "Thank you for your business.",
    invoiceHeaderText: "|| SHREE GANESHAY NAMAH ||"
  };

  const existingSettings = await prisma.businessSettings.findFirst();
  if (existingSettings) {
    await prisma.businessSettings.update({
      where: { id: existingSettings.id },
      data: settingsData
    });
  } else {
    await prisma.businessSettings.create({
      data: settingsData
    });
  }
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
