const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen"
];

const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(num: number) {
  if (num < 20) return ones[num];
  return `${tens[Math.floor(num / 10)]} ${ones[num % 10]}`.trim();
}

function threeDigits(num: number) {
  const hundred = Math.floor(num / 100);
  const rest = num % 100;
  return `${hundred ? `${ones[hundred]} Hundred` : ""} ${rest ? twoDigits(rest) : ""}`.trim();
}

export function amountToIndianWords(value: number) {
  const rounded = Math.round(value);
  if (rounded === 0) return "Rupees Zero Only";

  const crore = Math.floor(rounded / 10000000);
  const lakh = Math.floor((rounded / 100000) % 100);
  const thousand = Math.floor((rounded / 1000) % 100);
  const hundred = rounded % 1000;

  const parts = [
    crore ? `${twoDigits(crore)} Crore` : "",
    lakh ? `${twoDigits(lakh)} Lakh` : "",
    thousand ? `${twoDigits(thousand)} Thousand` : "",
    hundred ? threeDigits(hundred) : ""
  ].filter(Boolean);

  return `Rupees ${parts.join(" ")} Only`;
}

export type InvoiceLineInput = {
  qty: number;
  rate: number;
};

export function calculateInvoiceTotals(
  items: InvoiceLineInput[],
  cgstRate = 9,
  sgstRate = 9,
  taxMode: "CGST_SGST" | "IGST" = "CGST_SGST",
  igstRate = 18
) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.qty * item.rate, 0));
  const cgstAmount = taxMode === "CGST_SGST" ? roundMoney((subtotal * cgstRate) / 100) : 0;
  const sgstAmount = taxMode === "CGST_SGST" ? roundMoney((subtotal * sgstRate) / 100) : 0;
  const igstAmount = taxMode === "IGST" ? roundMoney((subtotal * igstRate) / 100) : 0;
  const taxAmount = roundMoney(cgstAmount + sgstAmount + igstAmount);
  const grandTotal = roundMoney(subtotal + taxAmount);

  return {
    subtotal,
    cgstRate,
    sgstRate,
    igstRate: taxMode === "IGST" ? igstRate : 0,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    grandTotal,
    amountInWords: amountToIndianWords(grandTotal)
  };
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
