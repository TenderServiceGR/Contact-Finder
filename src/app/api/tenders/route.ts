import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchRelevantTenders } from "@/lib/sources/tenders";

const bodySchema = z.object({
  kads: z
    .array(z.object({ value: z.string().trim().min(2), primary: z.boolean() }))
    .min(1, "At least one ΚΑΔ is required.")
    .max(30),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const result = await fetchRelevantTenders(parsed.data.kads);
  return NextResponse.json(result);
}
