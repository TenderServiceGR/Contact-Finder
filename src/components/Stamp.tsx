import type { SourceName } from "@/lib/types";

const LABEL: Record<SourceName, string> = {
  gemi: "ΓΕΜΗ",
  procurement: "ΚΗΜΔΗΣ",
  google: "Web",
  ai: "AI",
};

const CLASS: Record<SourceName, string> = {
  gemi: "stamp-gemi",
  procurement: "stamp-procurement",
  google: "stamp-google",
  ai: "stamp-procurement",
};

export function Stamp({ source }: { source: SourceName }) {
  return <span className={`stamp ${CLASS[source]}`}>{LABEL[source]}</span>;
}
