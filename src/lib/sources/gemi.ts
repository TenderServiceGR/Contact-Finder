import { env } from "@/lib/env";
import type {
  CompanyIdentity,
  ContactInfo,
  BusinessActivity,
  SourceStatus,
  Sourced,
} from "@/lib/types";

/**
 * Connector for the ΓΕΜΗ (General Commercial Registry) Open Data API.
 * Docs: https://opendata-api.businessportal.gr/opendata/docs/
 * Spec: https://opendata-api.businessportal.gr/api-docs
 *
 * Auth: header `api_key: <GEMI_API_KEY>`.
 * Search by VAT: GET {baseUrl}/companies?afm={9-digit ΑΦΜ, zero-padded}.
 * Rate limit: 8 requests/minute. This connector is only ever called once
 * per search (see src/app/api/search/route.ts), so normal usage stays
 * well under that — no queuing/throttling is implemented here.
 */

const src = (value: string): Sourced<string> => ({ value, source: "gemi", confidence: "official" });

export interface GemiResult {
  status: SourceStatus;
  identity: CompanyIdentity;
  contact: Partial<ContactInfo>;
  activity: Partial<BusinessActivity>;
  raw?: unknown;
}

interface GemiCodeDescr {
  id?: number | string;
  descr?: string;
}

interface GemiCompany {
  arGemi?: number | string;
  afm?: string;
  coNameEl?: string;
  coTitlesEl?: string[];
  incorporationDate?: string;
  legalType?: GemiCodeDescr;
  status?: GemiCodeDescr;
  street?: string;
  streetNumber?: string;
  city?: string;
  zipCode?: string;
  url?: string;
  email?: string;
  municipality?: GemiCodeDescr;
  prefecture?: GemiCodeDescr;
}

interface GemiSearchResponse {
  searchResults?: GemiCompany[];
}

function padAfm(term: string): string {
  return term.replace(/\D/g, "").padStart(9, "0");
}

export async function fetchFromGemi(query: { term: string; type: "name" | "vat" | "gemi" }): Promise<GemiResult> {
  if (!env.gemi.isConfigured) {
    return demoGemiResult(query);
  }
  if (query.type !== "vat") {
    // Only VAT search is wired against the live API — the app's search
    // form is VAT-only today, so this path isn't reachable in practice.
    return { status: "unavailable", identity: {}, contact: {}, activity: {} };
  }

  try {
    const afm = padAfm(query.term);
    const endpoint = `${env.gemi.baseUrl}/companies?afm=${encodeURIComponent(afm)}`;
    const res = await fetch(endpoint, {
      headers: { api_key: env.gemi.apiKey, Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (res.status === 404) {
      return { status: "not_found", identity: {}, contact: {}, activity: {} };
    }
    if (!res.ok) {
      return { status: "unavailable", identity: {}, contact: {}, activity: {} };
    }

    const data: GemiSearchResponse = await res.json();
    const company = data?.searchResults?.[0];
    if (!company) {
      return { status: "not_found", identity: {}, contact: {}, activity: {} };
    }

    return mapGemiCompany(company, data);
  } catch {
    return { status: "unavailable", identity: {}, contact: {}, activity: {} };
  }
}

function mapGemiCompany(company: GemiCompany, raw: unknown): GemiResult {
  const identity: CompanyIdentity = {
    name: company.coNameEl ? src(company.coNameEl) : undefined,
    tradeName: company.coTitlesEl?.[0] ? src(company.coTitlesEl[0]) : undefined,
    vat: company.afm ? src(company.afm) : undefined,
    gemiNumber: company.arGemi !== undefined ? src(String(company.arGemi)) : undefined,
    legalForm: company.legalType?.descr ? src(company.legalType.descr) : undefined,
    status: company.status?.descr ? src(company.status.descr) : undefined,
    registrationDate: company.incorporationDate ? src(company.incorporationDate) : undefined,
  };

  const addressParts = [
    [company.street, company.streetNumber].filter(Boolean).join(" "),
    [company.zipCode, company.city].filter(Boolean).join(" "),
  ].filter(Boolean);

  const contact: Partial<ContactInfo> = {
    address: addressParts.length ? src(addressParts.join(", ")) : undefined,
    website: company.url ? src(normalizeUrl(company.url)) : undefined,
    emails: company.email ? [src(company.email)] : [],
    municipality: company.municipality?.descr ? src(company.municipality.descr) : undefined,
    region: company.prefecture?.descr ? src(company.prefecture.descr) : undefined,
  };

  return { status: "ok", identity, contact, activity: {}, raw };
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// --- Demo data so the app is usable end-to-end without a live key ---
function demoGemiResult(query: { term: string; type: "name" | "vat" | "gemi" }): GemiResult {
  const name = query.type === "name" ? query.term : "Demo Trading Single Member S.A.";
  return {
    status: "ok",
    identity: {
      name: src(name),
      tradeName: src("Demo Trading"),
      vat: src(query.type === "vat" ? query.term : "094014201"),
      gemiNumber: src(query.type === "gemi" ? query.term : "000237954001"),
      legalForm: src("Ανώνυμη Εταιρεία (Α.Ε.)"),
      status: src("Ενεργή"),
      registrationDate: src("2011-03-14"),
    },
    contact: {
      address: src("Λεωφόρος Κηφισίας 24, Μαρούσι"),
      website: src("https://www.example.gr"),
      emails: [src("info@example.gr")],
      municipality: src("Αμαρουσίου"),
      region: src("Αττικής"),
    },
    activity: {
      primaryKad: src("46.90 - Μη εξειδικευμένο χονδρικό εμπόριο"),
      secondaryKads: [src("62.01 - Δραστηριότητες προγραμματισμού Η/Υ")],
      chamber: src("Επιμελητήριο Αθηνών"),
      representatives: [
        { value: { name: "Ελένη Παπαδοπούλου", role: "Διευθύνων Σύμβουλος" }, source: "gemi", confidence: "official" },
        { value: { name: "Γιώργος Ιωάννου", role: "Μέλος Δ.Σ." }, source: "gemi", confidence: "official" },
      ],
    },
  };
}
