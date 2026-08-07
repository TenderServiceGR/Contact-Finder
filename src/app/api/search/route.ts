import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchFromGemi } from "@/lib/sources/gemi";
import { fetchFromProcurement } from "@/lib/sources/procurement";
import { fetchFromGoogle } from "@/lib/sources/google";
import { mergeCompanyData } from "@/lib/mergeData";
import { generateAiInsights } from "@/lib/ai/insights";

const querySchema = z.object({
  term: z.string().trim().min(2, "Enter at least 2 characters."),
  type: z.enum(["name", "vat", "gemi"]).default("name"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = querySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const query = parsed.data;

  try {
    // §8/§13: query the three sources in parallel to minimize response time.
    const [gemi, google] = await Promise.all([fetchFromGemi(query), fetchFromGoogle(query.term)]);

    const vat = gemi.identity.vat?.value ?? (query.type === "vat" ? query.term : undefined);
    const procurement = await fetchFromProcurement(vat);

    if (gemi.status === "not_found") {
      return NextResponse.json({ error: "No company matched that search." }, { status: 404 });
    }

    const profile = mergeCompanyData(query, gemi, procurement, google);
    profile.ai = await generateAiInsights(profile);

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("Search orchestration failed:", err);
    return NextResponse.json({ error: "Something went wrong while gathering company data." }, { status: 500 });
  }
}
