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
  referenceNumber?: string;
  cancelled?: boolean;
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

export interface ProcurementFilters {
  /** Registration date in ΚΗΜΔΗΣ (YYYY-MM-DD), inclusive lower bound. */
  dateFrom?: string;
  /** Registration date in ΚΗΜΔΗΣ (YYYY-MM-DD), inclusive upper bound. */
  dateTo?: string;
}

export interface ProcurementResult {
  status: SourceStatus;
  summary: ProcurementSummary;
}

export async function fetchFromProcurement(
  vat: string | undefined,
  filters?: ProcurementFilters
): Promise<ProcurementResult> {
  if (!vat) {
    return { status: "unavailable", summary: emptySummary() };
  }

  if (!env.procurement.isConfigured) {
    return demoProcurementResult(vat, filters);
  }

  try {
    const endpoint = `${env.procurement.baseUrl}/contract?page=0`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        vatNumber: vat,
        ...(filters?.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters?.dateTo ? { dateTo: filters.dateTo } : {}),
      }),
      next: { revalidate: 0 },
    });

    if (res.status === 404) {
      return { status: "ok", summary: { ...emptySummary(), available: false } };
    }
    if (res.status === 429 || !res.ok) {
      return { status: "unavailable", summary: emptySummary() };
    }

    const data: KhmdhsContractResponse = await res.json();
    // The search API has no "exclude cancelled" flag — cancellations are
    // only filterable via a separate cancelDate range — so drop them here.
    const activeContracts = (data?.content ?? []).filter((c) => !c.cancelled);
    return { status: "ok", summary: summarizeAwards(activeContracts) };
  } catch {
    return { status: "unavailable", summary: emptySummary() };
  }
}

function summarizeAwards(rawContracts: KhmdhsContract[]): ProcurementSummary {
  const awards: ProcurementAward[] = rawContracts.map((c) => ({
    title: c.title ?? "Contract",
    authority: c.organization?.value ?? "Unknown authority",
    value: Number(c.totalCostWithoutVAT ?? c.budget ?? 0) || undefined,
    date: c.contractSignedDate,
    cpv: c.objectDetailsList?.[0]?.cpvs?.[0]?.key,
    referenceNumber: c.referenceNumber,
  }));

  if (awards.length === 0) return { ...emptySummary(), available: false };

  const values = awards.map((a) => a.value ?? 0);
  const totalValue = values.reduce((sum, v) => sum + v, 0);
  const sorted = [...awards].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const byDate = [...awards].filter((a) => a.date).sort((a, b) => (a.date! > b.date! ? -1 : 1));
  const years = awards.map((a) => (a.date ? new Date(a.date).getFullYear() : undefined)).filter(Boolean) as number[];

  return {
    contractsAwarded: awards.length,
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
function demoProcurementResult(vat: string, filters?: ProcurementFilters): ProcurementResult {
  const awards: KhmdhsContract[] = [
    { title: "Προμήθεια εξοπλισμού πληροφορικής", referenceNumber: "24SYMV009215539", organization: { value: "Δήμος Αθηναίων" }, totalCostWithoutVAT: 84500, contractSignedDate: "2024-11-02", objectDetailsList: [{ cpvs: [{ key: "30200000-1" }] }] },
    { title: "Υπηρεσίες συντήρησης λογισμικού", referenceNumber: "23SYMV007123456", organization: { value: "Υπουργείο Ψηφιακής Διακυβέρνησης" }, totalCostWithoutVAT: 132000, contractSignedDate: "2023-06-18", objectDetailsList: [{ cpvs: [{ key: "72267000-4" }] }] },
    { title: "Προμήθεια αναλωσίμων γραφείου", referenceNumber: "22SYMV004987654", organization: { value: "Περιφέρεια Αττικής" }, totalCostWithoutVAT: 21750, contractSignedDate: "2022-02-09", objectDetailsList: [{ cpvs: [{ key: "30190000-7" }] }] },
  ];
  const filtered = awards.filter((a) => {
    if (filters?.dateFrom && a.contractSignedDate && a.contractSignedDate < filters.dateFrom) return false;
    if (filters?.dateTo && a.contractSignedDate && a.contractSignedDate > filters.dateTo) return false;
    return true;
  });
  return { status: "ok", summary: summarizeAwards(filtered) };
}
