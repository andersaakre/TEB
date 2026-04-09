"use client";

import type { PredictionMarket } from "@/types";
import { truncateWords } from "@/lib/utils/text";

interface MarketCardProps {
  market: PredictionMarket;
  compact?: boolean;
}

function ProbabilityBar({ prob }: { prob: number }) {
  const clamped = Math.max(0, Math.min(100, prob));
  const color =
    clamped > 70
      ? "bg-emerald-500"
      : clamped > 40
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Yes probability</span>
        <span className={`text-sm font-bold ${clamped > 70 ? "text-emerald-400" : clamped > 40 ? "text-amber-400" : "text-red-400"}`}>
          {clamped}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function MarketCard({ market, compact = false }: MarketCardProps) {
  const hasProb = market.probabilityYes !== undefined;
  const vol = market.volume
    ? market.volume >= 1_000_000
      ? `$${(market.volume / 1_000_000).toFixed(1)}M`
      : `$${(market.volume / 1_000).toFixed(0)}k`
    : null;

  return (
    <a
      href={market.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-green-700/50 hover:bg-[var(--surface-2)] transition-all duration-150 p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border bg-green-900/40 text-green-300 border-green-800/50 mb-2">
            Polymarket
          </span>
          {market.category && (
            <span className="ml-2 text-[10px] text-[var(--muted)] uppercase tracking-wider">
              {market.category}
            </span>
          )}
        </div>
        {vol && (
          <span className="text-[10px] text-[var(--muted)] flex-shrink-0">
            Vol {vol}
          </span>
        )}
      </div>

      <h3 className="text-sm font-medium text-[var(--text)] group-hover:text-green-300 transition-colors leading-snug">
        {compact ? truncateWords(market.title, 20) : market.title}
      </h3>

      {hasProb && <ProbabilityBar prob={market.probabilityYes!} />}

      {!compact && market.endDate && (
        <p className="text-[10px] text-[var(--muted)] mt-2">
          Closes {new Date(market.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      )}

      <p className="text-[9px] text-[var(--muted)] mt-2 italic">
        Speculative market signal — not editorial reporting
      </p>
    </a>
  );
}
