# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A Next.js app that takes a Greek company name or VAT number and returns one merged
profile: registry identity (ΓΕΜΗ), public contract history (ΚΗΜΔΗΣ), and web presence
(Google), plus an AI-generated summary/sales insights. Built directly from a project
brief — see README.md for the full spec-section mapping and per-source setup
instructions (API keys, endpoints).

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run lint      # eslint (flat config, eslint-config-next)
```

There is no test suite/script in this repo.

## Architecture

### Request flow

`src/app/page.tsx` (client) → `POST /api/search` (`src/app/api/search/route.ts`) →
fetches ΓΕΜΗ + Google in parallel, then ΚΗΜΔΗΣ (needs the VAT resolved from ΓΕΜΗ or
the query itself) → `mergeCompanyData` combines the three into one `CompanyProfile` →
`generateAiInsights` adds the AI summary → JSON returned to the client.

Two secondary API routes support the Public Procurement section of the results view
without a full re-search: `POST /api/procurement` (re-runs the ΚΗΜΔΗΣ query with a
different date range) and `POST /api/procurement/contact` (scans contract PDFs for a
contractor phone/email — see below).

### The connector + demo-fallback pattern

Every external source lives in `src/lib/sources/*.ts` and follows the same shape:

- A `fetchFromX()` function checks `env.x.isConfigured` (`src/lib/env.ts`) and, if no
  key/config is present, returns a `demoXResult()` instead of calling out. This is why
  the app is fully click-through with no credentials — every code path (including
  error/unavailable states) needs to stay meaningful in demo mode, not just the happy
  path.
- Live calls never throw outward: network errors and non-2xx responses collapse into a
  `SourceStatus` (`"ok" | "partial" | "unavailable" | "not_found"`) rather than an
  exception, so one flaky source degrades gracefully instead of failing the whole
  search.
- Each connector's live-mode field mapping is documented as "follows the publicly
  documented shape, confirm against Swagger/live access" — the ΓΕΜΗ and ΚΗΜΔΗΣ schemas
  in particular are unverified against a real API key/tenant, so double check field
  paths there before trusting them.

When adding a new connector, mirror this pattern (status enum, demo fallback, try/catch
around the fetch) rather than introducing a different error-handling style.

### Provenance model (`src/lib/types.ts`)

Nearly every leaf value in `CompanyProfile` is wrapped as `Sourced<T> = { value, source,
confidence? }` instead of a bare value, so the UI can always show which of
gemi/procurement/google/ai a fact came from (rendered via the `Stamp` component). When
adding a field that comes from an external source, wrap it in `Sourced<T>` using the
same `src()` helper convention each connector defines locally, rather than storing a
bare value.

### Merge + risk logic (`src/lib/mergeData.ts`)

`mergeCompanyData` is the single place that reconciles the three source payloads: ΓΕΜΗ
wins on identity/legal fields when there's a conflict, Google fills gaps for web
presence/contact info ΓΕΜΗ doesn't carry. It also derives `RiskIndicator[]` (missing
website, inactive registry status, no contact info, no procurement history, name/web
mismatch) — add new risk heuristics inside `computeRisks`, not in the UI layer.

### ΚΗΜΔΗΣ contract-PDF contact scraping (`src/lib/sources/procurementContact.ts`)

Contract PDFs are free-text, not structured, so contractor contact info is found by
proximity: locate the contractor's ΑΦΜ occurrences in the extracted text, then only
accept a phone/email match that is closer to the contractor's ΑΦΜ than to the
contracting authority's — otherwise the match is skipped rather than mislabeled. Keep
this proximity-based skip-over-guess behavior if touching this file.

### Config (`src/lib/env.ts`)

All env var access is centralized here; nothing throws at import time. Each source
exposes `isConfigured` which every connector checks before deciding live vs. demo mode.
`.env.example` documents every variable and where to obtain it — keep both in sync when
adding a new source or env var.

### Styling

Tailwind v4 with a custom "official document" theme (see `src/app/globals.css` for the
`ink` / `seal` / `paper` / `stamp-*` custom tokens and `font-display` / `font-data` font
roles) — reuse these tokens rather than introducing new ad hoc colors.

### Supabase

`src/lib/supabase.ts` is a configured-but-unwired client stub for future persistence
(search history/favorites) — not part of the current search flow.
