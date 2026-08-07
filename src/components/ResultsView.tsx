import type { CompanyProfile } from "@/lib/types";
import { Section, Field } from "./Section";
import { Fact, LinkFact } from "./Fact";
import { Stamp } from "./Stamp";

const RISK_STYLE = {
  high: "text-risk-high bg-risk-high-soft border-risk-high",
  medium: "text-risk-medium bg-risk-medium-soft border-risk-medium",
  low: "text-risk-low bg-risk-low-soft border-risk-low",
};

function money(n?: number) {
  if (n === undefined) return "—";
  return new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function ResultsView({ profile }: { profile: CompanyProfile }) {
  const p = profile;

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

      {/* 6. AI Summary */}
      <Section number="06" title="AI Summary">
        <p className="text-sm leading-relaxed text-ink mb-4">{p.ai.summary}</p>
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <h3 className="text-xs uppercase tracking-wide text-ink-soft mb-2">Sales insights</h3>
            <p className="text-sm text-ink mb-2">{p.ai.salesRationale}</p>
            {p.ai.suggestedDecisionMakers && p.ai.suggestedDecisionMakers.length > 0 && (
              <p className="text-sm text-ink-soft">
                <span className="text-ink-soft">Talk to: </span>
                {p.ai.suggestedDecisionMakers.join(", ")}
              </p>
            )}
            {p.ai.suggestedDepartments && (
              <p className="text-sm text-ink-soft">
                <span className="text-ink-soft">Departments: </span>
                {p.ai.suggestedDepartments.join(", ")}
              </p>
            )}
            {p.ai.recommendedFirstApproach && (
              <p className="text-sm text-ink mt-2 italic">“{p.ai.recommendedFirstApproach}”</p>
            )}
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wide text-ink-soft mb-2">Risk indicators</h3>
            {p.risks.length === 0 ? (
              <p className="text-sm text-verified">No risk indicators flagged.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {p.risks.map((r) => (
                  <li
                    key={r.code}
                    className={`text-xs px-2.5 py-1 rounded-sm border inline-flex w-fit ${RISK_STYLE[r.severity]}`}
                  >
                    {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      {/* 1. Company Identity */}
      <Section number="01" title="Company Identity">
        <dl className="grid sm:grid-cols-2 gap-5">
          <Field label="Legal name"><Fact data={p.identity.name} /></Field>
          <Field label="Legal form"><Fact data={p.identity.legalForm} /></Field>
          <Field label="VAT (ΑΦΜ)"><Fact data={p.identity.vat} mono /></Field>
          <Field label="GEMI number"><Fact data={p.identity.gemiNumber} mono /></Field>
          <Field label="Status"><Fact data={p.identity.status} /></Field>
          <Field label="Registration date"><Fact data={p.identity.registrationDate} mono /></Field>
        </dl>
      </Section>

      {/* 2. Contact Information */}
      <Section number="02" title="Contact Information">
        <dl className="grid sm:grid-cols-2 gap-5">
          <Field label="Website"><LinkFact data={p.contact.website} label={p.contact.website?.value.replace(/^https?:\/\//, "")} /></Field>
          <Field label="Address"><Fact data={p.contact.address} /></Field>
          <Field label="Municipality"><Fact data={p.contact.municipality} /></Field>
          <Field label="Region"><Fact data={p.contact.region} /></Field>
          <Field label="Phone">
            {p.contact.phones.length === 0 ? <span className="text-ink-faint italic">Not available</span> :
              p.contact.phones.map((ph, i) => <span key={i} className="mr-3"><Fact data={ph} mono /></span>)}
          </Field>
          <Field label="Email">
            {p.contact.emails.length === 0 ? <span className="text-ink-faint italic">Not available</span> :
              p.contact.emails.map((em, i) => <span key={i} className="mr-3"><Fact data={em} mono /></span>)}
          </Field>
          {p.contact.mapsUrl && (
            <Field label="Google Maps"><LinkFact data={p.contact.mapsUrl} label="Open in Google Maps" /></Field>
          )}
        </dl>
      </Section>

      {/* 3. Online Presence */}
      <Section number="03" title="Online Presence">
        <dl className="grid sm:grid-cols-2 gap-5 mb-5">
          <Field label="LinkedIn"><LinkFact data={p.online.linkedin} label="Company page" /></Field>
          <Field label="Facebook"><LinkFact data={p.online.facebook} label="Company page" /></Field>
        </dl>
        {p.online.description && (
          <div className="mb-4">
            <p className="text-[0.7rem] uppercase tracking-wide text-ink-soft mb-1">Description</p>
            <p className="text-sm text-ink leading-relaxed">
              {p.online.description.value} <Stamp source={p.online.description.source} />
            </p>
          </div>
        )}
        {p.online.certifications.length > 0 && (
          <div className="mb-4">
            <p className="text-[0.7rem] uppercase tracking-wide text-ink-soft mb-1">Certifications</p>
            <div className="flex flex-wrap gap-2">
              {p.online.certifications.map((c, i) => (
                <span key={i} className="text-xs border border-line rounded-sm px-2 py-1">{c.value}</span>
              ))}
            </div>
          </div>
        )}
        {p.online.latestNews.length > 0 && (
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-ink-soft mb-1">Latest news</p>
            <ul className="text-sm list-disc list-inside space-y-1">
              {p.online.latestNews.map((n, i) => <li key={i}>{n.value}</li>)}
            </ul>
          </div>
        )}
      </Section>

      {/* 4. Business Activities */}
      <Section number="04" title="Business Activities">
        <dl className="grid sm:grid-cols-2 gap-5 mb-5">
          <Field label="Primary KAD"><Fact data={p.activity.primaryKad} /></Field>
          <Field label="Chamber"><Fact data={p.activity.chamber} /></Field>
        </dl>
        {p.activity.secondaryKads.length > 0 && (
          <div className="mb-5">
            <p className="text-[0.7rem] uppercase tracking-wide text-ink-soft mb-2">Secondary activities</p>
            <ul className="text-sm space-y-1">
              {p.activity.secondaryKads.map((k, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Fact data={k} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {p.activity.representatives.length > 0 && (
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-ink-soft mb-2">Representatives</p>
            <ul className="text-sm space-y-1">
              {p.activity.representatives.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span>{r.value.name}{r.value.role ? ` — ${r.value.role}` : ""}</span>
                  <Stamp source={r.source} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* 5. Public Procurement */}
      <Section number="05" title="Public Procurement">
        {!p.procurement.available ? (
          <p className="text-sm text-ink-faint italic">No public procurement history found.</p>
        ) : (
          <>
            <dl className="grid sm:grid-cols-3 gap-5 mb-6">
              <Field label="Contracts awarded"><span className="font-data text-lg">{p.procurement.contractsAwarded}</span></Field>
              <Field label="Total value"><span className="font-data text-lg">{money(p.procurement.totalValue)}</span></Field>
              <Field label="Average value"><span className="font-data text-lg">{money(p.procurement.averageValue)}</span></Field>
              <Field label="First award"><span className="font-data">{p.procurement.firstAwardYear ?? "—"}</span></Field>
              <Field label="Last award"><span className="font-data">{p.procurement.lastAwardYear ?? "—"}</span></Field>
              <Field label="CPV categories"><span className="text-xs">{p.procurement.cpvCategories.join(", ") || "—"}</span></Field>
            </dl>
            <p className="text-[0.7rem] uppercase tracking-wide text-ink-soft mb-2">Recent awards <Stamp source="procurement" /></p>
            <div className="border border-line rounded-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-paper text-ink-soft text-xs uppercase">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Title</th>
                    <th className="text-left font-medium px-3 py-2">Authority</th>
                    <th className="text-left font-medium px-3 py-2">Date</th>
                    <th className="text-right font-medium px-3 py-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {p.procurement.recentAwards.map((a, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2">{a.title}</td>
                      <td className="px-3 py-2 text-ink-soft">{a.authority}</td>
                      <td className="px-3 py-2 font-data text-ink-soft">{a.date ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-data">{money(a.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      <p className="text-xs text-ink-faint text-center pb-6">
        Profile generated {new Date(p.fetchedAt).toLocaleString("en-GB")} · Sources: ΓΕΜΗ Open Data, ΚΗΜΔΗΣ Open Data, public web search
      </p>
    </div>
  );
}
