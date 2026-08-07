// Unified internal company model.
// Every field that can come from more than one source carries its own
// provenance so the UI can label where each fact came from (spec §9/§13).

export type SourceName = "gemi" | "procurement" | "google" | "ai";

export interface Sourced<T> {
  value: T;
  source: SourceName;
  confidence?: "official" | "public" | "inferred";
}

export interface Representative {
  name: string;
  role?: string;
}

export interface CompanyIdentity {
  name?: Sourced<string>;
  vat?: Sourced<string>;
  gemiNumber?: Sourced<string>;
  legalForm?: Sourced<string>;
  status?: Sourced<string>;
  registrationDate?: Sourced<string>;
}

export interface ContactInfo {
  website?: Sourced<string>;
  phones: Sourced<string>[];
  emails: Sourced<string>[];
  address?: Sourced<string>;
  municipality?: Sourced<string>;
  region?: Sourced<string>;
  mapsUrl?: Sourced<string>;
}

export interface OnlinePresence {
  linkedin?: Sourced<string>;
  facebook?: Sourced<string>;
  description?: Sourced<string>;
  latestNews: Sourced<string>[];
  certifications: Sourced<string>[];
}

export interface BusinessActivity {
  primaryKad?: Sourced<string>;
  secondaryKads: Sourced<string>[];
  products: Sourced<string>[];
  services: Sourced<string>[];
  chamber?: Sourced<string>;
  representatives: Sourced<Representative>[];
}

export interface ProcurementAward {
  title: string;
  authority: string;
  value?: number;
  date?: string;
  cpv?: string;
  referenceNumber?: string;
  contractorName?: string;
}

export interface ProcurementSummary {
  contractsAwarded?: number;
  totalValue?: number;
  averageValue?: number;
  largestContract?: ProcurementAward;
  latestContract?: ProcurementAward;
  firstAwardYear?: number;
  lastAwardYear?: number;
  contractingAuthorities: string[];
  cpvCategories: string[];
  /** All matched, non-cancelled contracts, sorted most recent first. */
  awards: ProcurementAward[];
  available: boolean;
}

export interface AiInsights {
  summary?: string;
  industry?: string;
  businessFocus?: string;
  salesRationale?: string;
  suggestedDecisionMakers?: string[];
  suggestedDepartments?: string[];
  recommendedFirstApproach?: string;
}

export interface RiskIndicator {
  code:
    | "website_missing"
    | "company_inactive"
    | "missing_contact"
    | "no_procurement_history"
    | "conflicting_information";
  label: string;
  severity: "low" | "medium" | "high";
}

export type SourceStatus = "ok" | "partial" | "unavailable" | "not_found";

export interface CompanyProfile {
  query: { term: string; type: "name" | "vat" | "gemi" };
  identity: CompanyIdentity;
  contact: ContactInfo;
  online: OnlinePresence;
  activity: BusinessActivity;
  procurement: ProcurementSummary;
  ai: AiInsights;
  risks: RiskIndicator[];
  sourceStatus: Record<"gemi" | "procurement" | "google", SourceStatus>;
  warnings: string[];
  fetchedAt: string;
}

export interface SearchMatch {
  name: string;
  vat?: string;
  gemiNumber?: string;
  status?: string;
  municipality?: string;
}
