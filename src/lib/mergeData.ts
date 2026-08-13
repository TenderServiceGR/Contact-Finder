import type {
  CompanyProfile,
  RiskIndicator,
  SourceStatus,
} from "@/lib/types";
import type { GemiResult } from "@/lib/sources/gemi";
import type { ProcurementResult } from "@/lib/sources/procurement";
import type { GoogleResult } from "@/lib/sources/google";

/**
 * Merge the three source payloads into one CompanyProfile.
 * Rule (spec §9/§13): official registry data (ΓΕΜΗ) wins on identity /
 * legal fields whenever there's a conflict; Google fills gaps for web
 * presence and contact details ΓΕΜΗ doesn't carry.
 */
export function mergeCompanyData(
  query: { term: string; type: "name" | "vat" | "gemi" },
  gemi: GemiResult,
  procurement: ProcurementResult,
  google: GoogleResult
): CompanyProfile {
  const warnings: string[] = [];

  const sourceStatus: Record<"gemi" | "procurement" | "google", SourceStatus> = {
    gemi: gemi.status,
    procurement: procurement.status,
    google: google.status,
  };

  if (gemi.status === "unavailable") warnings.push("Greek Business Registry (ΓΕΜΗ) was unavailable — showing partial results.");
  if (procurement.status === "unavailable") warnings.push("Public Procurement Portal (ΚΗΜΔΗΣ) was unavailable — showing partial results.");
  if (google.status === "unavailable") warnings.push("Web search results were unavailable — showing partial results.");

  const contact = {
    // GEMI's website is now a real registry field, not a Google guess.
    website: gemi.contact.website ?? google.contact.website,
    phones: [...(gemi.contact as any)?.phones ?? [], ...(google.contact.phones ?? [])],
    emails: [...(gemi.contact as any)?.emails ?? [], ...(google.contact.emails ?? [])],
    address: gemi.contact.address,
    municipality: gemi.contact.municipality,
    region: gemi.contact.region,
    mapsUrl: google.contact.mapsUrl,
  };

  const online = {
    linkedin: google.online.linkedin,
    facebook: google.online.facebook,
    description: google.online.description,
    latestNews: google.online.latestNews ?? [],
    certifications: google.online.certifications ?? [],
  };

  const activity = {
    primaryKad: gemi.activity.primaryKad,
    secondaryKads: gemi.activity.secondaryKads ?? [],
    products: [] as any[],
    services: [] as any[],
    chamber: gemi.activity.chamber,
    representatives: gemi.activity.representatives ?? [],
  };

  const profile: CompanyProfile = {
    query,
    identity: gemi.identity,
    contact,
    online,
    activity,
    procurement: procurement.summary,
    ai: {},
    risks: [],
    sourceStatus,
    warnings,
    fetchedAt: new Date().toISOString(),
  };

  profile.risks = computeRisks(profile);
  return profile;
}

function computeRisks(profile: CompanyProfile): RiskIndicator[] {
  const risks: RiskIndicator[] = [];

  if (!profile.contact.website) {
    risks.push({ code: "website_missing", label: "No official website found", severity: "medium" });
  }
  if (profile.identity.status && !/ενεργ|active/i.test(profile.identity.status.value)) {
    risks.push({ code: "company_inactive", label: `Registry status: ${profile.identity.status.value}`, severity: "high" });
  }
  if (profile.contact.phones.length === 0 && profile.contact.emails.length === 0) {
    risks.push({ code: "missing_contact", label: "No phone or email found", severity: "medium" });
  }
  if (!profile.procurement.available) {
    risks.push({ code: "no_procurement_history", label: "No public procurement history", severity: "low" });
  }
  if (profile.identity.name && profile.online.description) {
    const registryName = profile.identity.name.value.toLowerCase();
    const webDescription = profile.online.description.value.toLowerCase();
    if (!webDescription.includes(registryName.split(" ")[0])) {
      risks.push({ code: "conflicting_information", label: "Registry name and web presence may not match", severity: "low" });
    }
  }

  return risks;
}
