-- CreateEnum
CREATE TYPE "InvoiceFormat" AS ENUM ('POOJA_XEROX', 'POOJA_ENTERPRISES');

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "invoiceFormat" "InvoiceFormat" NOT NULL DEFAULT 'POOJA_XEROX',
    "invoiceNumberFloor" INTEGER NOT NULL DEFAULT 632,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN "profileId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "profileId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "profileId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceTemplate" ADD COLUMN "profileId" TEXT;

-- DropIndex
DROP INDEX "Invoice_invoiceNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_code_key" ON "BusinessProfile"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSettings_profileId_key" ON "BusinessSettings"("profileId");

-- CreateIndex
CREATE INDEX "Customer_profileId_idx" ON "Customer"("profileId");

-- CreateIndex
CREATE INDEX "Invoice_profileId_idx" ON "Invoice"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_profileId_invoiceNumber_key" ON "Invoice"("profileId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceTemplate_profileId_idx" ON "InvoiceTemplate"("profileId");

-- AddForeignKey
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BusinessProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BusinessProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTemplate" ADD CONSTRAINT "InvoiceTemplate_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BusinessProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
