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
 * Requires an api_key obtained via https://opendata.businessportal.gr/register/
 *
 * The exact response schema depends on your registered API version — the
 * shape below follows the publicly documented "showCompany" / "searchCompany"
 * responses. Adjust field paths in `mapGemiResponse` once you have live
 * access and can confirm the payload against the Swagger UI.
 */

const src = (value: string): Sourced<string> => ({ value, source: "gemi", confidence: "official" });

export interface GemiResult {
  status: SourceStatus;
  identity: CompanyIdentity;
  contact: Partial<ContactInfo>;
  activity: Partial<BusinessActivity>;
  raw?: unknown;
}

export async function fetchFromGemi(query: { term: string; type: "name" | "vat" | "gemi" }): Promise<GemiResult> {
  if (!env.gemi.isConfigured) {
    return demoGemiResult(query);
  }

  try {
    const endpoint =
      query.type === "vat"
        ? `${env.gemi.baseUrl}/companies/search?vatNumber=${encodeURIComponent(query.term)}`
        : query.type === "gemi"
          ? `${env.gemi.baseUrl}/companies/${encodeURIComponent(query.term)}`
          : `${env.gemi.baseUrl}/companies/search?name=${encodeURIComponent(query.term)}`;

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${env.gemi.apiKey}`, "x-api-key": env.gemi.apiKey },
      next: { revalidate: 0 },
    });

    if (res.status === 404) {
      return { status: "not_found", identity: {}, contact: {}, activity: {} };
    }
    if (!res.ok) {
      return { status: "unavailable", identity: {}, contact: {}, activity: {} };
    }

    const data = await res.json();
    return mapGemiResponse(data);
  } catch {
    return { status: "unavailable", identity: {}, contact: {}, activity: {} };
  }
}

function mapGemiResponse(data: any): GemiResult {
  const company = Array.isArray(data?.results) ? data.results[0] : data;
  if (!company) return { status: "not_found", identity: {}, contact: {}, activity: {} };

  const identity: CompanyIdentity = {
    name: company.companyName ? src(company.companyName) : undefined,
    vat: company.vatNumber ? src(company.vatNumber) : undefined,
    gemiNumber: company.gemiNumber ? src(String(company.gemiNumber)) : undefined,
    legalForm: company.legalForm ? src(company.legalForm) : undefined,
    status: company.companyStatus ? src(company.companyStatus) : undefined,
    registrationDate: company.registrationDate ? src(company.registrationDate) : undefined,
  };

  const contact: Partial<ContactInfo> = {
    address: company.address ? src(company.address) : undefined,
    municipality: company.municipality ? src(company.municipality) : undefined,
    region: company.region ? src(company.region) : undefined,
  };

  const activity: Partial<BusinessActivity> = {
    primaryKad: company.primaryActivity ? src(company.primaryActivity) : undefined,
    secondaryKads: Array.isArray(company.secondaryActivities)
      ? company.secondaryActivities.map((a: string) => src(a))
      : [],
    chamber: company.chamber ? src(company.chamber) : undefined,
    representatives: Array.isArray(company.representatives)
      ? company.representatives.map((r: any) => ({
          value: { name: r.name, role: r.role },
          source: "gemi" as const,
          confidence: "official" as const,
        }))
      : [],
  };

  return { status: "ok", identity, contact, activity, raw: data };
}

// --- Demo data so the app is usable end-to-end without a live key ---
function demoGemiResult(query: { term: string; type: "name" | "vat" | "gemi" }): GemiResult {
  const name = query.type === "name" ? query.term : "Demo Trading Single Member S.A.";
  return {
    status: "ok",
    identity: {
      name: src(name),
      vat: src(query.type === "vat" ? query.term : "094014201"),
      gemiNumber: src(query.type === "gemi" ? query.term : "000237954001"),
      legalForm: src("Ανώνυμη Εταιρεία (Α.Ε.)"),
      status: src("Ενεργή"),
      registrationDate: src("2011-03-14"),
    },
    contact: {
      address: src("Λεωφόρος Κηφισίας 24, Μαρούσι"),
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
