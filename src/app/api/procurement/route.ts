import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchFromProcurement } from "@/lib/sources/procurement";

const bodySchema = z.object({
  vat: z.string().trim().min(1, "A VAT number is required."),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const { vat, dateFrom, dateTo } = parsed.data;
  const result = await fetchFromProcurement(vat, { dateFrom, dateTo });

  return NextResponse.json({ summary: result.summary, status: result.status });
}
