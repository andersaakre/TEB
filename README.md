# Morning Brief

An AI-synthesized executive news dashboard. Fetches the latest from **The Guardian**, **Le Monde**, and **Al Jazeera**, enriches with **Polymarket** prediction market signals, clusters stories, and synthesizes a structured briefing tailored to your tracked topics.

---

## Quick Start

```bash
cd morning-brief
npm install
npm run dev
# Open http://localhost:3000
# Click "Generate Morning Brief"
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GUARDIAN_API_KEY` | Yes | Guardian Open Platform API key — pre-configured in .env.local |
| `USE_MOCK_DATA` | No | Set to `true` for offline / mock mode |

## Architecture

```
morning-brief/
├── app/
│   ├── page.tsx                    # Main dashboard
│   └── api/
│       ├── refresh/route.ts        # POST — ingest all sources
│       ├── topics/route.ts         # CRUD topics
│       └── ask/route.ts            # Q&A over ingested data
├── components/
│   ├── BriefSummary.tsx            # Executive summary + TTS
│   ├── TopicManager.tsx            # Topic CRUD sidebar
│   ├── HotTopics.tsx               # Suggested emerging topics
│   ├── AskTheBrief.tsx             # Q&A chat interface
│   ├── ClusterCard.tsx             # Multi-source story cluster
│   └── MarketCard.tsx              # Prediction market card
├── lib/
│   ├── sources/guardian/           # Guardian REST API client + mapper
│   ├── sources/polymarket/         # Polymarket Gamma API client + mapper
│   ├── sources/rss/                # Generic RSS client + mapper + feed config
│   ├── briefing/ingest.ts          # Orchestrates all source ingestion
│   ├── briefing/synthesizer.ts     # Builds structured morning brief
│   ├── briefing/mock-data.ts       # Mock data for offline dev
│   ├── topics/matcher.ts           # Keyword + phrase topic matching
│   ├── topics/clusterer.ts         # Story clustering by similarity
│   ├── topics/hot-topics.ts        # Hot topic suggestion engine
│   └── cache/store.ts              # File-based cache (.cache/)
├── types/index.ts                  # Zod schemas + TypeScript types
├── data/seed-topics.ts             # Default topic seeds
└── .env.example
```

### Data flow

```
Click "Refresh Brief"
  → POST /api/refresh
  → Fetch Guardian + RSS (Le Monde, Al Jazeera) + Polymarket in parallel
  → Normalize → EditorialArticle / PredictionMarket
  → Topic matching (keyword + phrase + stemming)
  → Story clustering (Jaccard similarity on headlines + keywords)
  → Brief synthesis (sections per topic, summary, divergence signals)
  → Hot topic suggestion (bigram frequency + cross-source overlap)
  → Cache for 30 min → render dashboard
```

## Source Priority

Editorial sources always outweigh market signals:
1. The Guardian (REST API)
2. Le Monde (RSS)
3. Al Jazeera (RSS)
4. Polymarket — complementary signal only, always labeled as speculative

When sources agree → high confidence. Disagreement → explicitly called out. Editorial vs. market divergence → surfaced in "Where Signals Diverge" section.

## Dev Commands

```bash
npm run dev          # Development server
npx tsc --noEmit     # Type check
npm run build        # Production build
USE_MOCK_DATA=true npm run dev   # Offline mock mode
```

## Tradeoffs

| Decision | Rationale |
|---|---|
| File-based cache | Zero deps, perfect for MVP. Replace with Redis for multi-instance. |
| Deterministic synthesis | Fast, reliable, no LLM cost. LLM hooks marked with `// TODO` throughout. |
| Keyword matching | Covers 90% of cases without embeddings. Embedding abstraction ready to plug in. |
| Client-side state | SPA feel without RSC complexity for this use case. |

## Roadmap

1. User auth — per-executive topic sets
2. Saved brief history
3. Email delivery at 06:30 (Resend/SendGrid + cron)
4. Push notifications for breaking developments
5. LLM synthesis — replace deterministic builders with Claude calls (hooks in `synthesizer.ts`)
6. Personalized ranking model
7. Richer source comparison (NER, sentiment per source)
8. Source credibility and bias controls
9. Premium TTS — ElevenLabs / Azure Neural TTS
10. More sources — Reuters, AP, FT, Bloomberg RSS
