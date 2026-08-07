# Company Intelligence & Contact Discovery

A Next.js app that takes a Greek company name or VAT number and returns one
merged profile: registry identity (ΓΕΜΗ), public contract history (ΚΗΜΔΗΣ),
and web presence (Google), plus an AI-generated summary, sales insights, and
risk flags.

Built directly from the project brief — the section numbers on the
"Company profile" screen (01–06) match §7 of the spec.

## Status

The app runs **fully click-through today with realistic demo data**. Every
external source is wired up with a real connector and falls back to demo
data automatically when its API key/config is missing, so you can try the
whole flow before connecting any live credentials. Search "Hellenic Cables
S.A." (or anything) to see it end to end.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- API route `POST /api/search` — queries all three sources in parallel, then
  calls the AI step (spec §8/§13)
- `@anthropic-ai/sdk` for the AI Summary / Sales Insights / Risk step
- `@supabase/supabase-js` — installed, not yet wired in (see Roadmap)

## Project layout

```
src/
  app/
    page.tsx                 search + results screen (client)
    api/search/route.ts      orchestrates gemi + procurement + google + AI
  components/                Section, Fact, Stamp, SearchForm, ResultsView
  lib/
    types.ts                 unified CompanyProfile model, all fields "Sourced"
    env.ts                   reads env vars, exposes isConfigured per source
    mergeData.ts             merge + risk-indicator logic (§6, §9)
    sources/gemi.ts          ΓΕΜΗ connector + demo fallback
    sources/procurement.ts   ΚΗΜΔΗΣ connector + demo fallback
    sources/google.ts        SerpAPI-compatible web search connector + demo fallback
    ai/insights.ts           Anthropic call for summary/insights + demo fallback
    supabase.ts              client stub for future persistence (unused today)
```

## Getting real data flowing

Copy `.env.example` to `.env.local` and fill in what you have — each source
is independent, so you can connect them one at a time:

1. **ΓΕΜΗ (registry)** — register at
   https://opendata.businessportal.gr/register/ for an `api_key`, set
   `GEMI_API_KEY`. Swagger docs: https://opendata-api.businessportal.gr/opendata/docs/.
   Once you have a key, open the Swagger UI and confirm the exact endpoint
   paths/response field names against `src/lib/sources/gemi.ts` — the
   connector follows the publicly documented shape but the live schema
   should be double-checked against your access tier.
2. **ΚΗΜΔΗΣ (procurement)** — public GET endpoints, no key needed today.
   Confirm the exact resource path at
   https://cerpp.eprocurement.gov.gr/khmdhs-opendata/help against
   `PROCUREMENT_BASE_URL` / `src/lib/sources/procurement.ts`.
3. **Google / web presence** — sign up for SerpAPI (or a compatible
   provider) and set `SERPAPI_KEY`.
4. **AI step** — set `ANTHROPIC_API_KEY` from
   https://console.anthropic.com. `ANTHROPIC_MODEL` defaults to
   `claude-sonnet-4-6`.

Nothing needs to be "all or nothing" — the merge logic and UI already handle
partial results and show a warning banner when a source is unavailable
(spec §9/§10).

## Running locally

```bash
npm install
npm run dev
```

## Deploying

This is a stock Next.js app, so it deploys to **Vercel** with no config:
push to a Git repo, import it in Vercel, and add the same environment
variables from `.env.example` in Project Settings → Environment Variables.

For **Supabase** (optional, powers the search-history/favorites roadmap
items): create a project, copy the URL and anon key into
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. A suggested
starter schema is in the comment block at the top of `src/lib/supabase.ts`.

Let me know your Supabase project URL/anon key or Vercel setup when you're
ready and I can wire up the persistence features and walk through the
deploy.

## Roadmap (spec §11, not built yet)

Export to Excel/PDF, CRM integration, search history, favorites, batch
search (Excel upload), AI-generated email drafts, contact scoring,
financial data integration, company comparison, change monitoring, tender
alerts.
