import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findContractorContact } from "@/lib/sources/procurementContact";

const bodySchema = z.object({
  vat: z.string().trim().min(1, "A VAT number is required."),
  contracts: z
    .array(
      z.object({
        referenceNumber: z.string().trim().min(1),
        authorityVat: z.string().trim().optional(),
      })
    )
    .min(1, "At least one contract is required.")
    .max(15, "At most 15 contracts can be scanned per request."),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const { vat, contracts } = parsed.data;
  const result = await findContractorContact(vat, contracts);

  return NextResponse.json(result);
}
