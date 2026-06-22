import { PrismaClient, TaxMode, TemplateItemType } from "@prisma/client";

const prisma = new PrismaClient();

type CustomerInput = {
  companyName: string;
  gstin: string;
  state: string;
  stateCode: string;
};

type BranchInput = {
  name: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
};

type TemplateInput = {
  code: string;
  name: string;
  customerId: string;
  branchId?: string;
  billToName: string;
  billToAddress: string;
  billToGstin?: string;
  billToState: string;
  billToStateCode: string;
  placeLabel?: string;
  machineModel?: string;
  poNumber?: string;
  taxMode: TaxMode;
  items: {
    srNo: number;
    branchId?: string;
    itemType: TemplateItemType;
    particulars: string;
    sacCode?: string;
    uom?: string;
    qty?: number;
    rate?: number;
    amount?: number;
    startCount?: number;
    endCount?: number;
    freeQty?: number;
  }[];
};

async function getOrCreateCustomer(input: CustomerInput) {
  const existing = await prisma.customer.findFirst({ where: { companyName: input.companyName } });
  if (existing) {
    return prisma.customer.update({ where: { id: existing.id }, data: input });
  }
  return prisma.customer.create({ data: input });
}

async function getOrCreateBranch(customerId: string, input: BranchInput) {
  const existing = await prisma.customerBranch.findFirst({
    where: { customerId, name: input.name }
  });
  if (existing) {
    return prisma.customerBranch.update({ where: { id: existing.id }, data: input });
  }
  return prisma.customerBranch.create({ data: { ...input, customerId } });
}

async function upsertTemplate(input: TemplateInput) {
  const template = await prisma.invoiceTemplate.upsert({
    where: { code: input.code },
    update: {
      name: input.name,
      customerId: input.customerId,
      branchId: input.branchId,
      billToName: input.billToName,
      billToAddress: input.billToAddress,
      billToGstin: input.billToGstin,
      billToState: input.billToState,
      billToStateCode: input.billToStateCode,
      placeLabel: input.placeLabel,
      machineModel: input.machineModel,
      poNumber: input.poNumber,
      taxMode: input.taxMode,
      isActive: true
    },
    create: {
      code: input.code,
      name: input.name,
      customerId: input.customerId,
      branchId: input.branchId,
      billToName: input.billToName,
      billToAddress: input.billToAddress,
      billToGstin: input.billToGstin,
      billToState: input.billToState,
      billToStateCode: input.billToStateCode,
      placeLabel: input.placeLabel,
      machineModel: input.machineModel,
      poNumber: input.poNumber,
      taxMode: input.taxMode
    }
  });

  await prisma.invoiceTemplateItem.deleteMany({ where: { templateId: template.id } });
  await prisma.invoiceTemplateItem.createMany({
    data: input.items.map((item, index) => ({
      templateId: template.id,
      srNo: item.srNo,
      branchId: item.branchId,
      itemType: item.itemType,
      particulars: item.particulars,
      sacCode: item.sacCode ?? "997314",
      uom: item.uom ?? "",
      qty: item.qty ?? 0,
      rate: item.rate ?? 0,
      amount: item.amount ?? 0,
      startCount: item.startCount,
      endCount: item.endCount,
      freeQty: item.freeQty,
      sortOrder: index + 1
    }))
  });
}

function fixedRental(particulars: string, amount: number, branchId?: string, srNo = 1) {
  return {
    srNo,
    branchId,
    itemType: TemplateItemType.FIXED,
    particulars,
    sacCode: "997314",
    uom: "",
    qty: 1,
    rate: amount,
    amount
  };
}

async function main() {
  const ch = await getOrCreateCustomer({
    companyName: "C H Robinson Worldwide Freight India Pvt Ltd",
    gstin: "27AACCC9617L1ZA",
    state: "Maharashtra",
    stateCode: "27"
  });

  const elementis = await getOrCreateCustomer({
    companyName: "Elementis Specialties (India) Pvt. Ltd.",
    gstin: "27AACCE7554Q1ZY",
    state: "Maharashtra",
    stateCode: "27"
  });

  const nbs = await getOrCreateCustomer({
    companyName: "NBS INTERNATIONAL LTD",
    gstin: "27AAACN3646E1ZN",
    state: "Maharashtra",
    stateCode: "27"
  });

  const epl = await getOrCreateCustomer({
    companyName: "EPL LIMITED",
    gstin: "27AAACE1568L2ZF",
    state: "Maharashtra",
    stateCode: "27"
  });

  const chAndheri = await getOrCreateBranch(ch.id, {
    name: "Andheri - Fulcrum",
    address: "Fulcrum Unit No. 2 B Wing, Hiranandani Business Park, Sahar Road, Andheri East, Mumbai - 400099",
    city: "Mumbai",
    state: "Maharashtra",
    stateCode: "27"
  });
  const chTaloja = await getOrCreateBranch(ch.id, {
    name: "Taloja",
    address: "Fulcrum Unit No. 2 B Wing, Hiranandani Business Park, Sahar Road, Andheri East, Mumbai - 400099",
    city: "Taloja",
    state: "Maharashtra",
    stateCode: "27"
  });
  const chPune = await getOrCreateBranch(ch.id, {
    name: "Pune - Vascon Eco Tower",
    address: "Delivery Address 402, Vascon Eco Tower, Baner Pashan Link Road, Pune - 411045",
    city: "Pune",
    state: "Maharashtra",
    stateCode: "27"
  });
  const chHyderabad = await getOrCreateBranch(ch.id, {
    name: "Hyderabad",
    address: "Flat No. 1310/1, 12th Floor, Level-13, Vasavi MPM Grand, Ameerpet, Hyderabad, Telangana - 500073",
    city: "Hyderabad",
    state: "Telangana",
    stateCode: "36"
  });
  const chGurgaon = await getOrCreateBranch(ch.id, {
    name: "Gurgaon",
    address: "701, 7th Floor, Tower 48 I, DLF Corporate Park, Sector 24, Gurgaon, Haryana - 122002",
    city: "Gurgaon",
    state: "Haryana",
    stateCode: "06"
  });

  const elementisTaloja = await getOrCreateBranch(elementis.id, {
    name: "Taloja MIDC",
    address: "Plot - T29 & T29 (Part), Ghot & Tondre, Taloja MIDC, Raigad - 410208",
    city: "Raigad",
    state: "Maharashtra",
    stateCode: "27"
  });

  const nbsCharni = await getOrCreateBranch(nbs.id, {
    name: "Charni Road",
    address: "10 Stone Building, Opp. Chowpatty Sea Face, Charni Road, Mumbai - 400007",
    city: "Mumbai",
    state: "Maharashtra",
    stateCode: "27"
  });
  const nbsAndheri = await getOrCreateBranch(nbs.id, {
    name: "Andheri West",
    address: "S. V Road, Juhu Lane Junction, Andheri West, Mumbai - 400058",
    city: "Mumbai",
    state: "Maharashtra",
    stateCode: "27"
  });
  const nbsKurla = await getOrCreateBranch(nbs.id, {
    name: "Kurla West",
    address: "Ground Floor, Kanakia Zillion, LBS Marg, Kurla West, Mumbai - 400070",
    city: "Mumbai",
    state: "Maharashtra",
    stateCode: "27"
  });
  const nbsSewri = await getOrCreateBranch(nbs.id, {
    name: "Sewri",
    address: "Signal Hill Avenue via Reay Road Station, Sewri, Mumbai - 400033",
    city: "Mumbai",
    state: "Maharashtra",
    stateCode: "27"
  });
  const nbsGoregaon = await getOrCreateBranch(nbs.id, {
    name: "Goregaon West",
    address: "Plot No. Ground Floor, Vinod Sanghi Marg, Off S. V. Road, Goregaon West, Mumbai - 400062",
    city: "Mumbai",
    state: "Maharashtra",
    stateCode: "27"
  });
  const eplLowerParel = await getOrCreateBranch(epl.id, {
    name: "Lower Parel",
    address: "Top Floor, Times Tower, Kamala Mill Comp, Senapati Bapat Marg, Lower Parel, Mumbai - 400013",
    city: "Mumbai",
    state: "Maharashtra",
    stateCode: "27"
  });

  const chRentalText = "Xerox Copy Print out of A/4 Size\nFor Photo Copy Print Out";
  const chColorText = "Xerox Copy Print out of A/4 Size\nFor photo Copy print, Out And Color, Scanning";

  await upsertTemplate({
    code: "CH-ANDHERI-2525",
    name: "CH Robinson - Andheri Model 2525",
    customerId: ch.id,
    branchId: chAndheri.id,
    billToName: ch.companyName,
    billToAddress: chAndheri.address,
    billToGstin: "27AACCC9617L1ZA",
    billToState: "Maharashtra",
    billToStateCode: "27",
    machineModel: "2525",
    taxMode: TaxMode.CGST_SGST,
    items: [fixedRental(chRentalText, 7000, chAndheri.id)]
  });
  await upsertTemplate({
    code: "CH-TALOJA",
    name: "CH Robinson - Taloja",
    customerId: ch.id,
    branchId: chTaloja.id,
    billToName: ch.companyName,
    billToAddress: chTaloja.address,
    billToGstin: "27AACCC9617L1ZA",
    billToState: "Maharashtra",
    billToStateCode: "27",
    placeLabel: "Taloja",
    taxMode: TaxMode.CGST_SGST,
    items: [fixedRental(chRentalText, 7000, chTaloja.id)]
  });
  await upsertTemplate({
    code: "CH-PUNE-2725",
    name: "CH Robinson - Pune Canon IR 2725",
    customerId: ch.id,
    branchId: chPune.id,
    billToName: ch.companyName,
    billToAddress: chPune.address,
    billToGstin: "27AACCC9617L1ZA",
    billToState: "Maharashtra",
    billToStateCode: "27",
    placeLabel: "Pune",
    machineModel: "Canon IR 2725 Printer",
    taxMode: TaxMode.CGST_SGST,
    items: [
      {
        srNo: 1,
        branchId: chPune.id,
        itemType: TemplateItemType.FIXED,
        particulars: "Model : Canon IR 2725 Printer\nFrom Date : {periodFrom} To Date : {periodTo}\nCanon Print Count 18%",
        amount: 6000,
        qty: 1,
        rate: 6000
      }
    ]
  });
  await upsertTemplate({
    code: "CH-HYDERABAD-2925",
    name: "CH Robinson - Hyderabad Model 2925",
    customerId: ch.id,
    branchId: chHyderabad.id,
    billToName: "C.H. Robinson Worldwide Freight (I) Pvt. Ltd.",
    billToAddress: chHyderabad.address,
    billToGstin: "36AACCC9617L1ZB",
    billToState: "Telangana",
    billToStateCode: "36",
    placeLabel: "Hyderabad",
    machineModel: "2925",
    taxMode: TaxMode.IGST,
    items: [fixedRental(chColorText, 6000, chHyderabad.id)]
  });
  await upsertTemplate({
    code: "CH-GURGAON",
    name: "CH Robinson - Gurgaon Haryana",
    customerId: ch.id,
    branchId: chGurgaon.id,
    billToName: ch.companyName,
    billToAddress: chGurgaon.address,
    billToGstin: "06AACCC9617L1ZE",
    billToState: "Haryana",
    billToStateCode: "06",
    placeLabel: "Delhi",
    taxMode: TaxMode.IGST,
    items: [fixedRental(chColorText, 7000, chGurgaon.id)]
  });
  await upsertTemplate({
    code: "CH-ANDHERI-2725",
    name: "CH Robinson - Andheri Model 2725",
    customerId: ch.id,
    branchId: chAndheri.id,
    billToName: ch.companyName,
    billToAddress: chAndheri.address,
    billToGstin: "27AACCC9617L1ZA",
    billToState: "Maharashtra",
    billToStateCode: "27",
    machineModel: "2725",
    taxMode: TaxMode.CGST_SGST,
    items: [fixedRental(chRentalText, 6000, chAndheri.id)]
  });

  await upsertTemplate({
    code: "CH-MH-CONSOLIDATED",
    name: "CH Robinson - Andheri, Pune & Taloja Consolidated",
    customerId: ch.id,
    branchId: chAndheri.id,
    billToName: ch.companyName,
    billToAddress: chAndheri.address,
    billToGstin: "27AACCC9617L1ZA",
    billToState: "Maharashtra",
    billToStateCode: "27",
    placeLabel: "Andheri / Pune / Taloja",
    taxMode: TaxMode.CGST_SGST,
    items: [
      fixedRental(`Andheri - Model 2525\n${chRentalText}`, 7000, chAndheri.id, 1),
      fixedRental(`Andheri - Model 2725\n${chRentalText}`, 6000, chAndheri.id, 2),
      fixedRental(`Taloja\n${chRentalText}`, 7000, chTaloja.id, 3),
      {
        srNo: 4,
        branchId: chPune.id,
        itemType: TemplateItemType.FIXED,
        particulars: "Pune - Canon IR 2725 Printer\nCanon Print Count 18%",
        amount: 6000,
        qty: 1,
        rate: 6000
      }
    ]
  });

  await prisma.invoiceTemplate.updateMany({
    where: { code: { in: ["CH-ANDHERI-2525", "CH-ANDHERI-2725", "CH-TALOJA", "CH-PUNE-2725"] } },
    data: { isActive: false }
  });

  await upsertTemplate({
    code: "ELEMENTIS-BW-2925",
    name: "Elementis - Black & White Xerox Machine",
    customerId: elementis.id,
    branchId: elementisTaloja.id,
    billToName: elementis.companyName,
    billToAddress: elementisTaloja.address,
    billToGstin: "27AACCE7554Q1ZY",
    billToState: "Maharashtra",
    billToStateCode: "27",
    machineModel: "Canon Machine 2925",
    poNumber: "819956 - 00084",
    taxMode: TaxMode.CGST_SGST,
    items: [fixedRental("Xerox Copy Print out of A/4 Size\nFor photo Copy print, Out And Color, Scanning\nPlant Unit", 7000, elementisTaloja.id)]
  });

  await upsertTemplate({
    code: "ELEMENTIS-COLOR-C3326",
    name: "Elementis - Color Xerox Machine C3326",
    customerId: elementis.id,
    branchId: elementisTaloja.id,
    billToName: elementis.companyName,
    billToAddress: elementisTaloja.address,
    billToGstin: "27AACCE7554Q1ZY",
    billToState: "Maharashtra",
    billToStateCode: "27",
    machineModel: "Canon Color Machine C3326",
    poNumber: "805695 - 00084",
    taxMode: TaxMode.CGST_SGST,
    items: [
      fixedRental("Color Machine C3326\nFixed Monthly Rental Charges", 5000, elementisTaloja.id),
      { srNo: 2, branchId: elementisTaloja.id, itemType: TemplateItemType.METER, particulars: "A4 Color print and Copy", rate: 4, startCount: 14379, endCount: 17053, freeQty: 1000 },
      { srNo: 3, branchId: elementisTaloja.id, itemType: TemplateItemType.METER, particulars: "A4 B/W print and Copy", rate: 0.65, startCount: 7043, endCount: 7791 },
      { srNo: 4, branchId: elementisTaloja.id, itemType: TemplateItemType.METER, particulars: "A3 Color print and Copy", rate: 4, startCount: 378, endCount: 416 },
      { srNo: 5, branchId: elementisTaloja.id, itemType: TemplateItemType.METER, particulars: "A3 B/W print and Copy", rate: 4, startCount: 117, endCount: 124 }
    ]
  });

  await upsertTemplate({
    code: "NBS-CONSOLIDATED",
    name: "NBS - Monthly Consolidated Bill",
    customerId: nbs.id,
    branchId: nbsAndheri.id,
    billToName: "NBS INTERNATIONAL Limited",
    billToAddress: nbsAndheri.address,
    billToGstin: "27AAACN3646E1ZN",
    billToState: "Maharashtra",
    billToStateCode: "27",
    taxMode: TaxMode.CGST_SGST,
    items: [
      fixedRental(`NBS INTERNATIONAL LTD, ${nbsCharni.address}\nThe Total Amount of Print Out, Photo Copy`, 6000, nbsCharni.id),
      fixedRental(`NBS INTERNATIONAL LTD, ${nbsAndheri.address}\nThe Total Amount of Print Out, Photo Copy`, 8000, nbsAndheri.id, 2),
      fixedRental(`NBS INTERNATIONAL LTD, ${nbsKurla.address}\nThe Total Amount of Print Out, Photo Copy`, 6000, nbsKurla.id, 3),
      fixedRental(`NBS INTERNATIONAL LTD, ${nbsSewri.address}\nThe Total Amount of Print Out, Photo Copy`, 6000, nbsSewri.id, 4),
      fixedRental(`NBS INTERNATIONAL LTD, ${nbsGoregaon.address}\nThe Total Amount of Print Out, Photo Copy`, 6000, nbsGoregaon.id, 5)
    ]
  });

  await upsertTemplate({
    code: "EPL-LOWER-PAREL",
    name: "EPL Ltd - Lower Parel",
    customerId: epl.id,
    branchId: eplLowerParel.id,
    billToName: "EPL LIMITED",
    billToAddress: eplLowerParel.address,
    billToGstin: "27AAACE1568L2ZF",
    billToState: "Maharashtra",
    billToStateCode: "27",
    taxMode: TaxMode.CGST_SGST,
    items: [fixedRental("Xerox Copy Print out of A/4 Size\nFor Photo Copy Print Out", 75000, eplLowerParel.id)]
  });

  console.log("Seeded invoice templates from uploaded PDF formats.");
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
