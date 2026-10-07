# Healthcare Practice Management

Next.js 16 · Tailwind CSS 4 · Radix primitives (shadcn-style components in `src/components/ui`) · TanStack Query · Zod · React Hook Form

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Demo

- On the sign-in page, use **Use the demo practice account**. Credentials live in `src/lib/auth.ts`.
- Sign up creates a local account (browser storage) and walks through verify email → practice setup → welcome → overview.
- Practice data is an in-memory database (`src/lib/db.ts`) behind simulated-latency API calls consumed through TanStack Query. It resets on page reload.
- The demo clock starts at 10:20 AM on Wed Oct 7, 2026 and advances in real time (wait times tick).
- Sign-in error states: wrong password → invalid credentials; an email containing `offline` → network error.

## Structure

- `src/app/(auth)` sign in, sign up, verify, setup, forgot / reset password, welcome
- `src/app/(app)` overview, calendar, patients, front desk, visits (+ injection plotting), follow-ups, reports, agents, practice configuration
- `src/components/app` shell, panels (appointment, new appointment / patient / follow-up / visit), EVI, global search
- `src/lib/insight.ts` EVI intent engine, agents, visit-preparation summaries (documented information only; no clinical recommendations)
- Logo: `public/logo.webp` is the supplied asset, unmodified; it is only cropped with CSS in `Logo`.
