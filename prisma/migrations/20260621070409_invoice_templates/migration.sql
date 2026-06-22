-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('CGST_SGST', 'IGST');

-- CreateEnum
CREATE TYPE "TemplateItemType" AS ENUM ('FIXED', 'METER', 'EXTRA_COPY', 'TEXT');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "billToAddress" TEXT,
ADD COLUMN     "billToGstin" TEXT,
ADD COLUMN     "billToName" TEXT,
ADD COLUMN     "billToState" TEXT,
ADD COLUMN     "billToStateCode" TEXT,
ADD COLUMN     "billingMonth" TEXT,
ADD COLUMN     "billingPeriodFrom" TIMESTAMP(3),
ADD COLUMN     "billingPeriodTo" TIMESTAMP(3),
ADD COLUMN     "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "machineModel" TEXT,
ADD COLUMN     "placeLabel" TEXT,
ADD COLUMN     "poNumber" TEXT,
ADD COLUMN     "sourceTemplateId" TEXT,
ADD COLUMN     "taxMode" "TaxMode" NOT NULL DEFAULT 'CGST_SGST';

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "endCount" INTEGER,
ADD COLUMN     "itemType" "TemplateItemType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "startCount" INTEGER;

-- CreateTable
CREATE TABLE "InvoiceTemplate" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "branchId" TEXT,
    "billToName" TEXT NOT NULL,
    "billToAddress" TEXT NOT NULL,
    "billToGstin" TEXT,
    "billToState" TEXT NOT NULL,
    "billToStateCode" TEXT NOT NULL,
    "placeLabel" TEXT,
    "machineModel" TEXT,
    "poNumber" TEXT,
    "taxMode" "TaxMode" NOT NULL DEFAULT 'CGST_SGST',
    "cgstRate" DECIMAL(5,2) NOT NULL DEFAULT 9,
    "sgstRate" DECIMAL(5,2) NOT NULL DEFAULT 9,
    "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "srNo" INTEGER NOT NULL,
    "branchId" TEXT,
    "itemType" "TemplateItemType" NOT NULL DEFAULT 'FIXED',
    "particulars" TEXT NOT NULL,
    "sacCode" TEXT NOT NULL DEFAULT '997314',
    "uom" TEXT NOT NULL DEFAULT '',
    "qty" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "startCount" INTEGER,
    "endCount" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceTemplate_code_key" ON "InvoiceTemplate"("code");

-- CreateIndex
CREATE INDEX "InvoiceTemplate_customerId_idx" ON "InvoiceTemplate"("customerId");

-- CreateIndex
CREATE INDEX "InvoiceTemplate_branchId_idx" ON "InvoiceTemplate"("branchId");

-- CreateIndex
CREATE INDEX "InvoiceTemplateItem_templateId_idx" ON "InvoiceTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "InvoiceTemplateItem_branchId_idx" ON "InvoiceTemplateItem"("branchId");

-- CreateIndex
CREATE INDEX "Invoice_sourceTemplateId_idx" ON "Invoice"("sourceTemplateId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "InvoiceTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTemplate" ADD CONSTRAINT "InvoiceTemplate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTemplate" ADD CONSTRAINT "InvoiceTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "CustomerBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTemplateItem" ADD CONSTRAINT "InvoiceTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InvoiceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTemplateItem" ADD CONSTRAINT "InvoiceTemplateItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "CustomerBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
