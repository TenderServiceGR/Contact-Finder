import { env } from "@/lib/env";
import type { ProcurementAward, ProcurementSummary, SourceStatus } from "@/lib/types";

/**
 * Connector for ΚΗΜΔΗΣ (Central Electronic Registry of Public Procurement)
 * Open Data API. Docs: https://cerpp.eprocurement.gov.gr/khmdhs-opendata/help
 *
 * Contracts are queried via POST /khmdhs-opendata/contract?page=0 with a
 * JSON search body; `vatNumber` filters by the contractor's ΑΦΜ. No API
 * key is required for this read-only endpoint. A 404 response means no
 * contracts matched the criteria (not an error).
 */

interface KhmdhsContract {
  title?: string;
  organization?: { key?: string; value?: string };
  totalCostWithoutVAT?: number;
  budget?: number;
  contractSignedDate?: string;
  objectDetailsList?: { cpvs?: { key?: string; value?: string }[] }[];
}

interface KhmdhsContractResponse {
  content?: KhmdhsContract[];
  totalElements?: number;
}

export interface ProcurementResult {
  status: SourceStatus;
  summary: ProcurementSummary;
}

export async function fetchFromProcurement(vat: string | undefined): Promise<ProcurementResult> {
  if (!vat) {
    return { status: "unavailable", summary: emptySummary() };
  }

  if (!env.procurement.isConfigured) {
    return demoProcurementResult(vat);
  }

  try {
    const endpoint = `${env.procurement.baseUrl}/contract?page=0`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ vatNumber: vat }),
      next: { revalidate: 0 },
    });

    if (res.status === 404) {
      return { status: "ok", summary: { ...emptySummary(), available: false } };
    }
    if (res.status === 429 || !res.ok) {
      return { status: "unavailable", summary: emptySummary() };
    }

    const data: KhmdhsContractResponse = await res.json();
    return { status: "ok", summary: summarizeAwards(data?.content ?? [], data?.totalElements) };
  } catch {
    return { status: "unavailable", summary: emptySummary() };
  }
}

function summarizeAwards(rawContracts: KhmdhsContract[], totalElements?: number): ProcurementSummary {
  const awards: ProcurementAward[] = rawContracts.map((c) => ({
    title: c.title ?? "Contract",
    authority: c.organization?.value ?? "Unknown authority",
    value: Number(c.totalCostWithoutVAT ?? c.budget ?? 0) || undefined,
    date: c.contractSignedDate,
    cpv: c.objectDetailsList?.[0]?.cpvs?.[0]?.key,
  }));

  if (awards.length === 0) return { ...emptySummary(), available: false };

  const values = awards.map((a) => a.value ?? 0);
  const totalValue = values.reduce((sum, v) => sum + v, 0);
  const sorted = [...awards].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const byDate = [...awards].filter((a) => a.date).sort((a, b) => (a.date! > b.date! ? -1 : 1));
  const years = awards.map((a) => (a.date ? new Date(a.date).getFullYear() : undefined)).filter(Boolean) as number[];

  return {
    contractsAwarded: totalElements ?? awards.length,
    totalValue,
    averageValue: totalValue / awards.length,
    largestContract: sorted[0],
    latestContract: byDate[0],
    firstAwardYear: years.length ? Math.min(...years) : undefined,
    lastAwardYear: years.length ? Math.max(...years) : undefined,
    contractingAuthorities: [...new Set(awards.map((a) => a.authority))],
    cpvCategories: [...new Set(awards.map((a) => a.cpv).filter(Boolean) as string[])],
    recentAwards: byDate.slice(0, 5),
    available: true,
  };
}

function emptySummary(): ProcurementSummary {
  return {
    contractingAuthorities: [],
    cpvCategories: [],
    recentAwards: [],
    available: false,
  };
}

// --- Demo data ---
function demoProcurementResult(vat: string): ProcurementResult {
  const awards: ProcurementAward[] = [
    { title: "Προμήθεια εξοπλισμού πληροφορικής", authority: "Δήμος Αθηναίων", value: 84500, date: "2024-11-02", cpv: "30200000" },
    { title: "Υπηρεσίες συντήρησης λογισμικού", authority: "Υπουργείο Ψηφιακής Διακυβέρνησης", value: 132000, date: "2023-06-18", cpv: "72267000" },
    { title: "Προμήθεια αναλωσίμων γραφείου", authority: "Περιφέρεια Αττικής", value: 21750, date: "2022-02-09", cpv: "30190000" },
  ];
  return { status: "ok", summary: { ...summarizeAwards(awards), available: true } };
}
