import { env } from "@/lib/env";
import type { ContactInfo, OnlinePresence, SourceStatus, Sourced } from "@/lib/types";

/**
 * Web-presence connector. Google itself has no public search API, so this
 * targets a SerpAPI-compatible endpoint (SerpAPI, or any drop-in
 * alternative — Serper, ValueSerp, etc. all accept the same query shape
 * with minor tweaks to `parseResults`).
 */

const src = (value: string): Sourced<string> => ({ value, source: "google", confidence: "public" });

export interface GoogleResult {
  status: SourceStatus;
  contact: Partial<ContactInfo>;
  online: Partial<OnlinePresence>;
}

export async function fetchFromGoogle(companyName: string): Promise<GoogleResult> {
  if (!env.google.isConfigured) {
    return demoGoogleResult(companyName);
  }

  try {
    const url = `${env.google.baseUrl}?engine=google&q=${encodeURIComponent(companyName)}&api_key=${env.google.apiKey}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return { status: "unavailable", contact: {}, online: {} };
    const data = await res.json();
    return parseResults(data);
  } catch {
    return { status: "unavailable", contact: {}, online: {} };
  }
}

function parseResults(data: any): GoogleResult {
  const organic: any[] = data?.organic_results ?? [];
  const knowledge = data?.knowledge_graph ?? {};

  const website = knowledge.website ?? organic[0]?.link;
  const linkedin = organic.find((r) => r.link?.includes("linkedin.com/company"))?.link;
  const facebook = organic.find((r) => r.link?.includes("facebook.com"))?.link;
  const description = knowledge.description ?? organic[0]?.snippet;

  return {
    status: "ok",
    contact: {
      website: website ? src(website) : undefined,
      phones: knowledge.phone ? [src(knowledge.phone)] : [],
      emails: [],
      mapsUrl: knowledge.local_map_link ? src(knowledge.local_map_link) : undefined,
    },
    online: {
      linkedin: linkedin ? src(linkedin) : undefined,
      facebook: facebook ? src(facebook) : undefined,
      description: description ? src(description) : undefined,
      latestNews: (data?.news_results ?? []).slice(0, 3).map((n: any) => src(n.title)),
      certifications: [],
    },
  };
}

// --- Demo data ---
function demoGoogleResult(companyName: string): GoogleResult {
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "company";
  return {
    status: "ok",
    contact: {
      website: src(`https://www.${slug}.gr`),
      phones: [src("+30 210 1234567")],
      emails: [src(`info@${slug}.gr`)],
      mapsUrl: src(`https://maps.google.com/?q=${encodeURIComponent(companyName)}`),
    },
    online: {
      linkedin: src(`https://www.linkedin.com/company/${slug}`),
      facebook: src(`https://www.facebook.com/${slug}`),
      description: src(
        `${companyName} is a Greece-based company offering products and services to business and public-sector clients.`
      ),
      latestNews: [src(`${companyName} announces new partnership`), src(`${companyName} expands operations`)],
      certifications: [src("ISO 9001:2015")],
    },
  };
}
