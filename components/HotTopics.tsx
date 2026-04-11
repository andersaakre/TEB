"use client";

import type { HotTopic } from "@/types";

interface HotTopicsProps {
  topics: HotTopic[];
  onAddTopic?: (topic: HotTopic) => void;
  loading?: boolean;
}

export function HotTopics({ topics, onAddTopic, loading = false }: HotTopicsProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">Hot Topics</h2>
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-[var(--surface-2)]" />
          ))}
        </div>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">Hot Topics</h2>
        <p className="text-xs text-[var(--muted)]">Refresh the brief to discover hot topics.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
        Hot Topics
      </h2>
      <div className="space-y-2">
        {topics.map((topic, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}>
                  {topic.label}
                </span>
                <span className="text-[9px] text-[var(--muted)]">
                  {topic.articleCount}a · {topic.marketCount}m
                </span>
              </div>
              <p className="text-[11px] font-medium text-[var(--text)] leading-snug">
                {topic.reason}
              </p>
            </div>
            {onAddTopic && (
              <button
                onClick={() => onAddTopic(topic)}
                className="flex-shrink-0 text-[10px] px-2 py-1 rounded border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors font-medium"
              >
                + Track
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
