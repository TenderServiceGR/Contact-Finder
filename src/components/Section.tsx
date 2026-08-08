export function Section({
  number,
  title,
  children,
}: {
  number?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-paper-card border border-line rounded-sm p-6 md:p-7">
      <div className="flex items-baseline gap-3 mb-5">
        {number && <span className="font-data text-xs text-seal">{number}</span>}
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h2>
        <div className="flex-1 border-t border-dashed border-line ml-2" />
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[0.7rem] uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="text-sm text-ink flex items-center gap-2 flex-wrap">{children}</dd>
    </div>
  );
}
