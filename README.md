# Pooja Xerox Invoice Management

Production-grade invoice management web app for a Xerox/Printing business.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- TailwindCSS
- NextAuth
- Prisma ORM
- PostgreSQL
- jsPDF/html2canvas PDF export

## Features

- Admin login
- Dashboard with revenue, invoice and GST summaries
- Customer CRUD
- Unlimited customer branches
- Template-based invoice generation with automatic invoice numbering
- Invoice create, edit, delete, duplicate, preview, print and PDF download
- GST calculation with CGST/SGST defaults from settings
- Indian amount-in-words conversion
- Fixed A4 tax invoice template
- Settings-driven business name, GST number, terms, footer, stamp and signature
- Payment confirmation tracking
- Revenue, payment, GST and outstanding reports with CSV export
- Browser local invoice draft recovery

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
3. Run:

```bash
npm install
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

The app will run at `http://localhost:3000`.

## Production

Recommended deployment: Vercel for the app and Neon for PostgreSQL.

Set these environment variables in Vercel:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `AUTH_TRUST_HOST`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Run production database setup against Neon:

```bash
npm run prisma:prod:init
```

Then deploy with the default Vercel Next.js build command. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full checklist.

## Verification

Current checks passing:

```bash
npm run typecheck
npm run build
npm audit --omit=dev
```
