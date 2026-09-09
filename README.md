# e-OSR — Electronic Own Source Revenue Collection System

A web-based revenue collection and governance platform for Ugandan town councils and municipal authorities. It covers taxpayer registration, property billing, mobile-money payments, receipt/QR verification, arrears tracking, reconciliation, audit trails, council budgeting, spending, meetings, document management and role-based administration.

This project is built with **React 19**, **TanStack Start**, **TanStack Router**, **Tailwind CSS v4** and **Vite 7**, backed by **Supabase** (PostgreSQL + Auth + Storage) through Lovable Cloud.

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Clone the repository](#clone-the-repository)
3. [Install dependencies](#install-dependencies)
4. [Environment variables](#environment-variables)
5. [Run the development server](#run-the-development-server)
6. [Build for production](#build-for-production)
7. [Preview the production build](#preview-the-production-build)
8. [Database / backend setup](#database--backend-setup)
9. [Optional integrations](#optional-integrations)
10. [Default demo accounts](#default-demo-accounts)
11. [Project scripts](#project-scripts)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js** `>= 20` (LTS recommended)
- **Bun** `>= 1.1` — the project uses `bun`/`bunfig.toml` for package management and scripts
- **Git**
- A modern browser (Chrome, Firefox, Edge, Safari)
- (Optional) A Supabase/Lovable Cloud project if you want to connect your own backend

Install Bun if you do not have it:

```bash
curl -fsSL https://bun.sh/install | bash
```

Verify:

```bash
node --version   # v20.x.x or higher
bun --version    # 1.1.x or higher
```

---

## Clone the repository

```bash
git clone <repository-url>
cd tanstack_start_ts
```

---

## Install dependencies

```bash
bun install
```

This reads `bunfig.toml` and installs all packages listed in `package.json`.

If you ever need to refresh the lockfile:

```bash
rm bun.lock
bun install
```

---

## Environment variables

The application needs Supabase connection details. These are normally injected automatically when the project is connected to Lovable Cloud, but for a local copy you can create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-publishable-key>
VITE_SUPABASE_PROJECT_ID=<your-project-id>
```

You can also use the non-Vite-prefixed names if you are running server-side code outside Vite:

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<your-anon-publishable-key>
SUPABASE_PROJECT_ID=<your-project-id>
```

> **Security note:** Never commit `.env` files or real keys to Git. The repository already includes an `.env` file that is managed by the platform; replace the values only when running against your own backend.

---

## Run the development server

```bash
bun run dev
```

The Vite dev server starts on `http://localhost:8080` by default. Open that URL in your browser.

Hot Module Replacement (HMR) is enabled, so edits to React components, routes, styles and server functions update automatically.

> The service worker / PWA offline features are intentionally **disabled** in development to avoid stale caches. They only activate in production builds served on the public domain.

---

## Build for production

```bash
bun run build
```

This produces an optimized static + edge bundle in the `dist/` folder. The build also generates the service worker (`sw.js`) for offline support.

To build in development mode (useful for debugging):

```bash
bun run build:dev
```

---

## Preview the production build

```bash
bun run preview
```

This serves the production bundle locally so you can verify the PWA, service worker and production behaviour before publishing.

---

## Database / backend setup

The backend is Supabase, managed through Lovable Cloud.

1. Connect or create a Supabase project in Lovable Cloud.
2. Apply the migrations from `supabase/migrations/` in order.
3. Make sure Row Level Security (RLS) policies are enabled for every table.
4. Create the `council_documents` storage bucket with public/private rules if it does not exist.
5. Seed initial councils and roles if needed (the migrations contain starter data for several Ugandan councils).

If you are using the platform-managed backend, the migrations and environment variables are already applied.

---

## Optional integrations

The system can talk to real external services. These are **optional** — if the variables are missing, the relevant modules fall back to simulation.

| Integration | Purpose | Required environment variables |
|-------------|---------|-------------------------------|
| MTN MoMo sandbox | Request-to-pay mobile money collections | `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_API_USER`, `MTN_MOMO_API_KEY`, `MTN_MOMO_ENV` |
| Africa’s Talking | SMS receipts and reminders | `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID` |

Add them to `.env` only when you want live transactions or SMS:

```env
MTN_MOMO_SUBSCRIPTION_KEY=your-subscription-key
MTN_MOMO_API_USER=your-api-user
MTN_MOMO_API_KEY=your-api-key
MTN_MOMO_ENV=sandbox

AT_USERNAME=your-at-username
AT_API_KEY=your-at-api-key
AT_SENDER_ID=eOSR
```

---

## Default demo accounts

After the seed data is applied, the following accounts can be used for local testing. **Change these passwords before going live.**

| Email | Default password | Role |
|-------|------------------|------|
| `sysadmin@eosr.go.ug` | `EosrAdmin#2026` | System Administrator |

Council-specific admin/mayor accounts are created by the system administrator from the **Administration** module after a council has been registered.

---

## Project scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev | `bun run dev` | Start Vite dev server |
| Build | `bun run build` | Production build |
| Build (dev mode) | `bun run build:dev` | Production-style build in development mode |
| Preview | `bun run preview` | Preview production build |
| Lint | `bun run lint` | Run ESLint |
| Format | `bun run format` | Run Prettier on the whole project |

---

## Troubleshooting

### `Missing Supabase environment variable(s)`

The app cannot find `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY`. Create a `.env` file with the correct values, or reconnect Lovable Cloud.

### `bun install` fails with 401/403

If your workspace uses a private npm registry, make sure the correct token is configured in **Workspace Settings → Build Secrets** and referenced in `.npmrc`. Public packages should install without extra configuration.

### Browser shows a blank page or stale assets

- Hard-refresh with `Ctrl + Shift + R` (or `Cmd + Shift + R` on macOS).
- If previewing a production build, clear the service worker using `?sw=off` in the URL.

### Offline mode does not work locally

The service worker is disabled on `localhost` preview and Lovable preview hosts. It only activates on the published production domain.

### Type errors after editing

Run a typecheck:

```bash
bunx tsc --noEmit
```

Or use the faster project typecheck:

```bash
bunx tsgo --noEmit
```

---

## License

This is an academic / coursework project. Refer to the project brief or institution guidelines for licensing terms.
