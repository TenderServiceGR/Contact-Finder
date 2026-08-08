"use client";

import { useState } from "react";

export function SearchForm({
  onSearch,
  loading,
}: {
  onSearch: (vat: string) => void;
  loading: boolean;
}) {
  const [term, setTerm] = useState("");

  return (
    <form
      className="w-full max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        if (term.trim().length < 2) return;
        onSearch(term.trim());
      }}
    >
      <div className="flex gap-0 border-2 border-seal rounded-sm bg-paper-card overflow-hidden focus-within:ring-2 focus-within:ring-seal">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. 094014201"
          className="flex-1 px-4 py-3 bg-transparent outline-none text-ink placeholder:text-ink-faint text-sm md:text-base"
          aria-label="VAT number"
        />
        <button
          type="submit"
          disabled={loading || term.trim().length < 2}
          className="px-5 md:px-6 font-display font-semibold text-sm tracking-wide bg-seal text-paper-card border-l-2 border-seal disabled:opacity-50 disabled:cursor-not-allowed hover:bg-paper-card hover:text-seal transition-colors"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
    </form>
  );
}
