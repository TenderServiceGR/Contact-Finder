import { env } from "@/lib/env";
import cpvCodes from "@/data/cpv-codes.json";
import { lookupKadPrefixes } from "@/data/kad-cpv";
import type { OpenTender, TenderMatchResult } from "@/lib/types";

/**
 * Open tenders relevant to a company, found by mapping its ΚΑΔ to CPV codes
 * and searching ΚΗΜΔΗΣ notices (POST /notice) that are still accepting offers.
 *
 * The /notice search matches `cpvItems` by exact full code ("72262000-9"),
 * so ΚΑΔ → CPV *prefixes* (src/data/kad-cpv.ts) are expanded against the
 * official CPV list (src/data/cpv-codes.json) before querying.
 */

interface KhmdhsNotice {
  title?: string;
  referenceNumber?: string;
  cancelled?: boolean;
  finalSubmissionDate?: string;
  organization?: { key?: string; value?: string };
  typeOfProcedure?: { value?: string };
  contractType?: { value?: string };
  noticeType?: { value?: string };
  objectDetails?: { costWithoutVAT?: number; cpvs?: { key?: string; value?: string }[] }[];
}

interface KhmdhsNoticeResponse {
  content?: KhmdhsNotice[];
  totalElements?: number;
  totalPages?: number;
}

const CPV_LABELS = cpvCodes as Record<string, string>;
const ALL_CPV = Object.keys(CPV_LABELS);

// Large cpvItems arrays are accepted by the API but slow it down (~4s for
// 3,300 codes), so the query is capped, primary ΚΑΔ first.
const MAX_CPV_CODES = 2500;
const PUBLISHED_WINDOW_DAYS = 120;
const PAGES = 3;
const MAX_RESULTS = 40;

export interface KadInput {
  /** Raw ΚΑΔ string as stored on the profile, e.g. "46.90 - Μη εξειδικευμένο…". */
  value: string;
  primary: boolean;
}

function kadDigits(raw: string): string | undefined {
  const m = raw.match(/\d{2}(?:[.\s]?\d{1,2}){0,3}/);
  return m ? m[0].replace(/\D/g, "") : undefined;
}

/** Expands the company's ΚΑΔ into the exact CPV codes to query, primary first. */
export function resolveCpvCodes(kads: KadInput[]): {
  codes: string[];
  mappedKads: string[];
  unmappedKads: string[];
  primaryCodes: Set<string>;
} {
  const codes: string[] = [];
  const seen = new Set<string>();
  const primaryCodes = new Set<string>();
  const mappedKads: string[] = [];
  const unmappedKads: string[] = [];

  const ordered = [...kads].sort((a, b) => Number(b.primary) - Number(a.primary));
  for (const kad of ordered) {
    const digits = kadDigits(kad.value);
    const hit = digits ? lookupKadPrefixes(digits) : undefined;
    if (!hit || hit.prefixes.length === 0) {
      unmappedKads.push(kad.value);
      continue;
    }
    mappedKads.push(kad.value);
    for (const prefix of hit.prefixes) {
      for (const code of ALL_CPV) {
        if (!code.startsWith(prefix)) continue;
        if (kad.primary) primaryCodes.add(code);
        if (!seen.has(code) && codes.length < MAX_CPV_CODES) {
          seen.add(code);
          codes.push(code);
        }
      }
    }
  }
  return { codes, mappedKads, unmappedKads, primaryCodes };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// finalDateFrom is parsed as "yyyy-MM-dd HH:mm" in Greek local time.
function athensNow(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Athens",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export async function fetchRelevantTenders(kads: KadInput[]): Promise<TenderMatchResult> {
  const { codes, mappedKads, unmappedKads, primaryCodes } = resolveCpvCodes(kads);
  const base: TenderMatchResult = {
    status: "ok",
    tenders: [],
    totalOpen: 0,
    cpvCodesQueried: codes.length,
    mappedKads,
    unmappedKads,
  };

  if (codes.length === 0) return base;
  if (!env.procurement.isConfigured) return { ...base, ...demoTenders() };

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - PUBLISHED_WINDOW_DAYS);

  async function page(n: number): Promise<KhmdhsNoticeResponse | "empty" | "error"> {
    try {
      const res = await fetch(`${env.procurement.baseUrl}/notice?page=${n}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          cpvItems: codes,
          dateFrom: isoDate(from),
          dateTo: isoDate(now),
          finalDateFrom: athensNow(),
        }),
        next: { revalidate: 0 },
      });
      if (res.status === 404) return "empty";
      if (!res.ok) return "error";
      return (await res.json()) as KhmdhsNoticeResponse;
    } catch {
      return "error";
    }
  }

  const first = await page(0);
  if (first === "error") return { ...base, status: "unavailable" };
  if (first === "empty") return base;

  const rest = await Promise.all(
    Array.from({ length: Math.max(0, Math.min(first.totalPages ?? 1, PAGES) - 1) }, (_, i) => page(i + 1))
  );
  const notices = [first, ...rest].flatMap((r) => (typeof r === "string" ? [] : (r.content ?? [])));

  const querySet = new Set(codes);
  const seen = new Set<string>();
  const tenders: OpenTender[] = [];

  for (const n of notices) {
    if (n.cancelled || !n.referenceNumber) continue;
    // Amended notices are re-published under a new reference with the same title/deadline.
    const dedupeKey = `${n.organization?.key}|${n.title}|${n.finalSubmissionDate}`;
    if (seen.has(n.referenceNumber) || seen.has(dedupeKey)) continue;
    seen.add(n.referenceNumber);
    seen.add(dedupeKey);

    const noticeCpvs = new Map<string, string>();
    let budget = 0;
    for (const obj of n.objectDetails ?? []) {
      budget += obj.costWithoutVAT ?? 0;
      for (const c of obj.cpvs ?? []) if (c.key) noticeCpvs.set(c.key, c.value ?? CPV_LABELS[c.key] ?? "");
    }
    const matched = [...noticeCpvs.keys()].filter((k) => querySet.has(k));

    tenders.push({
      title: (n.title ?? "").trim() || "Untitled notice",
      referenceNumber: n.referenceNumber,
      authority: n.organization?.value ?? "Unknown authority",
      deadline: n.finalSubmissionDate,
      budget: budget || undefined,
      procedure: n.typeOfProcedure?.value,
      contractType: n.contractType?.value,
      noticeType: n.noticeType?.value,
      matchedCpvs: matched.map((code) => ({ code, label: noticeCpvs.get(code) || CPV_LABELS[code] || "" })),
      primaryMatch: matched.some((k) => primaryCodes.has(k)),
    });
  }

  // Best fit first: primary-ΚΑΔ matches, then more matched CPV codes, then soonest deadline.
  tenders.sort(
    (a, b) =>
      Number(b.primaryMatch) - Number(a.primaryMatch) ||
      b.matchedCpvs.length - a.matchedCpvs.length ||
      (a.deadline ?? "").localeCompare(b.deadline ?? "")
  );

  return { ...base, tenders: tenders.slice(0, MAX_RESULTS), totalOpen: first.totalElements ?? tenders.length };
}

// --- Demo data (only used if ΚΗΜΔΗΣ is ever made opt-in via isConfigured) ---
function demoTenders(): Pick<TenderMatchResult, "tenders" | "totalOpen"> {
  const inDays = (d: number) => {
    const t = new Date();
    t.setDate(t.getDate() + d);
    return t.toISOString().slice(0, 19);
  };
  const tenders: OpenTender[] = [
    {
      title: "Παροχή υπηρεσιών ανάπτυξης και συντήρησης λογισμικού",
      referenceNumber: "26PROC000000001",
      authority: "Δήμος Αθηναίων",
      deadline: inDays(12),
      budget: 120000,
      procedure: "Ανοιχτή διαδικασία",
      contractType: "Υπηρεσίες",
      matchedCpvs: [{ code: "72262000-9", label: CPV_LABELS["72262000-9"] ?? "" }],
      primaryMatch: true,
    },
  ];
  return { tenders, totalOpen: tenders.length };
}
