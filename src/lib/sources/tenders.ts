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
 *
 * Relevance: CPV codes from the company's own past contracts are the
 * strongest signal, then the primary ΚΑΔ, then secondary ΚΑΔ; deeper CPV
 * prefixes (more specific mapping entries) score higher. Two queries run in
 * parallel — one for past + primary codes, one for secondary codes — so the
 * best candidates are not crowded out by the API's own result order.
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
// 3,300 codes), so each query is capped.
const MAX_CPV_CODES = 2500;
const PUBLISHED_WINDOW_DAYS = 120;
const PRIMARY_PAGES = 4;
const SECONDARY_PAGES = 2;
const MAX_RESULTS = 60;

// Score weights.
const W_PAST_EXACT = 6;
const W_PAST_CLASS = 4; // shares the first 4 CPV digits with a past contract
const W_PRIMARY = 3;
const STRONG_SCORE = 6;
const NARROW_PREFIX_CODES = 60; // a prefix covering this few CPV codes counts as specific

export interface KadInput {
  /** Raw ΚΑΔ string as stored on the profile, e.g. "46.90 - Μη εξειδικευμένο…". */
  value: string;
  primary: boolean;
}

function kadDigits(raw: string): string | undefined {
  const m = raw.match(/\d{2}(?:[.\s]?\d{1,2}){0,3}/);
  return m ? m[0].replace(/\D/g, "") : undefined;
}

interface CodeInfo {
  /** Length of the longest mapping prefix that produced this code (2 = division … 5). */
  depth: number;
  primary: boolean;
}

export interface ResolvedCpvs {
  /** Past contracts + primary ΚΑΔ codes (best candidates), capped. */
  tier1: string[];
  /** Secondary ΚΑΔ codes not already in tier 1, capped. */
  tier2: string[];
  kadCodes: Map<string, CodeInfo>;
  pastExact: Set<string>;
  pastClass: Set<string>;
  mappedKads: string[];
  unmappedKads: string[];
}

/** Expands the company's ΚΑΔ and past-contract CPV codes into exact CPV codes to query. */
export function resolveCpvCodes(kads: KadInput[], pastCpvs: string[] = []): ResolvedCpvs {
  const kadCodes = new Map<string, CodeInfo>();
  const mappedKads: string[] = [];
  const unmappedKads: string[] = [];

  for (const kad of kads) {
    const digits = kadDigits(kad.value);
    const hit = digits ? lookupKadPrefixes(digits) : undefined;
    if (!hit || hit.prefixes.length === 0) {
      unmappedKads.push(kad.value);
      continue;
    }
    mappedKads.push(kad.value);
    for (const prefix of hit.prefixes) {
      const codes = ALL_CPV.filter((code) => code.startsWith(prefix));
      // A short prefix that covers only a handful of codes (e.g. "791" = legal
      // services) is as specific as a long one, so don't mark it down.
      const depth = codes.length <= NARROW_PREFIX_CODES ? Math.max(prefix.length, 4) : prefix.length;
      for (const code of codes) {
        const cur = kadCodes.get(code);
        kadCodes.set(code, {
          depth: Math.max(cur?.depth ?? 0, depth),
          primary: (cur?.primary ?? false) || kad.primary,
        });
      }
    }
  }

  const pastExact = new Set(pastCpvs.filter((c) => c in CPV_LABELS));
  const pastClassPrefixes = new Set([...pastExact].map((c) => c.slice(0, 4)));
  const pastClass = new Set(ALL_CPV.filter((c) => pastClassPrefixes.has(c.slice(0, 4)) && !pastExact.has(c)));

  const tier1 = new Set<string>([...pastExact, ...pastClass]);
  for (const [code, info] of kadCodes) if (info.primary) tier1.add(code);
  const tier2 = [...kadCodes.keys()].filter((c) => !tier1.has(c));

  return {
    tier1: [...tier1].slice(0, MAX_CPV_CODES),
    tier2: tier2.slice(0, MAX_CPV_CODES),
    kadCodes,
    pastExact,
    pastClass,
    mappedKads,
    unmappedKads,
  };
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

async function searchNotices(
  codes: string[],
  maxPages: number
): Promise<{ notices: KhmdhsNotice[]; total: number; failed: boolean }> {
  if (codes.length === 0) return { notices: [], total: 0, failed: false };

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - PUBLISHED_WINDOW_DAYS);
  const body = JSON.stringify({
    cpvItems: codes,
    dateFrom: isoDate(from),
    dateTo: isoDate(now),
    finalDateFrom: athensNow(),
  });

  async function page(n: number): Promise<KhmdhsNoticeResponse | "empty" | "error"> {
    try {
      const res = await fetch(`${env.procurement.baseUrl}/notice?page=${n}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body,
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
  if (first === "error") return { notices: [], total: 0, failed: true };
  if (first === "empty") return { notices: [], total: 0, failed: false };

  const rest = await Promise.all(
    Array.from({ length: Math.max(0, Math.min(first.totalPages ?? 1, maxPages) - 1) }, (_, i) => page(i + 1))
  );
  const pages = [first, ...rest];
  return {
    notices: pages.flatMap((r) => (typeof r === "string" ? [] : (r.content ?? []))),
    total: first.totalElements ?? 0,
    failed: false,
  };
}

export async function fetchRelevantTenders(kads: KadInput[], pastCpvs: string[] = []): Promise<TenderMatchResult> {
  const resolved = resolveCpvCodes(kads, pastCpvs);
  const base: TenderMatchResult = {
    status: "ok",
    tenders: [],
    totalOpen: 0,
    cpvCodesQueried: resolved.tier1.length + resolved.tier2.length,
    mappedKads: resolved.mappedKads,
    unmappedKads: resolved.unmappedKads,
    usedPastContracts: resolved.pastExact.size > 0,
  };

  if (resolved.tier1.length + resolved.tier2.length === 0) return base;
  if (!env.procurement.isConfigured) return { ...base, ...demoTenders() };

  const [t1, t2] = await Promise.all([
    searchNotices(resolved.tier1, PRIMARY_PAGES),
    searchNotices(resolved.tier2, SECONDARY_PAGES),
  ]);
  if (t1.failed && t2.failed) return { ...base, status: "unavailable" };

  const queried = new Set([...resolved.tier1, ...resolved.tier2]);
  const seen = new Set<string>();
  const tenders: OpenTender[] = [];

  for (const n of [...t1.notices, ...t2.notices]) {
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
    const matched = [...noticeCpvs.keys()].filter((k) => queried.has(k));
    if (matched.length === 0) continue;

    const { score, reasons } = scoreTender(matched, resolved);

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
      primaryMatch: matched.some((k) => resolved.kadCodes.get(k)?.primary),
      score,
      strength: score >= STRONG_SCORE ? "strong" : "possible",
      reasons,
    });
  }

  tenders.sort((a, b) => b.score - a.score || (a.deadline ?? "").localeCompare(b.deadline ?? ""));

  return { ...base, tenders: tenders.slice(0, MAX_RESULTS), totalOpen: t1.total + t2.total };
}

function scoreTender(matched: string[], r: ResolvedCpvs): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (matched.some((c) => r.pastExact.has(c))) {
    score += W_PAST_EXACT;
    reasons.push("Same CPV code as a contract the company has won");
  } else if (matched.some((c) => r.pastClass.has(c))) {
    score += W_PAST_CLASS;
    reasons.push("Close to a CPV category the company has won before");
  }

  const kadMatches = matched.map((c) => r.kadCodes.get(c)).filter((i): i is CodeInfo => Boolean(i));
  if (kadMatches.length > 0) {
    const primary = kadMatches.some((i) => i.primary);
    if (primary) {
      score += W_PRIMARY;
      reasons.push("Matches the primary ΚΑΔ");
    } else {
      reasons.push("Matches a secondary ΚΑΔ");
    }
    // Deeper mapping prefix = more specific ΚΑΔ→CPV entry (3 digits → 2 … 5 digits → 4).
    score += Math.max(...kadMatches.map((i) => i.depth)) - 1;
    score += Math.min(kadMatches.length - 1, 2);
  }

  return { score, reasons };
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
      score: 8,
      strength: "strong",
      reasons: ["Matches the primary ΚΑΔ"],
    },
  ];
  return { tenders, totalOpen: tenders.length };
}
