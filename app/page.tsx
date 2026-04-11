"use client";

import { useState, useEffect, useCallback } from "react";
import type { Topic, MorningBrief, HotTopic, ClusteredStory, PredictionMarket, EditorialArticle } from "@/types";
import { TopicManager } from "@/components/TopicManager";
import { BriefSummary } from "@/components/BriefSummary";
import { HotTopics } from "@/components/HotTopics";
import { AskTheBrief } from "@/components/AskTheBrief";
import { ClusterCard } from "@/components/ClusterCard";
import { MarketCard } from "@/components/MarketCard";
import { todayLabel } from "@/lib/utils/date";
import { UserButton } from "@clerk/nextjs";
import clsx from "clsx";

const INDUSTRIES = [
  "FMCG","Financial Services","Healthcare","Technology",
  "Energy","Retail","Manufacturing","Consulting",
  "Real Estate","Media","Automotive","Pharma",
];

const LANGUAGES = [
  "English","French","Norwegian","Spanish","German",
  "Portuguese","Italian","Dutch","Arabic","Mandarin",
];

type Tab = "brief" | "news" | "markets";

interface DashboardState {
  topics: Topic[];
  brief: MorningBrief | null;
  hotTopics: HotTopic[];
  clusters: ClusteredStory[];
  markets: PredictionMarket[];
  articles: EditorialArticle[];
  articleCounts: Record<string, number>;
  marketCounts: Record<string, number>;
  errors: string[];
  fromCache: boolean;
  loading: boolean;
  initialized: boolean;
  lastRefreshed: string | null;
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({
    topics: [],
    brief: null,
    hotTopics: [],
    clusters: [],
    markets: [],
    articles: [],
    articleCounts: {},
    marketCounts: {},
    errors: [],
    fromCache: false,
    loading: true,
    initialized: false,
    lastRefreshed: null,
  });
  const [activeTab, setActiveTab] = useState<Tab>("brief");
  const [filterTopic, setFilterTopic] = useState<string>("all");
  const [industry, setIndustry] = useState<string>("FMCG");
  const [industryOpen, setIndustryOpen] = useState(false);
  const [language, setLanguage] = useState<string>("English");
  const [languageOpen, setLanguageOpen] = useState(false);

  // Load topics + settings on mount, then auto-load the brief
  useEffect(() => {
    Promise.all([
      fetch("/api/topics").then((r) => r.json()).catch(() => ({ topics: [] })),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
    ]).then(([topicsData, settingsData]) => {
      if (settingsData.industry) setIndustry(settingsData.industry);
      if (settingsData.language) setLanguage(settingsData.language);
      setState((prev) => ({ ...prev, topics: topicsData.topics ?? [], initialized: true }));
      // Auto-load the brief immediately after sign-in
      handleRefresh(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIndustryChange = async (newIndustry: string) => {
    setIndustry(newIndustry);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ industry: newIndustry }),
    }).catch(() => {});
  };

  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: newLanguage }),
    }).catch(() => {});
  };

  // Compute counts whenever clusters/markets change
  const computeCounts = useCallback(
    (clusters: ClusteredStory[], markets: PredictionMarket[], topics: Topic[]) => {
      const articleCounts: Record<string, number> = {};
      const marketCounts: Record<string, number> = {};
      for (const topic of topics) {
        articleCounts[topic.id] = clusters
          .filter((c) => c.matchedTopics.includes(topic.id))
          .reduce((sum, c) => sum + c.articles.length, 0);
        marketCounts[topic.id] = markets.filter((m) =>
          m.matchedTopics.includes(topic.id)
        ).length;
      }
      return { articleCounts, marketCounts };
    },
    []
  );

  const handleRefresh = useCallback(
    async (force = false) => {
      setState((prev) => ({ ...prev, loading: true, errors: [] }));

      try {
        const res = await fetch("/api/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error ?? "Refresh failed");

        // Deduplicate markets across clusters and brief sections
        const seenMarketIds = new Set<string>();
        const allMarkets: PredictionMarket[] = [];
        for (const cluster of (data.clusters ?? []) as ClusteredStory[]) {
          for (const m of cluster.relatedMarkets ?? []) {
            if (!seenMarketIds.has(m.id)) { seenMarketIds.add(m.id); allMarkets.push(m); }
          }
        }
        for (const section of (data.brief?.sections ?? []) as { markets: PredictionMarket[] }[]) {
          for (const m of section.markets ?? []) {
            if (!seenMarketIds.has(m.id)) { seenMarketIds.add(m.id); allMarkets.push(m); }
          }
        }

        const { articleCounts, marketCounts } = computeCounts(
          data.clusters ?? [],
          allMarkets,
          state.topics
        );

        setState((prev) => ({
          ...prev,
          brief: data.brief,
          hotTopics: data.hotTopics ?? [],
          clusters: data.clusters ?? [],
          markets: allMarkets,
          articles: (data.clusters ?? []).flatMap((c: ClusteredStory) => c.articles),
          errors: data.errors ?? [],
          fromCache: data.fromCache ?? false,
          articleCounts,
          marketCounts,
          loading: false,
          lastRefreshed: new Date().toLocaleTimeString(),
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          errors: [err instanceof Error ? err.message : "Unknown error"],
        }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.topics, computeCounts]
  );

  const handleTopicsChange = useCallback((topics: Topic[]) => {
    setState((prev) => ({ ...prev, topics }));
    fetch("/api/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(topics),
    }).catch(() => {});
  }, []);

  const handleAddHotTopic = useCallback(
    (hotTopic: HotTopic) => {
      const newTopic: Topic = {
        id: hotTopic.label.toLowerCase().replace(/\s+/g, "-"),
        displayName: hotTopic.label,
        keywords: hotTopic.keywords,
        active: true,
        color: "#6366f1",
      };
      handleTopicsChange([...state.topics, newTopic]);
    },
    [state.topics, handleTopicsChange]
  );

  const filteredClusters =
    filterTopic === "all"
      ? state.clusters
      : state.clusters.filter((c) => c.matchedTopics.includes(filterTopic));

  const filteredMarkets =
    filterTopic === "all"
      ? state.markets
      : state.markets.filter((m) => m.matchedTopics.includes(filterTopic));

  const activeTopics = state.topics.filter((t) => t.active);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-sm"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-base font-bold tracking-tight" style={{ color: "var(--text)" }}>
                The Execs Brief™
              </h1>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>{todayLabel()}</p>
            </div>
            {state.lastRefreshed && (
              <span
                className="hidden sm:inline text-[10px] border px-2 py-0.5 rounded"
                style={{ color: "var(--muted)", borderColor: "var(--border)" }}
              >
                {state.fromCache ? "Cached · " : ""}Updated {state.lastRefreshed}
              </span>
            )}
            {state.errors.length > 0 && (
              <span className="text-[10px] text-amber-400 px-2 py-0.5 rounded"
                style={{ border: "1px solid rgba(217,119,6,0.3)" }}>
                ⚠ Partial data
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Language selector */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setLanguageOpen((o) => !o)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-medium transition-all"
                style={{ borderColor: "var(--border)", color: "var(--text)", backgroundColor: "var(--surface)" }}
              >
                {language}
                <svg className={`w-3 h-3 transition-transform ${languageOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {languageOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg border shadow-lg overflow-hidden"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", minWidth: "140px" }}
                >
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => { handleLanguageChange(lang); setLanguageOpen(false); }}
                      className="w-full text-left px-4 py-2 text-xs transition-colors"
                      style={{
                        color: lang === language ? "var(--accent)" : "var(--text)",
                        backgroundColor: lang === language ? "var(--accent-dim)" : "transparent",
                        fontWeight: lang === language ? 600 : 400,
                      }}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Industry selector */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setIndustryOpen((o) => !o)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-medium transition-all"
                style={{ borderColor: "var(--border)", color: "var(--text)", backgroundColor: "var(--surface)" }}
              >
                {industry}
                <svg className={`w-3 h-3 transition-transform ${industryOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {industryOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg border shadow-lg overflow-hidden"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", minWidth: "160px" }}
                >
                  {INDUSTRIES.map((ind) => (
                    <button
                      key={ind}
                      onClick={() => { handleIndustryChange(ind); setIndustryOpen(false); }}
                      className="w-full text-left px-4 py-2 text-xs transition-colors"
                      style={{
                        color: ind === industry ? "var(--accent)" : "var(--text)",
                        backgroundColor: ind === industry ? "var(--accent-dim)" : "transparent",
                        fontWeight: ind === industry ? 600 : 400,
                      }}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User account button */}
            <UserButton />

            {state.brief && (
              <div className="hidden sm:flex items-center gap-3 text-[10px] mr-2" style={{ color: "var(--muted)" }}>
                <span>{state.clusters.reduce((s, c) => s + c.articles.length, 0)} articles</span>
                <span>{state.markets.length} markets</span>
              </div>
            )}
            <button
              onClick={() => handleRefresh(false)}
              disabled={state.loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-medium disabled:opacity-50 transition-all"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            >
              <svg className={clsx("w-3.5 h-3.5", state.loading && "animate-spin")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {state.loading ? "Fetching…" : "Refresh Brief"}
            </button>
            {state.brief && (
              <button
                onClick={() => handleRefresh(true)}
                disabled={state.loading}
                className="px-3 py-2 rounded-lg border text-[10px] disabled:opacity-50 transition-all"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                title="Force re-fetch"
              >
                Force
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main layout ──────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col gap-4 w-64 xl:w-72 flex-shrink-0">
          <TopicManager
            topics={state.topics}
            articleCounts={state.articleCounts}
            marketCounts={state.marketCounts}
            onTopicsChange={handleTopicsChange}
            loading={!state.initialized}
          />
          <HotTopics
            topics={state.hotTopics}
            onAddTopic={handleAddHotTopic}
            loading={state.loading && !state.brief}
          />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Mobile: Topics + Hot Topics */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TopicManager
              topics={state.topics}
              articleCounts={state.articleCounts}
              marketCounts={state.marketCounts}
              onTopicsChange={handleTopicsChange}
              loading={!state.initialized}
            />
            <HotTopics
              topics={state.hotTopics}
              onAddTopic={handleAddHotTopic}
              loading={state.loading && !state.brief}
            />
          </div>

          {/* Tabs */}
          {state.brief && (
            <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
              {(["brief", "news", "markets"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    "px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px",
                    activeTab === tab
                      ? "border-[var(--accent)]"
                      : "border-transparent hover:text-[var(--text)]"
                  )}
                  style={{
                    color: activeTab === tab ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  {tab === "brief"
                    ? "Brief"
                    : tab === "news"
                    ? `News (${state.clusters.length})`
                    : `Markets (${state.markets.length})`}
                </button>
              ))}
            </div>
          )}

          {/* Topic filter bar */}
          {state.brief && (activeTab === "news" || activeTab === "markets") && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterTopic("all")}
                className={clsx("text-[10px] px-3 py-1.5 rounded-full border transition-colors font-medium",
                  filterTopic === "all" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"
                )}
                style={filterTopic === "all" ? { backgroundColor: "var(--accent-dim)" } : {}}
              >
                All
              </button>
              {activeTopics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFilterTopic(t.id)}
                  className={clsx("text-[10px] px-3 py-1.5 rounded-full border transition-colors font-medium",
                    filterTopic === t.id ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"
                  )}
                  style={filterTopic === t.id ? { backgroundColor: "var(--accent-dim)" } : {}}
                >
                  {t.displayName}
                </button>
              ))}
            </div>
          )}

          {/* Tab content */}
          {activeTab === "brief" && (
            <BriefSummary brief={state.brief} loading={state.loading && !state.brief} />
          )}

          {activeTab === "news" && (
            <div>
              {filteredClusters.length === 0 ? (
                <div className="rounded-xl border p-10 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>No stories found. Try a different topic filter.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredClusters.map((cluster) => (
                    <ClusterCard key={cluster.id} cluster={cluster} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "markets" && (
            <div>
              {filteredMarkets.length === 0 ? (
                <div className="rounded-xl border p-10 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>No markets found. Try a different topic filter.</p>
                </div>
              ) : (
                <>
                  <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.2)" }}>
                    <p className="text-[10px] italic" style={{ color: "rgba(251,191,36,0.8)" }}>
                      Prediction markets reflect speculative crowd sentiment — not editorial fact. Use as a complementary signal only.
                    </p>
                  </div>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                    {filteredMarkets.map((m) => (
                      <MarketCard key={m.id} market={m} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Ask the Brief */}
          <div className="pt-2">
            <AskTheBrief key={state.lastRefreshed ?? "initial"} />
          </div>

          {/* Initial CTA */}
          {!state.brief && !state.loading && state.initialized && (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
              <div className="text-5xl mb-5">📰</div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text)" }}>Ready for your Execs Brief™?</h2>
              <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
                Fetches the latest from The Guardian, Le Monde, and Al Jazeera, enriched with Polymarket signals.
                Synthesized into an executive brief in seconds.
              </p>
              <button
                onClick={() => handleRefresh(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "var(--accent)" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Generate Execs Brief™
              </button>
            </div>
          )}

          {/* Loading CTA */}
          {state.loading && !state.brief && (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
              <div className="flex justify-center mb-5">
                <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Ingesting sources…</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Guardian · Le Monde · Al Jazeera · Polymarket</p>
            </div>
          )}

          {/* Errors */}
          {state.errors.length > 0 && state.brief && (
            <details className="rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
              <summary className="px-4 py-3 text-xs cursor-pointer" style={{ color: "var(--muted)" }}>
                {state.errors.length} source warning{state.errors.length > 1 ? "s" : ""}
              </summary>
              <div className="px-4 pb-3 space-y-1">
                {state.errors.map((e, i) => (
                  <p key={i} className="text-[10px] text-amber-400/70">{e}</p>
                ))}
              </div>
            </details>
          )}
        </main>
      </div>
    </div>
  );
}
