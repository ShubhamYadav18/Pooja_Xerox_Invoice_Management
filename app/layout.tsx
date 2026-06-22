import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pooja Xerox Invoice Management",
  description: "Invoice, GST and customer management for Pooja Xerox"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
