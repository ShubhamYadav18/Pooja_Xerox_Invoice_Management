import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(?:"(.*)"|(.*))$/);
  if (match) process.env[match[1]] = match[2] ?? match[3] ?? "";
}

async function verifySmtp(label: string, userKey: string, passKey: string) {
  const user = process.env[userKey]?.trim() || process.env.SMTP_USER?.trim() || "";
  const pass = (process.env[passKey]?.trim() || process.env.SMTP_PASS?.trim() || "").replace(/\s+/g, "");
  if (!user || !pass) return { label, configured: false, verified: false };
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || "465"),
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true,
    auth: { user, pass }
  });
  try {
    await transporter.verify();
    return { label, configured: true, verified: true };
  } catch (error) {
    return { label, configured: true, verified: false, error: error instanceof Error ? error.message : "SMTP verification failed" };
  }
}

async function main() {
  const token = process.env.WHATSAPP_META_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  let whatsApp: Record<string, unknown> = { configured: Boolean(token && phoneNumberId), verified: false };
  if (token && phoneNumberId) {
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}?fields=id`, { headers: { Authorization: `Bearer ${token}` } });
      whatsApp = { configured: true, verified: response.ok, status: response.status };
    } catch (error) {
      whatsApp = { configured: true, verified: false, error: error instanceof Error ? error.message : "WhatsApp verification failed" };
    }
  }
  console.log(JSON.stringify({
    smtp: [
      await verifySmtp("Pooja Xerox", "POOJA_XEROX_SMTP_USER", "POOJA_XEROX_SMTP_PASS"),
      await verifySmtp("Pooja Enterprises", "POOJA_ENTERPRISES_SMTP_USER", "POOJA_ENTERPRISES_SMTP_PASS")
    ],
    whatsApp,
    groqConfigured: Boolean(process.env.GROQ_API_KEY?.trim()),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim())
  }));
}

main().catch((error) => { console.error(error); process.exit(1); });
