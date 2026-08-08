import { PDFParse } from "pdf-parse";
import { env } from "@/lib/env";

/**
 * ΚΗΜΔΗΣ contract PDFs are free-text legal documents, not structured data —
 * most don't mention a phone/email at all, and templates vary by authority.
 * When they do, each party's contact details sit right next to that party's
 * own ΑΦΜ (verified against real contracts from cerpp.eprocurement.gov.gr).
 * So instead of grabbing the first phone/email found anywhere in the text,
 * we anchor to the contractor's ΑΦΜ occurrences and require the match to be
 * closer to the contractor's ΑΦΜ than to the authority's — otherwise it's
 * almost certainly the authority's contact, and we skip it rather than
 * mislabel it.
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Loose candidate: a run of digits with optional space/dot/dash separators,
// long enough to contain a 10-digit Greek number once separators are stripped.
const PHONE_CANDIDATE_REGEX = /(?:\+?30[\s.-]?)?\b\d[\d\s.-]{7,14}\d\b/g;
const PROXIMITY_WINDOW = 500;

export interface ContractRef {
  referenceNumber: string;
  authorityVat?: string;
}

export interface ContractorContactResult {
  found: boolean;
  phone?: string;
  email?: string;
  referenceNumber?: string;
  checked: number;
}

export async function findContractorContact(vat: string, contracts: ContractRef[]): Promise<ContractorContactResult> {
  let checked = 0;
  for (const { referenceNumber, authorityVat } of contracts) {
    checked++;
    const text = await fetchContractText(referenceNumber);
    if (!text) continue;

    const match = extractContractorContact(text, vat, authorityVat);
    if (match.phone || match.email) {
      return { found: true, ...match, referenceNumber, checked };
    }
  }
  return { found: false, checked };
}

async function fetchContractText(referenceNumber: string): Promise<string | null> {
  try {
    const res = await fetch(`${env.procurement.baseUrl}/contract/attachment/${encodeURIComponent(referenceNumber)}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;

    const buf = new Uint8Array(await res.arrayBuffer());
    const parser = new PDFParse({ data: buf });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  } catch {
    return null;
  }
}

function extractContractorContact(text: string, vat: string, authorityVat?: string): { phone?: string; email?: string } {
  const contractorIdx = allIndicesOf(text, vat);
  if (contractorIdx.length === 0) return {};
  const authorityIdx = authorityVat ? allIndicesOf(text, authorityVat) : [];

  return {
    email: pickNearestToContractor(collectMatches(text, EMAIL_REGEX), contractorIdx, authorityIdx),
    phone: pickNearestToContractor(collectPhoneMatches(text), contractorIdx, authorityIdx),
  };
}

interface TextMatch {
  value: string;
  index: number;
}

function allIndicesOf(text: string, needle: string): number[] {
  const indices: number[] = [];
  let idx = text.indexOf(needle);
  while (idx !== -1) {
    indices.push(idx);
    idx = text.indexOf(needle, idx + 1);
  }
  return indices;
}

function collectMatches(text: string, regex: RegExp): TextMatch[] {
  const matches: TextMatch[] = [];
  let m: RegExpExecArray | null;
  regex.lastIndex = 0;
  while ((m = regex.exec(text))) {
    matches.push({ value: m[0], index: m.index });
  }
  return matches;
}

function collectPhoneMatches(text: string): TextMatch[] {
  const matches: TextMatch[] = [];
  for (const candidate of collectMatches(text, PHONE_CANDIDATE_REGEX)) {
    const digits = candidate.value.replace(/\D/g, "");
    const normalized = digits.length === 12 && digits.startsWith("30") ? digits.slice(2) : digits;
    if (normalized.length === 10 && (normalized.startsWith("2") || normalized.startsWith("69"))) {
      matches.push({ value: normalized, index: candidate.index });
    }
  }
  return matches;
}

function pickNearestToContractor(matches: TextMatch[], contractorIdx: number[], authorityIdx: number[]): string | undefined {
  let best: { value: string; dist: number } | undefined;
  for (const m of matches) {
    const distToContractor = Math.min(...contractorIdx.map((v) => Math.abs(m.index - v)));
    if (distToContractor > PROXIMITY_WINDOW) continue;
    const distToAuthority = authorityIdx.length ? Math.min(...authorityIdx.map((v) => Math.abs(m.index - v))) : Infinity;
    if (distToAuthority < distToContractor) continue;
    if (!best || distToContractor < best.dist) best = { value: m.value, dist: distToContractor };
  }
  return best?.value;
}
