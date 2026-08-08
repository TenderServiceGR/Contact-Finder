"use client";

import { useState } from "react";
import type { CompanyProfile, ProcurementSummary } from "@/lib/types";
import type { ContractorContactResult } from "@/lib/sources/procurementContact";
import { Section, Field } from "./Section";
import { Stamp } from "./Stamp";

function money(n?: number) {
  if (n === undefined) return "—";
  return new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function khmdhsUrl(referenceNumber: string) {
  return `https://cerpp.eprocurement.gov.gr/upgkimdis/unprotected/home.xhtml?referenceNumber=${encodeURIComponent(referenceNumber)}&doc=true`;
}

const AWARDS_PAGE_SIZE = 10;
const CONTACT_SCAN_LIMIT = 15;

export function ResultsView({ profile }: { profile: CompanyProfile }) {
  const p = profile;
  const vat = p.identity.vat?.value;

  const [procurement, setProcurement] = useState<ProcurementSummary>(profile.procurement);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [awardsPage, setAwardsPage] = useState(1);
  const [contactLookup, setContactLookup] = useState<{
    loading: boolean;
    error?: string;
    result?: ContractorContactResult;
  }>({ loading: false });

  const awardsPageCount = Math.max(1, Math.ceil(procurement.awards.length / AWARDS_PAGE_SIZE));
  const pagedAwards = procurement.awards.slice(
    (awardsPage - 1) * AWARDS_PAGE_SIZE,
    awardsPage * AWARDS_PAGE_SIZE
  );

  async function handleApplyFilters() {
    if (!vat) return;
    setFilterLoading(true);
    setFilterError(null);
    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFilterError(data.error ?? "Could not apply filters.");
        return;
      }
      setProcurement(data.summary);
      setAwardsPage(1);
    } catch {
      setFilterError("Could not reach the server. Please try again.");
    } finally {
      setFilterLoading(false);
    }
  }

  function handleResetFilters() {
    setDateFrom("");
    setDateTo("");
    setFilterError(null);
    setProcurement(profile.procurement);
    setAwardsPage(1);
  }

  async function handleFindContact() {
    if (!vat) return;
    const contracts = procurement.awards
      .filter((a) => a.referenceNumber)
      .slice(0, CONTACT_SCAN_LIMIT)
      .map((a) => ({ referenceNumber: a.referenceNumber!, authorityVat: a.authorityVat }));
    if (contracts.length === 0) return;

    setContactLookup({ loading: true });
    try {
      const res = await fetch("/api/procurement/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat, contracts }),
      });
      const data = await res.json();
      if (!res.ok) {
        setContactLookup({ loading: false, error: data.error ?? "Could not scan contract documents." });
        return;
      }
      setContactLookup({ loading: false, result: data });
    } catch {
      setContactLookup({ loading: false, error: "Could not reach the server. Please try again." });
    }
  }

  return (
    <div className="w-full max-w-4xl flex flex-col gap-6">
      {/* Header / identity stamp */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b-2 border-ink">
        <div>
          <p className="font-data text-xs uppercase tracking-widest text-ink-soft mb-1">Company profile</p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink leading-tight">
            {p.identity.name?.value ?? p.query.term}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-ink-soft font-data">
            {p.identity.vat && <span>ΑΦΜ {p.identity.vat.value}</span>}
            {p.identity.gemiNumber && <span>ΓΕΜΗ {p.identity.gemiNumber.value}</span>}
            {p.identity.status && (
              <span className="stamp stamp-gemi">{p.identity.status.value}</span>
            )}
          </div>
        </div>
        <div className="stamp-seal shrink-0 w-20 h-20 rounded-full border-2 border-seal flex items-center justify-center text-seal text-center font-data text-[0.55rem] uppercase leading-tight rotate-[-4deg]">
          Verified
          <br />
          Profile
        </div>
      </div>

      {p.warnings.length > 0 && (
        <div className="border border-risk-medium bg-risk-medium-soft text-risk-medium text-sm rounded-sm px-4 py-3">
          {p.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      <Section title="Public Procurement">
        {vat && (
          <div className="flex flex-wrap items-end gap-3 mb-5 pb-5 border-b border-dashed border-line">
            <div className="flex flex-col gap-1">
              <label htmlFor="proc-date-from" className="text-[0.7rem] uppercase tracking-wide text-ink-soft">
                Published from
              </label>
              <input
                id="proc-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-line rounded-sm px-2 py-1.5 text-sm bg-paper-card text-ink"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="proc-date-to" className="text-[0.7rem] uppercase tracking-wide text-ink-soft">
                Published to
              </label>
              <input
                id="proc-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-line rounded-sm px-2 py-1.5 text-sm bg-paper-card text-ink"
              />
            </div>
            <button
              type="button"
              onClick={handleApplyFilters}
              disabled={filterLoading}
              className="px-4 py-1.5 text-sm font-medium rounded-sm bg-ink text-paper-card disabled:opacity-50 disabled:cursor-not-allowed hover:bg-seal transition-colors"
            >
              {filterLoading ? "Applying…" : "Apply filters"}
            </button>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2 py-1.5 text-sm text-ink-soft hover:text-ink underline underline-offset-2"
              >
                Reset
              </button>
            )}
            <p className="text-xs text-ink-faint w-full">
              Dates filter by registration date in ΚΗΜΔΗΣ. Without a range, results cover the last 3 years.
            </p>
            {filterError && <p className="text-xs text-risk-high w-full">{filterError}</p>}
          </div>
        )}

        {!procurement.available ? (
          <p className="text-sm text-ink-faint italic">
            {vat ? "No public procurement history found for the selected period." : "No public procurement history found."}
          </p>
        ) : (
          <>
            <dl className="grid sm:grid-cols-3 gap-5 mb-6">
              <Field label="Contracts awarded"><span className="font-data text-lg">{procurement.contractsAwarded}</span></Field>
              <Field label="Total value"><span className="font-data text-lg">{money(procurement.totalValue)}</span></Field>
              <Field label="Average value"><span className="font-data text-lg">{money(procurement.averageValue)}</span></Field>
              <Field label="First award"><span className="font-data">{procurement.firstAwardYear ?? "—"}</span></Field>
              <Field label="Last award"><span className="font-data">{procurement.lastAwardYear ?? "—"}</span></Field>
              <Field label="CPV categories"><span className="text-xs">{procurement.cpvCategories.join(", ") || "—"}</span></Field>
            </dl>
            <p className="text-[0.7rem] uppercase tracking-wide text-ink-soft mb-2">
              Awards <Stamp source="procurement" />
            </p>
            <div className="border border-line rounded-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper text-ink-soft text-xs uppercase">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Reference</th>
                    <th className="text-left font-medium px-3 py-2">Title</th>
                    <th className="text-left font-medium px-3 py-2">Contractor</th>
                    <th className="text-left font-medium px-3 py-2">Authority</th>
                    <th className="text-left font-medium px-3 py-2">Date</th>
                    <th className="text-right font-medium px-3 py-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAwards.map((a, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2 font-data text-xs whitespace-nowrap">
                        {a.referenceNumber ? (
                          <a
                            href={khmdhsUrl(a.referenceNumber)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ink-soft underline underline-offset-2 hover:text-ink"
                          >
                            {a.referenceNumber}
                          </a>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{a.title}</td>
                      <td className="px-3 py-2 text-ink-soft">{a.contractorName ?? "—"}</td>
                      <td className="px-3 py-2 text-ink-soft">{a.authority}</td>
                      <td className="px-3 py-2 font-data text-ink-soft">{a.date ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-data">{money(a.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {awardsPageCount > 1 && (
              <div className="flex items-center justify-between mt-3 text-sm text-ink-soft">
                <button
                  type="button"
                  onClick={() => setAwardsPage((n) => Math.max(1, n - 1))}
                  disabled={awardsPage === 1}
                  className="px-3 py-1 rounded-sm border border-line disabled:opacity-40 disabled:cursor-not-allowed hover:border-ink-soft"
                >
                  Previous
                </button>
                <span className="font-data text-xs">
                  Page {awardsPage} of {awardsPageCount} · {procurement.awards.length} contracts
                </span>
                <button
                  type="button"
                  onClick={() => setAwardsPage((n) => Math.min(awardsPageCount, n + 1))}
                  disabled={awardsPage === awardsPageCount}
                  className="px-3 py-1 rounded-sm border border-line disabled:opacity-40 disabled:cursor-not-allowed hover:border-ink-soft"
                >
                  Next
                </button>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-dashed border-line">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleFindContact}
                  disabled={contactLookup.loading}
                  className="px-4 py-1.5 text-sm font-medium rounded-sm border border-ink text-ink disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink hover:text-paper-card transition-colors"
                >
                  {contactLookup.loading ? "Scanning contract documents…" : "Find contractor contact info"}
                </button>
                <p className="text-xs text-ink-faint">
                  Scans up to {Math.min(CONTACT_SCAN_LIMIT, procurement.awards.length)} contract PDFs from ΚΗΜΔΗΣ for
                  a phone/email listed for the contractor (not the contracting authority).
                </p>
              </div>

              {contactLookup.error && <p className="text-xs text-risk-high mt-2">{contactLookup.error}</p>}

              {contactLookup.result && (
                <div className="mt-3 text-sm">
                  {contactLookup.result.found ? (
                    <dl className="grid sm:grid-cols-2 gap-4">
                      <Field label="Contractor phone">
                        <span className="font-data">{contactLookup.result.phone ?? "—"}</span>
                      </Field>
                      <Field label="Contractor email">
                        <span className="font-data">{contactLookup.result.email ?? "—"}</span>
                      </Field>
                      <p className="text-xs text-ink-faint sm:col-span-2">
                        Found in contract{" "}
                        {contactLookup.result.referenceNumber && (
                          <a
                            href={khmdhsUrl(contactLookup.result.referenceNumber)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2 hover:text-ink"
                          >
                            {contactLookup.result.referenceNumber}
                          </a>
                        )}{" "}
                        (checked {contactLookup.result.checked} document{contactLookup.result.checked === 1 ? "" : "s"}).
                        Verify against the original document before using it.
                      </p>
                    </dl>
                  ) : (
                    <p className="text-ink-faint italic">
                      No contractor phone/email found in the {contactLookup.result.checked} most recent contract
                      document{contactLookup.result.checked === 1 ? "" : "s"}.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </Section>

      <p className="text-xs text-ink-faint text-center pb-6">
        Profile generated {new Date(p.fetchedAt).toLocaleString("en-GB")} · Source: ΚΗΜΔΗΣ Open Data
      </p>
    </div>
  );
}
