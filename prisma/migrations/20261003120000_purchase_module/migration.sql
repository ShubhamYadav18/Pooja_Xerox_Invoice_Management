-- Additive purchase and supplier tables. Existing application tables and data are untouched.
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "state" TEXT NOT NULL DEFAULT 'Maharashtra',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierGstin" TEXT,
    "stateOfSupply" TEXT NOT NULL DEFAULT 'Maharashtra',
    "taxMode" "TaxMode" NOT NULL DEFAULT 'CGST_SGST',
    "taxableAmount" DECIMAL(12,2) NOT NULL,
    "cgstRate" DECIMAL(5,2) NOT NULL DEFAULT 9,
    "sgstRate" DECIMAL(5,2) NOT NULL DEFAULT 9,
    "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_profileId_name_key" ON "Supplier"("profileId", "name");
CREATE INDEX "Supplier_profileId_idx" ON "Supplier"("profileId");
CREATE UNIQUE INDEX "Purchase_profileId_supplierName_billNumber_key" ON "Purchase"("profileId", "supplierName", "billNumber");
CREATE INDEX "Purchase_profileId_billDate_idx" ON "Purchase"("profileId", "billDate");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BusinessProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BusinessProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
