import { supabase } from "@/lib/supabase";

/**
 * Persists contractor contact details found via the ΚΗΜΔΗΣ document scan
 * (see `src/lib/sources/procurementContact.ts`) into a Supabase table
 * named `contractor_db`, keyed by VAT so repeat lookups refresh the same
 * row instead of piling up duplicates.
 *
 * Run once in the Supabase SQL editor to set this up:
 *
 * create table contractor_db (
 *   id uuid primary key default gen_random_uuid(),
 *   vat text not null unique,
 *   contractor_name text,
 *   contractor_email text,
 *   contractor_phone text,
 *   updated_at timestamptz not null default now()
 * );
 *
 * alter table contractor_db enable row level security;
 *
 * create policy "Server can upsert contractor contacts"
 *   on contractor_db
 *   for all
 *   to anon
 *   using (true)
 *   with check (true);
 *
 * Like every other Supabase call site in this app, this is a no-op when
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY aren't set —
 * the contact lookup itself still works, it just isn't persisted.
 */
export interface ContractorContactRecord {
  vat: string;
  contractorName?: string;
  contractorEmail?: string;
  contractorPhone?: string;
}

export async function saveContractorContact(record: ContractorContactRecord): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.from("contractor_db").upsert(
      {
        vat: record.vat,
        contractor_name: record.contractorName ?? null,
        contractor_email: record.contractorEmail ?? null,
        contractor_phone: record.contractorPhone ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "vat" }
    );
  } catch (err) {
    // Persistence is a best-effort side effect — never fail the lookup
    // response over a storage hiccup.
    console.error("Failed to save contractor contact:", err);
  }
}

export interface StoredContractorContact {
  vat: string;
  contractorName: string | null;
  contractorEmail: string | null;
  contractorPhone: string | null;
  updatedAt: string;
}

export async function listContractorContacts(): Promise<StoredContractorContact[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("contractor_db")
      .select("vat, contractor_name, contractor_email, contractor_phone, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Failed to list contractor contacts:", error);
      return [];
    }

    return (data ?? []).map((row) => ({
      vat: row.vat,
      contractorName: row.contractor_name,
      contractorEmail: row.contractor_email,
      contractorPhone: row.contractor_phone,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    console.error("Failed to list contractor contacts:", err);
    return [];
  }
}
