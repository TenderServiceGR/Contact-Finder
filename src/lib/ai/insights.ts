import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type { CompanyProfile, AiInsights } from "@/lib/types";

const responseSchema = `{
  "summary": "3-5 sentence company summary covering what the company does, industry, main products/services, business focus, and public sector activity",
  "industry": "short industry label",
  "businessFocus": "one short phrase",
  "salesRationale": "1-2 sentences on why this company could be a good prospect",
  "suggestedDecisionMakers": ["role or name", "..."],
  "suggestedDepartments": ["department", "..."],
  "recommendedFirstApproach": "1-2 sentences describing a concrete first outreach move"
}`;

export async function generateAiInsights(profile: CompanyProfile): Promise<AiInsights> {
  if (!env.anthropic.isConfigured) {
    return demoInsights(profile);
  }

  try {
    const client = new Anthropic({ apiKey: env.anthropic.apiKey });
    const context = buildContext(profile);

    const message = await client.messages.create({
      model: env.anthropic.model,
      max_tokens: 800,
      system:
        "You are a B2B sales research assistant. Given structured company data, produce sales-ready insights. " +
        "Respond with ONLY valid JSON matching the given schema — no markdown fences, no preamble.",
      messages: [
        {
          role: "user",
          content: `Company data:\n${context}\n\nRespond in this exact JSON shape:\n${responseSchema}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return demoInsights(profile);

    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed as AiInsights;
  } catch {
    return demoInsights(profile);
  }
}

function buildContext(profile: CompanyProfile): string {
  return JSON.stringify(
    {
      name: profile.identity.name?.value,
      legalForm: profile.identity.legalForm?.value,
      status: profile.identity.status?.value,
      primaryActivity: profile.activity.primaryKad?.value,
      secondaryActivities: profile.activity.secondaryKads.map((s) => s.value),
      description: profile.online.description?.value,
      website: profile.contact.website?.value,
      representatives: profile.activity.representatives.map((r) => r.value),
      procurement: {
        contractsAwarded: profile.procurement.contractsAwarded,
        totalValue: profile.procurement.totalValue,
        contractingAuthorities: profile.procurement.contractingAuthorities,
        cpvCategories: profile.procurement.cpvCategories,
      },
    },
    null,
    2
  );
}

function demoInsights(profile: CompanyProfile): AiInsights {
  const name = profile.identity.name?.value ?? "This company";
  const hasProcurement = profile.procurement.available;
  return {
    summary: `${name} is a Greece-registered company${profile.activity.primaryKad ? ` primarily active in ${profile.activity.primaryKad.value}` : ""}. ${
      profile.online.description?.value ?? "It maintains a public web presence describing its products and services."
    } ${hasProcurement ? `It has a track record of ${profile.procurement.contractsAwarded} public contract(s) with Greek contracting authorities.` : "No public-sector contract history was found."}`,
    industry: profile.activity.primaryKad?.value?.split(" - ")[1] ?? "General commerce",
    businessFocus: profile.activity.primaryKad?.value ?? "Not specified",
    salesRationale: hasProcurement
      ? "Active public-sector buyer with demonstrated procurement budget — a strong signal for enterprise or public-tender-related offerings."
      : "Established, active registry status suggests operational stability worth a discovery call.",
    suggestedDecisionMakers: profile.activity.representatives.map((r) => `${r.value.name}${r.value.role ? ` (${r.value.role})` : ""}`),
    suggestedDepartments: ["Procurement", "IT / Digital Transformation", "Operations"],
    recommendedFirstApproach: "Open with a short, specific email referencing their recent activity, and propose a 15-minute discovery call with the relevant department head.",
  };
}
