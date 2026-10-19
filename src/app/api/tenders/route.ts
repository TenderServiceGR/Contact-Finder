import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchRelevantTenders } from "@/lib/sources/tenders";

// Companies can list dozens of ΚΑΔ and many past contracts. Rather than reject
// the request, use the first N (the client sends the primary ΚΑΔ first).
const MAX_KADS = 40;
const MAX_PAST_CPVS = 200;

const bodySchema = z.object({
  kads: z
    .array(z.object({ value: z.string().trim().min(2), primary: z.boolean() }))
    .min(1, "At least one ΚΑΔ is required.")
    .transform((kads) => kads.slice(0, MAX_KADS)),
  /** CPV codes from the company's past contracts (ΚΗΜΔΗΣ), strongest relevance signal. */
  pastCpvs: z
    .array(z.string().regex(/^\d{8}-\d$/))
    .transform((codes) => codes.slice(0, MAX_PAST_CPVS))
    .optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const result = await fetchRelevantTenders(parsed.data.kads, parsed.data.pastCpvs ?? []);
  return NextResponse.json(result);
}
