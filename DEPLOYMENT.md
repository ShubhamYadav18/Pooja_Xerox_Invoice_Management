# Deploying to Vercel + Neon

This app is a full-stack Next.js app. It does not need a separate Render backend.

## 1. Create Neon Database

1. Create a Neon project.
2. Copy the pooled Prisma connection string from Neon.
3. Use that value as `DATABASE_URL` in Vercel.

The connection string should look like:

```text
postgresql://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require
```

## 2. Set Vercel Environment Variables

In Vercel Project Settings > Environment Variables, add these for Production:

```text
DATABASE_URL="your-neon-connection-string"
AUTH_SECRET="generate-a-long-random-secret"
AUTH_URL="https://your-vercel-domain.vercel.app"
AUTH_TRUST_HOST="true"
ADMIN_EMAIL="admin@poojaxerox"
ADMIN_PASSWORD="3647"
```

After the first deploy, update `AUTH_URL` to the final production URL or custom domain.

## 3. Initialize Neon Database

After setting `DATABASE_URL` locally to the Neon connection string, run:

```bash
npm run prisma:prod:init
```

This applies migrations, creates/updates the admin login, business settings, customers, and invoice templates.

## 4. Deploy on Vercel

Vercel settings:

- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`
- Output Directory: leave default

## 5. Verify Production

Open the Vercel URL and test:

1. Login with `admin@poojaxerox` / `3647`.
2. Create one invoice.
3. Open invoice detail.
4. Download PDF.
5. Confirm payment from Payments page.

## Notes

- Do not run `prisma migrate dev` against production.
- Use `npm run prisma:deploy` for production migrations.
- Use `npm run prisma:prod:init` only when setting up or reseeding the production database intentionally.
