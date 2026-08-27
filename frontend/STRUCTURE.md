# Frontend Structure — platform-ui

> **Stack**: Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS v4 · shadcn/ui · Zod · React Hook Form

---

## Directory Tree

```
frontend/platform-ui/
├── app/
│   ├── layout.tsx              # Root layout: ThemeProvider, Toaster, global metadata
│   ├── page.tsx                # Root redirect → /dashboard
│   ├── globals.css             # Design tokens, Tailwind base, CSS variables (light/dark)
│   │
│   ├── (auth)/                 # Route group: unauthenticated shell (no sidebar)
│   │   ├── layout.tsx          # Centered card layout for auth pages
│   │   └── login/
│   │       └── page.tsx        # /login — email + password form
│   │
│   └── (app)/                  # Route group: authenticated shell (sidebar + topbar)
│       ├── layout.tsx          # AppLayout — sidebar nav, mobile drawer, topbar
│       ├── dashboard/
│       │   └── page.tsx        # /dashboard — KPI cards, recent scans, threat intel sync
│       ├── assets/
│       │   └── page.tsx        # /assets — asset CRUD table, risk scoring, findings drawer
│       ├── findings/
│       │   └── page.tsx        # /findings — findings list (placeholder, Week 4+)
│       ├── scans/
│       │   ├── page.tsx        # /scans — scan history table, "New Scan" trigger
│       │   └── [id]/
│       │       └── page.tsx    # /scans/:id — scan detail / results view
│       ├── reports/
│       │   └── page.tsx        # /reports — reports list (placeholder)
│       ├── integrations/
│       │   └── page.tsx        # /integrations — Jira, Slack, GitHub connectors (placeholder)
│       ├── settings/
│       │   └── page.tsx        # /settings — org settings, API keys (placeholder)
│       └── help/
│           └── page.tsx        # /help — onboarding, docs (placeholder)
│
├── components/
│   ├── login-form.tsx          # LoginForm — email/password + Zod validation
│   ├── mode-toggle.tsx         # Dark/light theme switcher (next-themes)
│   ├── theme-provider.tsx      # next-themes ThemeProvider wrapper
│   └── ui/                     # shadcn/ui primitives (auto-generated, do not hand-edit)
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── form.tsx
│       ├── input.tsx
│       └── label.tsx
│
├── lib/
│   └── utils.ts                # cn() — clsx + tailwind-merge class merger helper
│
├── public/                     # Static assets (favicon, images)
│
├── .husky/
│   └── pre-commit              # lint-staged: ESLint --fix + Prettier on staged files
│
├── .prettierrc.json            # Prettier config (prettier-plugin-tailwindcss for class sorting)
├── .prettierignore
├── eslint.config.mjs           # ESLint flat config: next/core-web-vitals + next/typescript
├── next.config.ts
├── tsconfig.json               # strict mode, noEmit, bundler resolution, @/* alias
├── postcss.config.mjs
├── components.json             # shadcn/ui registry config
└── package.json
```

---

## Route Map

| URL pattern      | Page file                          | Auth required | Notes                              |
|------------------|------------------------------------|---------------|------------------------------------|
| `/`              | `app/page.tsx`                     | –             | Redirects to `/dashboard`          |
| `/login`         | `app/(auth)/login/page.tsx`        | No            | JWT-based login (mock today)       |
| `/dashboard`     | `app/(app)/dashboard/page.tsx`     | Yes           | KPI summary, recent scans          |
| `/assets`        | `app/(app)/assets/page.tsx`        | Yes           | Full CRUD + risk scoring           |
| `/findings`      | `app/(app)/findings/page.tsx`      | Yes           | Findings list (stub Week 4)        |
| `/scans`         | `app/(app)/scans/page.tsx`         | Yes           | Scan list + new scan trigger       |
| `/scans/:id`     | `app/(app)/scans/[id]/page.tsx`    | Yes           | Scan detail / results              |
| `/reports`       | `app/(app)/reports/page.tsx`       | Yes           | Report generation (stub Week 7)    |
| `/integrations`  | `app/(app)/integrations/page.tsx`  | Yes           | Jira / Slack / GitHub (stub Wk 7) |
| `/settings`      | `app/(app)/settings/page.tsx`      | Yes           | Org & user settings                |
| `/help`          | `app/(app)/help/page.tsx`          | Yes           | Onboarding & docs                  |

---

## Component Inventory

| Component                   | Location                          | Purpose                                       |
|-----------------------------|-----------------------------------|-----------------------------------------------|
| `AppLayout`                 | `app/(app)/layout.tsx`            | Sidebar + topbar shell for authenticated app  |
| `LoginForm`                 | `components/login-form.tsx`       | Zod-validated email/password form             |
| `ModeToggle`                | `components/mode-toggle.tsx`      | Light/dark/system theme switcher              |
| `ThemeProvider`             | `components/theme-provider.tsx`   | next-themes wrapper                           |
| `Button`                    | `components/ui/button.tsx`        | shadcn Button with CVA variants               |
| `Card` / `CardContent` etc. | `components/ui/card.tsx`          | shadcn Card family                            |
| `Dialog`                    | `components/ui/dialog.tsx`        | shadcn Dialog (Radix Portal)                  |
| `Form` / `FormField` etc.   | `components/ui/form.tsx`          | shadcn Form + react-hook-form bindings        |
| `Input`                     | `components/ui/input.tsx`         | shadcn Input                                  |
| `Label`                     | `components/ui/label.tsx`         | shadcn Label                                  |

---

## Naming Conventions

| Thing              | Convention                              | Example                          |
|--------------------|-----------------------------------------|----------------------------------|
| Route pages        | `page.tsx` (lowercase dirs)             | `app/(app)/findings/page.tsx`    |
| Layouts            | `layout.tsx`                            | `app/(app)/layout.tsx`           |
| Feature components | PascalCase filename, named export       | `LoginForm`, `ModeToggle`        |
| shadcn primitives  | `components/ui/` — generated, no edits | `components/ui/button.tsx`       |
| Utilities          | camelCase in `lib/`                     | `lib/utils.ts`                   |
| Types / interfaces | PascalCase, co-located with usage       | `interface Asset { ... }`        |
| CSS variables      | `--color-*` in `globals.css`            | `--color-primary`, `--card`      |

---

## Toolchain Scripts (`package.json`)

| Script          | Command              | Purpose                                      |
|-----------------|----------------------|----------------------------------------------|
| `dev`           | `next dev`           | Start dev server (Turbopack)                 |
| `build`         | `next build`         | Production bundle                            |
| `start`         | `next start`         | Serve production build                       |
| `lint`          | `next lint`          | ESLint via next/core-web-vitals config       |
| `format`        | `prettier --write .` | Format all files (Tailwind class sorting)    |
| `format:check`  | `prettier --check .` | CI: verify formatting without writing        |
| `typecheck`     | `tsc --noEmit`       | TypeScript type-check without emitting       |
| `prepare`       | `husky`              | Install git hooks on `npm install`           |

---

## Pre-commit Hook (husky + lint-staged)

On every `git commit`, lint-staged runs:
- **`.{ts,tsx,js,jsx,mjs,cjs}`** → `eslint --fix` + `prettier --write`
- **`.{json,css,md}`** → `prettier --write`

Config lives in `package.json` under `"lint-staged"`.

---

## Adding New Routes (Checklist)

1. Create `app/(app)/<section>/page.tsx` (server component by default)
2. Add `"use client"` only if the page needs hooks or browser APIs
3. Register the nav item in `app/(app)/layout.tsx` → `navigation` array
4. Add a row to this file's Route Map table
5. Wire API calls via `lib/api/` (to be scaffolded Week 3)

## Adding New shadcn Components

```bash
npx shadcn@latest add <component-name>
```

Never hand-edit files in `components/ui/` — they are regenerated by shadcn CLI.
