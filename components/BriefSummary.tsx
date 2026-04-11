"use client";

import { useState, useRef } from "react";
import type { MorningBrief, BriefSection, PredictionMarket, HotTopic } from "@/types";
import { SourceBadge } from "./SourceBadge";
import { formatDate, formatRelative } from "@/lib/utils/date";
import { truncateWords } from "@/lib/utils/text";
import type { EditorialSource } from "@/types";

// ── Inline Polymarket bet ─────────────────────────────────────

function InlineMarket({ market }: { market: PredictionMarket }) {
  const prob = market.probabilityYes;
  const hasProb = prob !== undefined;
  const barColor =
    !hasProb ? "bg-gray-600"
    : prob > 66 ? "bg-emerald-500"
    : prob > 40 ? "bg-amber-500"
    : "bg-red-500";
  const textColor =
    !hasProb ? "text-gray-400"
    : prob > 66 ? "text-emerald-400"
    : prob > 40 ? "text-amber-400"
    : "text-red-400";

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
      className="group flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-green-700/50 transition-colors"
      style={{ backgroundColor: "rgba(16,185,129,0.04)" }}
    >
      {/* Probability column */}
      <div className="flex-shrink-0 w-14 text-center">
        {hasProb ? (
          <>
            <div className={`text-lg font-bold leading-none ${textColor}`}>{prob}%</div>
            <div className="text-[9px] text-[var(--muted)] mt-0.5">YES</div>
          </>
        ) : (
          <div className="text-xs text-[var(--muted)]">—</div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-snug group-hover:text-green-300 transition-colors"
           style={{ color: "var(--text)" }}>
          {truncateWords(market.title, 18)}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          {hasProb && (
            <div className="h-1 w-20 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${prob}%` }} />
            </div>
          )}
          <span className="text-[9px]" style={{ color: "var(--muted)" }}>
            Polymarket{vol ? ` · ${vol} vol` : ""}
          </span>
        </div>
      </div>
    </a>
  );
}

// ── Topic section ─────────────────────────────────────────────

function TopicSection({ section }: { section: BriefSection }) {
  const [expanded, setExpanded] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const hasContent = section.stories.length > 0 || section.markets.length > 0;

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      {/* Topic heading */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-4 group"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold tracking-wide uppercase"
              style={{ color: "var(--text)", letterSpacing: "0.06em" }}>
            {section.title}
          </h3>
          {section.sources.length > 0 && (
            <div className="flex gap-1">
              {[...new Set(section.sources)].map((s) => (
                <SourceBadge key={s} source={s as EditorialSource} />
              ))}
            </div>
          )}
          {!hasContent && (
            <span className="text-[10px]" style={{ color: "var(--muted)" }}>No coverage</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`}
          style={{ color: "var(--muted)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="pb-5 space-y-5">
          {/* No coverage note */}
          {section.content && !hasContent && (
            <p className="text-xs italic" style={{ color: "var(--muted)" }}>{section.content}</p>
          )}

          {/* Column synthesis — Barney Ronay / Guardian style prose */}
          {section.synthesis && (
            <p className="text-sm leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
              {section.synthesis}
            </p>
          )}

          {/* Why it matters — concise analytical one-liner */}
          {section.whyItMatters && (
            <p className="text-xs leading-relaxed pl-3 border-l-2"
               style={{ color: "var(--text-secondary)", borderColor: "var(--accent)" }}>
              {section.whyItMatters}
            </p>
          )}

          {/* Polymarket bets — only shown if relevant to this topic */}
          {section.markets.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                 style={{ color: "var(--muted)" }}>
                What markets are pricing in
              </p>
              <div className="grid gap-2" style={{
                gridTemplateColumns: section.markets.length === 1 ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))"
              }}>
                {section.markets.map((m) => (
                  <InlineMarket key={m.id} market={m} />
                ))}
              </div>
              <p className="text-[9px] mt-2 italic" style={{ color: "var(--muted)" }}>
                Market odds reflect speculative crowd sentiment, not editorial reporting.
              </p>
            </div>
          )}

          {/* Individual stories — collapsible sources */}
          {section.stories.length > 0 && (
            <div>
              <button
                onClick={() => setSourcesOpen(!sourcesOpen)}
                className="flex items-center gap-1.5 group/src"
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest"
                   style={{ color: "var(--muted)" }}>
                  Sources
                </p>
                <svg
                  className={`w-3 h-3 transition-transform ${sourcesOpen ? "" : "-rotate-90"}`}
                  style={{ color: "var(--muted)" }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {sourcesOpen && (
                <div className="space-y-2.5 mt-2">
                  {section.stories.map((story, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-0.5 flex-shrink-0 rounded-full mt-1.5 self-stretch"
                           style={{ backgroundColor: "var(--border)" }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <SourceBadge source={story.source} />
                          {story.multiSource && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                                  style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}>
                              +{story.sourceCount - 1} more
                            </span>
                          )}
                          <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                            {formatRelative(story.publishedAt)}
                          </span>
                        </div>
                        <a href={story.url} target="_blank" rel="noopener noreferrer"
                           className="group/link block">
                          <p className="text-xs leading-snug group-hover/link:opacity-75 transition-opacity"
                             style={{ color: "var(--text-secondary)" }}>
                            {story.title}
                          </p>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Outside your usual focus section ─────────────────────────

function OutsideFocusSection({
  synthesis,
  whyItMatters,
  hotTopics,
}: {
  synthesis: string;
  whyItMatters?: string;
  hotTopics?: HotTopic[];
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-4 group"
      >
        <h3 className="text-sm font-bold tracking-wide uppercase"
            style={{ color: "var(--text)", letterSpacing: "0.06em" }}>
          Outside your usual focus, but important today
        </h3>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`}
          style={{ color: "var(--muted)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="pb-5 space-y-5">
          {/* Individual hot-topic headlines — one per story, scannable at a glance */}
          {hotTopics && hotTopics.length > 0 && (
            <div className="space-y-3">
              {hotTopics.slice(0, 6).map((t) => (
                <div key={t.label} className="flex gap-3">
                  <div className="w-0.5 flex-shrink-0 rounded-full mt-1 self-stretch"
                       style={{ backgroundColor: "var(--border)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-snug mb-0.5" style={{ color: "var(--text)" }}>
                      {t.label}
                    </p>
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {t.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Synthesised narrative paragraph */}
          {synthesis && (
            <p className="text-sm leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
              {synthesis}
            </p>
          )}

          {/* Why it matters — collective business impact */}
          {whyItMatters && (
            <p className="text-xs leading-relaxed pl-3 border-l-2"
               style={{ color: "var(--text-secondary)", borderColor: "var(--accent)" }}>
              {whyItMatters}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface BriefSummaryProps {
  brief: MorningBrief | null;
  hotTopics?: HotTopic[];
  loading?: boolean;
}

export function BriefSummary({ brief, hotTopics, loading = false }: BriefSummaryProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (loading) {
    return (
      <div className="rounded-xl border animate-pulse overflow-hidden"
           style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        <div className="px-6 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="h-6 rounded w-1/3 mb-2" style={{ backgroundColor: "var(--surface-2)" }} />
          <div className="h-3 rounded w-1/4" style={{ backgroundColor: "var(--surface-2)" }} />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-6 py-5 border-b space-y-3" style={{ borderColor: "var(--border)" }}>
            <div className="h-4 rounded w-1/5" style={{ backgroundColor: "var(--surface-2)" }} />
            <div className="h-3 rounded w-full" style={{ backgroundColor: "var(--surface-2)" }} />
            <div className="h-3 rounded w-5/6" style={{ backgroundColor: "var(--surface-2)" }} />
            <div className="h-3 rounded w-4/6" style={{ backgroundColor: "var(--surface-2)" }} />
          </div>
        ))}
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="rounded-xl border p-10 text-center"
           style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        <div className="text-4xl mb-4">☕</div>
        <h3 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>No brief yet</h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Click <strong>Refresh Brief</strong> to ingest the latest news and generate your Execs Brief™.
        </p>
      </div>
    );
  }

  // Build broadcast-quality script: exec summary + synthesis paragraphs + why-it-matters.
  // Bullets are omitted — the narrative paragraphs read better aloud.
  const buildBroadcastScript = () => {
    const parts: string[] = [`The Execs Brief. ${brief.executiveSummary}`];
    for (const s of brief.sections) {
      if (!s.topicId) continue;
      if (s.synthesis) {
        parts.push(`${s.title}. ${s.synthesis}`);
      }
      if (s.whyItMatters) {
        parts.push(s.whyItMatters);
      }
    }
    return parts.filter(Boolean).join(" ");
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
  };

  const handlePlayBrief = async () => {
    if (isPlaying) { stopPlayback(); return; }

    const script = buildBroadcastScript();
    setIsPlaying(true);

    // Try OpenAI TTS first
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play();
        audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(url); audioRef.current = null; };
        audio.onerror = () => { setIsPlaying(false); URL.revokeObjectURL(url); audioRef.current = null; };
        return;
      }
    } catch {
      // fall through to browser TTS
    }

    // Browser TTS fallback — pick the best available English voice
    if (!window.speechSynthesis) { setIsPlaying(false); return; }
    const voices = window.speechSynthesis.getVoices();
    const pick = (
      voices.find((v) => /Google.*English|Samantha.*Enhanced|Daniel.*Enhanced|Aria.*Natural/i.test(v.name)) ||
      voices.find((v) => v.lang === "en-US" && !v.default) ||
      voices.find((v) => v.lang.startsWith("en"))
    );
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = 0.95;
    utterance.pitch = 0.95;
    if (pick) utterance.voice = pick;
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    window.speechSynthesis.speak(utterance);
  };

  const topicSections = brief.sections.filter((s) => s.topicId);
  const hasContent = topicSections.some(
    (s) => s.stories.length > 0 || s.markets.length > 0
  );

  return (
    <div className="rounded-xl border overflow-hidden"
         style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b"
           style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-1" style={{ color: "var(--text)" }}>
              The Execs Brief™
            </h2>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              {formatDate(brief.generatedAt)} · {brief.articleCount} articles · {brief.marketCount} markets
            </p>
          </div>

          {/* Play Brief — browser TTS, open for premium TTS upgrade */}
          <button
            onClick={handlePlayBrief}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all flex-shrink-0"
            style={isPlaying ? {
              borderColor: "rgba(239,68,68,0.5)", color: "rgb(248,113,113)",
              backgroundColor: "rgba(239,68,68,0.1)"
            } : {
              borderColor: "var(--border)", color: "var(--muted)"
            }}
          >
            {isPlaying ? (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
                Stop
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
                Play Brief
              </>
            )}
          </button>
        </div>

        {/* Source errors */}
        {brief.sourceErrors.length > 0 && (
          <div className="mt-3 p-2.5 rounded-lg"
               style={{ backgroundColor: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.3)" }}>
            <p className="text-[10px] font-semibold text-amber-400 mb-0.5">
              Partial data — some sources unavailable
            </p>
            {brief.sourceErrors.map((e, i) => (
              <p key={i} className="text-[10px] text-amber-400/70">{e}</p>
            ))}
          </div>
        )}
      </div>

      {/* ── Topic sections ──────────────────────────────────────── */}
      <div className="px-6">
        {!hasContent ? (
          <div className="py-10 text-center">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No stories matched your active topics. Try refreshing or broadening your topic keywords.
            </p>
          </div>
        ) : (
          topicSections.map((section) => (
            <TopicSection key={section.id} section={section} />
          ))
        )}

        {/* ── Outside your usual focus — only shown when topic sections have content */}
        {hasContent && brief.outsideFocusSynthesis && (
          <OutsideFocusSection
            synthesis={brief.outsideFocusSynthesis}
            whyItMatters={brief.outsideFocusWhyItMatters}
            hotTopics={hotTopics}
          />
        )}
      </div>

    </div>
  );
}
