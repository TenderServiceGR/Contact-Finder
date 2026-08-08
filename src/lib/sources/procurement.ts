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
  organizationVatNumber?: string;
  totalCostWithoutVAT?: number;
  budget?: number;
  contractSignedDate?: string;
  objectDetailsList?: { cpvs?: { key?: string; value?: string }[] }[];
  contractingDataDetails?: {
    contractingMembersDataList?: { vatNumber?: string; name?: string }[];
  };
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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Without an explicit date range, the ΚΗΜΔΗΣ API silently defaults to the
// last 180 days. We want a 3-year window by default instead, so both sides
// are always filled in explicitly before the request goes out.
function resolveDateRange(filters?: ProcurementFilters): Required<ProcurementFilters> {
  const now = new Date();
  const threeYearsAgo = new Date(now);
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  return {
    dateFrom: filters?.dateFrom ?? isoDate(threeYearsAgo),
    dateTo: filters?.dateTo ?? isoDate(now),
  };
}

export async function fetchFromProcurement(
  vat: string | undefined,
  filters?: ProcurementFilters
): Promise<ProcurementResult> {
  if (!vat) {
    return { status: "unavailable", summary: emptySummary() };
  }

  const { dateFrom, dateTo } = resolveDateRange(filters);

  if (!env.procurement.isConfigured) {
    return demoProcurementResult(vat, { dateFrom, dateTo });
  }

  try {
    const endpoint = `${env.procurement.baseUrl}/contract?page=0`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ vatNumber: vat, dateFrom, dateTo }),
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
    return { status: "ok", summary: summarizeAwards(activeContracts, vat) };
  } catch {
    return { status: "unavailable", summary: emptySummary() };
  }
}

function summarizeAwards(rawContracts: KhmdhsContract[], vat: string): ProcurementSummary {
  const awards: ProcurementAward[] = rawContracts.map((c) => {
    const members = c.contractingDataDetails?.contractingMembersDataList ?? [];
    // Prefer the member matching the searched contractor's ΑΦΜ — contracts
    // can have multiple members (consortiums) and the match isn't always first.
    const contractor = members.find((m) => m.vatNumber === vat) ?? members[0];
    return {
      title: c.title ?? "Contract",
      authority: c.organization?.value ?? "Unknown authority",
      value: Number(c.totalCostWithoutVAT ?? c.budget ?? 0) || undefined,
      date: c.contractSignedDate,
      cpv: c.objectDetailsList?.[0]?.cpvs?.[0]?.key,
      referenceNumber: c.referenceNumber,
      contractorName: contractor?.name?.trim(),
      authorityVat: c.organizationVatNumber,
    };
  });

  if (awards.length === 0) return { ...emptySummary(), available: false };

  const values = awards.map((a) => a.value ?? 0);
  const totalValue = values.reduce((sum, v) => sum + v, 0);
  const sorted = [...awards].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  // Undated contracts sort last so the count here still matches contractsAwarded.
  const byDate = [...awards].sort((a, b) => {
    if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : 0;
    return a.date > b.date ? -1 : 1;
  });
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
    awards: byDate,
    available: true,
  };
}

function emptySummary(): ProcurementSummary {
  return {
    contractingAuthorities: [],
    cpvCategories: [],
    awards: [],
    available: false,
  };
}

// --- Demo data ---
function demoProcurementResult(vat: string, filters?: ProcurementFilters): ProcurementResult {
  const monthsAgo = (m: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    return isoDate(d);
  };
  const contractingDataDetails = { contractingMembersDataList: [{ vatNumber: vat, name: "Demo Trading Single Member S.A." }] };
  const awards: KhmdhsContract[] = [
    { title: "Προμήθεια εξοπλισμού πληροφορικής", referenceNumber: "24SYMV009215539", organization: { value: "Δήμος Αθηναίων" }, organizationVatNumber: "090000001", totalCostWithoutVAT: 84500, contractSignedDate: monthsAgo(3), objectDetailsList: [{ cpvs: [{ key: "30200000-1" }] }], contractingDataDetails },
    { title: "Υπηρεσίες συντήρησης λογισμικού", referenceNumber: "23SYMV007123456", organization: { value: "Υπουργείο Ψηφιακής Διακυβέρνησης" }, organizationVatNumber: "090000002", totalCostWithoutVAT: 132000, contractSignedDate: monthsAgo(14), objectDetailsList: [{ cpvs: [{ key: "72267000-4" }] }], contractingDataDetails },
    { title: "Προμήθεια αναλωσίμων γραφείου", referenceNumber: "22SYMV004987654", organization: { value: "Περιφέρεια Αττικής" }, organizationVatNumber: "090000003", totalCostWithoutVAT: 21750, contractSignedDate: monthsAgo(30), objectDetailsList: [{ cpvs: [{ key: "30190000-7" }] }], contractingDataDetails },
  ];
  const { dateFrom, dateTo } = resolveDateRange(filters);
  const filtered = awards.filter((a) => {
    if (a.contractSignedDate && a.contractSignedDate < dateFrom) return false;
    if (a.contractSignedDate && a.contractSignedDate > dateTo) return false;
    return true;
  });
  return { status: "ok", summary: summarizeAwards(filtered, vat) };
}
