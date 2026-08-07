"use client";

import { useState } from "react";

export function SearchForm({
  onSearch,
  loading,
}: {
  onSearch: (term: string, type: "name" | "vat") => void;
  loading: boolean;
}) {
  const [type, setType] = useState<"name" | "vat">("name");
  const [term, setTerm] = useState("");

  return (
    <form
      className="w-full max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        if (term.trim().length < 2) return;
        onSearch(term.trim(), type);
      }}
    >
      <div className="flex gap-2 mb-3 font-data text-xs uppercase tracking-wide">
        {(["name", "vat"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded-sm border transition-colors ${
              type === t
                ? "bg-ink text-paper-card border-ink"
                : "border-line text-ink-soft hover:border-ink-soft"
            }`}
          >
            {t === "name" ? "Company name" : "VAT number (ΑΦΜ)"}
          </button>
        ))}
      </div>

      <div className="flex gap-0 border-2 border-ink rounded-sm bg-paper-card overflow-hidden focus-within:ring-2 focus-within:ring-seal">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={type === "name" ? "e.g. Hellenic Cables S.A." : "e.g. 094014201"}
          className="flex-1 px-4 py-3 bg-transparent outline-none text-ink placeholder:text-ink-faint text-sm md:text-base"
          aria-label={type === "name" ? "Company name" : "VAT number"}
        />
        <button
          type="submit"
          disabled={loading || term.trim().length < 2}
          className="px-5 md:px-6 font-display font-semibold text-sm tracking-wide bg-seal text-paper-card disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink transition-colors"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
    </form>
  );
}
