"use client";

import type { EditorialArticle } from "@/types";
import { SourceBadge } from "./SourceBadge";
import { formatRelative } from "@/lib/utils/date";
import { truncateWords } from "@/lib/utils/text";

interface ArticleCardProps {
  article: EditorialArticle;
  compact?: boolean;
}

export function ArticleCard({ article, compact = false }: ArticleCardProps) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-2)] transition-all duration-150 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <SourceBadge source={article.source} />
            {article.section && (
              <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">
                {article.section}
              </span>
            )}
            <span className="text-[10px] text-[var(--muted)] ml-auto">
              {formatRelative(article.publishedAt)}
            </span>
          </div>

          <h3 className="text-sm font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors leading-snug mb-1">
            {article.title}
          </h3>

          {!compact && article.summary && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1">
              {truncateWords(article.summary, 30)}
            </p>
          )}

          {article.matchedTopics.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {article.matchedTopics.slice(0, 3).map((t) => (
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

        <svg
          className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--accent)] flex-shrink-0 mt-0.5 transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </div>
    </a>
  );
}
