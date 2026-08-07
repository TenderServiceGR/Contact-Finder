import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Optional client for future enhancements from spec §11:
 * search history, favorites, monitoring for company changes.
 * Not wired into the search flow yet — `env.supabase.isConfigured`
 * guards every call site so the app runs fine without it.
 *
 * Suggested schema (run in the Supabase SQL editor once you're ready):
 *
 * create table search_history (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references auth.users,
 *   query_term text not null,
 *   query_type text not null,
 *   company_name text,
 *   vat text,
 *   created_at timestamptz default now()
 * );
 *
 * create table favorites (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references auth.users,
 *   vat text not null,
 *   company_name text,
 *   created_at timestamptz default now(),
 *   unique (user_id, vat)
 * );
 */
export const supabase = env.supabase.isConfigured
  ? createClient(env.supabase.url, env.supabase.anonKey)
  : null;
