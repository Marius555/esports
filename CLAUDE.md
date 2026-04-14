# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run lint      # ESLint check
```

## Project Overview

This is an **Esports AI Oracle & Forecasting Tournament** platform. See `blueprint.md` for the full product specification, database schema, and implementation roadmap.

**Tiers:** Free (tournament access) · Premium $20/mo (AI insights via Gemini API)  
**Status:** Scaffolding complete. App Router in place with boilerplate landing .

## Tech Stack

- **Framework:** Next.js 16 with App Router — read `node_modules/next/dist/docs/` before writing any Next.js code
- **Styling:** Tailwind CSS v4 — uses `@import "tailwindcss"` syntax in CSS; theme defined via `@theme` block in `app/globals.css`, not a `tailwind.config.*` file
- **UI Components:** coss.com/ui (Base UI wrappers) — 53 components in `components/ui/`. Use the `coss` skill when building UI.
- **Backend/BaaS:** Appwrite via `node-appwrite` — **server-side only** (Server Actions or Route Handlers). No Appwrite in Client Components.
- **Auth:** `jose` for JWT signing/verification
- **Forms:** `react-hook-form` + `zod` — use Zod for all validation
- **Icons:** Lucide React + HugeIcons

## Architecture

```
app/                  # Next.js App Router pages and layouts
components/ui/        # coss.com/ui component wrappers (do not edit these)
hooks/                # Custom React hooks (use-media-query with breakpoints + useIsMobile)
lib/utils.ts          # cn() helper (clsx + tailwind-merge)
blueprint.md          # Product spec, DB schema, implementation phases
```

**Path alias:** `@/` maps to the repository root.

**Fonts:** Geist (sans), Geist Mono, and Inter loaded via `next/font/google` in `app/layout.tsx`. CSS variables: `--font-heading`, `--font-sans`, `--font-geist-sans`, `--font-geist-mono`.

## Critical Rules (from blueprint.md)

- **No client-side Appwrite** — all Appwrite calls go through Server Actions or Route Handlers only
- **Terminology:** Use "Forecasts," "Points," "Skill-based Competition" — never gambling terminology
- **Styling tone:** "GAMERY" aesthetic for esports context
- **Zod validation** everywhere — validate all inputs at the server boundary
