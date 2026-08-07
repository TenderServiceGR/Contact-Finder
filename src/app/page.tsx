"use client";

import { useState } from "react";
import { SearchForm } from "@/components/SearchForm";
import { ResultsView } from "@/components/ResultsView";
import type { CompanyProfile } from "@/lib/types";

type ViewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "results"; profile: CompanyProfile };

export default function Home() {
  const [state, setState] = useState<ViewState>({ status: "idle" });

  async function handleSearch(term: string, type: "name" | "vat") {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Search failed." });
        return;
      }
      setState({ status: "results", profile: data.profile });
    } catch {
      setState({ status: "error", message: "Could not reach the server. Please try again." });
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12 md:py-16">
      <header
        className={`w-full max-w-4xl flex flex-col items-center text-center transition-all ${
          state.status === "results" ? "mb-8" : "mb-10 md:mb-14"
        }`}
      >
        <p className="font-data text-xs uppercase tracking-[0.2em] text-seal mb-3">
          Sales · Company Intelligence
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-semibold text-ink mb-3 leading-tight">
          Company Intelligence &amp; Contact Discovery
        </h1>
        <p className="text-ink-soft max-w-xl text-sm md:text-base">
          One search across the Greek Business Registry, the Public Procurement Portal, and the
          open web — a complete company profile in seconds, not a dozen browser tabs.
        </p>
      </header>

      <SearchForm onSearch={handleSearch} loading={state.status === "loading"} />

      <div className="w-full flex flex-col items-center mt-10">
        {state.status === "loading" && (
          <div className="flex flex-col items-center gap-3 text-ink-soft">
            <div className="w-10 h-10 border-2 border-ink border-t-seal rounded-full animate-spin" />
            <p className="font-data text-xs uppercase tracking-wide">
              Querying ΓΕΜΗ, ΚΗΜΔΗΣ &amp; the web…
            </p>
          </div>
        )}

        {state.status === "error" && (
          <div className="border border-risk-high bg-risk-high-soft text-risk-high text-sm rounded-sm px-4 py-3 max-w-xl w-full text-center">
            {state.message}
          </div>
        )}

        {state.status === "results" && <ResultsView profile={state.profile} />}
      </div>
    </main>
  );
}
