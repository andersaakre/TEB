"use client";

import { useState } from "react";
import type { ClusteredStory } from "@/types";
import { SourceBadge } from "./SourceBadge";
import { formatRelative } from "@/lib/utils/date";
import { truncateWords } from "@/lib/utils/text";
import type { EditorialSource } from "@/types";

interface ClusterCardProps {
  cluster: ClusteredStory;
}

export function ClusterCard({ cluster }: ClusterCardProps) {
  const [expanded, setExpanded] = useState(false);
  const primary = cluster.articles[0];
  const hasMultipleSources = cluster.sources.length > 1;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/30 transition-colors">
      <div className="p-4">
        {/* Source badges + time */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {cluster.sources.map((s) => (
            <SourceBadge key={s} source={s as EditorialSource} />
          ))}
          <span className="text-[10px] text-[var(--muted)] ml-auto">
            {formatRelative(cluster.publishedAt)}
          </span>
          {cluster.articles.length > 1 && (
            <span className="text-[10px] text-[var(--muted)]">
              {cluster.articles.length} angles
            </span>
          )}
        </div>

        {/* Headline */}
        <a
          href={primary?.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
        >
          <h3 className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] leading-snug transition-colors mb-2">
            {cluster.representativeHeadline}
          </h3>
        </a>

        {/* Summary */}
        {primary?.summary && (
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
            {truncateWords(primary.summary, 35)}
          </p>
        )}

        {/* Multi-source framing note */}
        {hasMultipleSources && cluster.framing?.differences && (
          <div className="p-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] mb-3">
            <p className="text-[10px] text-[var(--text-secondary)] italic">
              {cluster.framing.differences}
            </p>
          </div>
        )}

        {/* Topics */}
        {cluster.matchedTopics.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {cluster.matchedTopics.slice(0, 4).map((t) => (
              <span
                key={t}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)] font-medium uppercase tracking-wider"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expand to see all articles in cluster */}
      {cluster.articles.length > 1 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-t border-[var(--border)] text-[10px] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <span>
              {expanded ? "Hide" : "Show"} all {cluster.articles.length} source angles
            </span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)]">
              {cluster.articles.map((article) => (
                <div key={article.id} className="pt-3">
                  <div className="flex items-center gap-2 mb-1">
                    <SourceBadge source={article.source} />
                    <span className="text-[10px] text-[var(--muted)]">
                      {formatRelative(article.publishedAt)}
                    </span>
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-[var(--text)] hover:text-[var(--accent)] transition-colors mb-1"
                  >
                    {article.title}
                  </a>
                  {article.summary && (
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                      {truncateWords(article.summary, 25)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
