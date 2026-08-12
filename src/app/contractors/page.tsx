import Link from "next/link";
import type { Metadata } from "next";
import { listContractorContacts } from "@/lib/contractorDb";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Saved Contractor Contacts",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB");
}

export default async function ContractorsPage() {
  const contacts = await listContractorContacts();

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12 md:py-16">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4 pb-4 border-b-2 border-ink">
          <div>
            <p className="font-data text-xs uppercase tracking-[0.2em] text-seal mb-2">
              Sales · Company Intelligence
            </p>
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-ink">Saved contractor contacts</h1>
          </div>
          <Link href="/" className="text-sm text-ink-soft underline underline-offset-2 hover:text-ink whitespace-nowrap">
            ← Back to search
          </Link>
        </div>

        {!env.supabase.isConfigured ? (
          <p className="text-sm text-ink-faint italic">
            Supabase isn&apos;t configured, so no contacts have been saved yet. Set NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_ANON_KEY to start persisting results from &quot;Find contractor contact info&quot;.
          </p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-ink-faint italic">
            No contractor contacts saved yet — a row is added automatically whenever &quot;Find contractor contact
            info&quot; finds a phone or email.
          </p>
        ) : (
          <div className="border border-line rounded-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-ink-soft text-xs uppercase">
                <tr>
                  <th className="text-left font-medium px-3 py-2">VAT</th>
                  <th className="text-left font-medium px-3 py-2">Contractor name</th>
                  <th className="text-left font-medium px-3 py-2">Email</th>
                  <th className="text-left font-medium px-3 py-2">Phone</th>
                  <th className="text-left font-medium px-3 py-2">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.vat} className="border-t border-line">
                    <td className="px-3 py-2 font-data text-xs whitespace-nowrap">{c.vat}</td>
                    <td className="px-3 py-2">{c.contractorName ?? "—"}</td>
                    <td className="px-3 py-2 font-data text-xs">{c.contractorEmail ?? "—"}</td>
                    <td className="px-3 py-2 font-data text-xs whitespace-nowrap">{c.contractorPhone ?? "—"}</td>
                    <td className="px-3 py-2 font-data text-xs text-ink-soft whitespace-nowrap">
                      {formatDate(c.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
