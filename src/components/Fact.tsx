import type { Sourced } from "@/lib/types";
import { Stamp } from "./Stamp";

export function Fact({ data, mono = false }: { data?: Sourced<string>; mono?: boolean }) {
  if (!data) {
    return <span className="text-ink-faint italic">Not available</span>;
  }
  return (
    <>
      <span className={mono ? "font-data" : undefined}>{data.value}</span>
      <Stamp source={data.source} />
    </>
  );
}

export function LinkFact({ data, label }: { data?: Sourced<string>; label?: string }) {
  if (!data) {
    return <span className="text-ink-faint italic">Not available</span>;
  }
  return (
    <>
      <a
        href={data.value}
        target="_blank"
        rel="noreferrer"
        className="text-verified underline decoration-dashed underline-offset-4 hover:text-ink"
      >
        {label ?? data.value}
      </a>
      <Stamp source={data.source} />
    </>
  );
}
