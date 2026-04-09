// ============================================================
// Hot Topics engine
// Suggests factual emerging topics (named entities, geopolitical
// events, organizations) not yet tracked by the user.
// ============================================================

import type { EditorialArticle, PredictionMarket, Topic, HotTopic } from "@/types";
import { normalizeText, stem } from "@/lib/utils/text";

// Words that look capitalised but are not meaningful topic labels
const TITLE_NOISE = new Set([
  // English articles / conjunctions / prepositions
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "this", "that", "these",
  "those", "it", "its", "they", "them", "their", "he", "she", "we",
  "us", "i", "me", "my", "you", "your", "his", "her", "our", "who",
  "which", "what", "when", "where", "how", "why", "not", "no", "also",
  "new", "says", "said", "say", "over", "after", "before", "amid",
  "into", "out", "up", "down", "more", "most", "than", "then", "there",
  "here", "just", "now", "two", "three", "four", "five", "six", "ten",
  "first", "last", "other", "another", "one", "all", "any", "some",
  "both", "each", "such", "about", "against", "through", "during",
  "while", "since", "between", "among", "under", "within", "without",
  "across", "report", "reports", "tells", "amid", "warns", "calls",
  "hits", "faces", "back", "takes", "make", "makes", "made", "give",
  "gives", "given", "keep", "kept", "comes", "come", "came", "goes",
  "gone", "went", "sets", "set", "puts", "put", "gets", "got", "still",
  "even", "much", "many", "high", "low", "long", "big", "small",
  "country", "countries", "nation", "nations", "government", "governments",
  "officials", "president", "minister", "ministers", "leader", "leaders",
  "people", "plan", "plans", "deal", "talks", "meet", "meeting",
  "week", "weeks", "month", "months", "year", "years", "day", "days",
  "time", "days", "including", "despite", "major", "latest", "amid",
  "could", "likely", "possible", "says", "according",
  // French stopwords (Le Monde)
  "le", "la", "les", "un", "une", "des", "du", "de", "et", "en",
  "est", "au", "aux", "par", "sur", "pour", "dans", "avec", "qui",
  "que", "qu", "se", "sa", "son", "ses", "leur", "leurs", "ne", "pas",
  "plus", "mais", "ou", "si", "car", "comme", "tout", "tous", "cette",
  "ce", "cet", "ces", "mon", "ma", "mes", "ton", "ta", "tes", "nous",
  "vous", "ils", "elles", "lui", "eux", "dont", "où", "après", "avant",
  "lors", "depuis", "entre", "contre", "sans", "selon", "vers", "très",
  "aussi", "encore", "bien", "même", "alors", "toujours", "déjà",
  "sous", "jusqu", "entre", "pendant", "autour", "autres", "autre",
  "plusieurs", "chaque", "tout", "toute", "aucun", "aucune", "seul",
  "seule", "certain", "certains", "certaines", "tel", "telle", "peu",
  "dont", "laquelle", "lequel", "lesquels", "lesquelles",
  // Arabic/French news verbs
  "annonce", "declare", "affirme", "indique", "souligne", "reagit",
  "denonce", "appelle", "reprend", "suspend", "reporte", "confirme",
  "cessez",
  // French live-blog markers ("EN DIRECT", "DIRECT :")
  "direct", "live", "breaking",
]);

// Known single-word entities that are always meaningful
const ALWAYS_ENTITY = new Set([
  "iran", "israel", "ukraine", "russia", "china", "usa", "us", "uk",
  "gaza", "nato", "trump", "biden", "putin", "hamas", "hezbollah",
  "opec", "fed", "imf", "eu", "un", "who", "wto", "taiwan", "korea",
  "india", "pakistan", "turkey", "syria", "iraq", "yemen", "sudan",
  "ethiopia", "niger", "mali", "venezuela", "cuba", "mexico", "brazil",
  "france", "germany", "poland", "hungary", "sweden", "finland",
  "bitcoin", "nvidia", "openai", "google", "apple", "microsoft",
  "spacex", "tesla", "amazon", "meta", "anthropic", "deepseek",
]);

// Demonym/adjective → canonical entity name.
// Normalises "Israeli" → "Israel", "American" → "US", etc. before aggregation
// so they don't appear as separate hot topics.
const ENTITY_NORMALISE: Record<string, string> = {
  israeli: "Israel",
  iranian: "Iran",
  ukrainian: "Ukraine",
  russian: "Russia",
  chinese: "China",
  american: "US",
  british: "UK",
  french: "France",
  german: "Germany",
  turkish: "Turkey",
  lebanese: "Lebanon",
  syrian: "Syria",
  iraqi: "Iraq",
  yemeni: "Yemen",
  pakistani: "Pakistan",
  indian: "India",
  korean: "Korea",
  taiwanese: "Taiwan",
  // French forms
  "moyen-orient": "Middle East",
  "moyen orient": "Middle East",
};

// Phrases to drop entirely — too generic / not useful as standalone topics
const ENTITY_BLOCKLIST = new Set([
  "middle east", "moyen orient", "middle eastern",
  "ceasefire", "cease fire", "peace deal", "peace talks",
  "white house", "oval office",
]);

const SOURCE_LABELS: Record<string, string> = {
  guardian: "The Guardian",
  lemonde: "Le Monde",
  aljazeera: "Al Jazeera",
};

// ── Entity extraction ─────────────────────────────────────────

function extractEntitiesFromTitle(title: string): string[] {
  const entities: string[] = [];
  const tokens = title.split(/[\s,;:!?()[\]"']+/).filter(Boolean);
  let run: string[] = [];

  for (const token of tokens) {
    const clean = token.replace(/[.,!?;:()"']+$/, "").replace(/^['"(]+/, "");
    if (!clean) continue;
    const lower = clean.toLowerCase();
    const isCapitalised = /^[A-Z]/.test(clean);
    const isKnownEntity = ALWAYS_ENTITY.has(lower);
    const isNoise = TITLE_NOISE.has(lower);
    const isShortAndNotEntity = clean.length <= 2 && !isKnownEntity;

    if ((isCapitalised && !isNoise && !isShortAndNotEntity) || isKnownEntity) {
      run.push(clean);
    } else {
      if (run.length >= 1) entities.push(run.join(" "));
      run = [];
    }
  }
  if (run.length >= 1) entities.push(run.join(" "));

  const hyphenRe = /\b([A-Za-z]{2,})-([A-Za-z]{2,})\b/g;
  let m;
  while ((m = hyphenRe.exec(title)) !== null) {
    const compound = m[0];
    if (!TITLE_NOISE.has(compound.toLowerCase())) {
      entities.push(compound.replace(/-/g, " "));
    }
  }

  for (const token of tokens) {
    const lower = token.toLowerCase().replace(/[^a-z]/g, "");
    if (ALWAYS_ENTITY.has(lower)) {
      entities.push(token.replace(/[^A-Za-z\s]/g, "").trim() || lower);
    }
  }

  const seen = new Set<string>();
  return entities
    .map((e) => e.trim())
    .filter((e) => {
      const words = e.split(/\s+/);
      if (words.length === 1) {
        const lower = e.toLowerCase();
        if (ALWAYS_ENTITY.has(lower)) return true;
        if (e.length >= 5 && /^[A-Z]/.test(e) && !TITLE_NOISE.has(lower)) return true;
        return false;
      }
      return words.some((w) => w.length >= 3 && !TITLE_NOISE.has(w.toLowerCase()));
    })
    .filter((e) => {
      const key = e.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// ── Candidate aggregation ─────────────────────────────────────

interface Candidate {
  label: string;
  articleCount: number;
  marketCount: number;
  sources: Set<string>;
  keywords: string[];
  articleIds: Set<string>;       // for co-occurrence dedup
  sampleHeadlines: string[];     // for LLM context
}

function aggregateCandidates(
  articles: EditorialArticle[],
  markets: PredictionMarket[]
): Map<string, Candidate> {
  const map = new Map<string, Candidate>();

  const upsert = (label: string, source: string, articleId: string, headline: string) => {
    // Normalise demonyms/adjectives to canonical entity name
    const normalised = ENTITY_NORMALISE[label.toLowerCase().trim()] ?? label;
    const key = normalised.toLowerCase().trim();
    label = normalised;
    if (key.length < 3) return;
    if (TITLE_NOISE.has(key)) return;
    if (ENTITY_BLOCKLIST.has(key)) return;

    if (!map.has(key)) {
      map.set(key, {
        label,
        articleCount: 0,
        marketCount: 0,
        sources: new Set(),
        keywords: label.toLowerCase().split(/\s+/),
        articleIds: new Set(),
        sampleHeadlines: [],
      });
    }
    const c = map.get(key)!;
    c.articleCount++;
    c.sources.add(source);
    c.articleIds.add(articleId);
    if (c.sampleHeadlines.length < 3 && !c.sampleHeadlines.includes(headline)) {
      c.sampleHeadlines.push(headline);
    }
    if (label.length > c.label.length) c.label = label;
  };

  for (const article of articles) {
    const entities = extractEntitiesFromTitle(article.title);
    for (const e of entities) {
      upsert(e, article.source, article.id, article.title);
    }
  }

  for (const market of markets) {
    const entities = extractEntitiesFromTitle(market.title);
    for (const e of entities) {
      const key = e.toLowerCase().trim();
      const c = map.get(key);
      if (c) c.marketCount += 1;
    }
  }

  return map;
}

// ── Geographic aliases ────────────────────────────────────────
// Maps place names to the entity keywords they represent, so that
// "Tehran" is recognised as a proxy for "Iran" even when "Tehran"
// isn't listed as a keyword in the "Iran Ceasefire" topic.
const GEOGRAPHIC_ALIASES: Record<string, string[]> = {
  tehran: ["iran"],
  "tel aviv": ["israel"],
  jerusalem: ["israel"],
  moscow: ["russia"],
  kyiv: ["ukraine"],
  beijing: ["china"],
  taipei: ["taiwan"],
  pyongyang: ["korea"],
  washington: ["us", "usa"],
  london: ["uk"],
  paris: ["france"],
  berlin: ["germany"],
  ankara: ["turkey"],
  baghdad: ["iraq"],
  damascus: ["syria"],
  riyadh: ["saudi arabia", "saudi"],
  "abu dhabi": ["uae"],
  dubai: ["uae"],
  cairo: ["egypt"],
  hormuz: ["iran", "strait"],
  hezbollah: ["lebanon", "iran"],
  hamas: ["gaza", "israel"],
};

// ── Overlap detection ─────────────────────────────────────────

function overlapsWithExistingTopics(label: string, topics: Topic[]): boolean {
  const labelLower = label.toLowerCase().trim();
  const labelWords = normalizeText(label).split(/\s+/);
  const labelStems = labelWords.map((w) => stem(w));

  // Expand via geographic aliases
  const aliasStems = (GEOGRAPHIC_ALIASES[labelLower] ?? [])
    .flatMap((alias) => normalizeText(alias).split(/\s+/).map((w) => stem(w)));

  const allCandidateStems = new Set([...labelStems, ...aliasStems]);

  for (const topic of topics) {
    // Build the full set of individual word stems from all topic keywords + display name
    const topicWordStems = new Set(
      [topic.displayName, ...topic.keywords]
        .flatMap((phrase) => normalizeText(phrase).split(/\s+/).map((w) => stem(w)))
    );

    // Any candidate stem found in topic stems → overlap
    for (const cs of allCandidateStems) {
      if (cs.length >= 3 && topicWordStems.has(cs)) return true;
    }

    // Display name contains the label directly
    if (normalizeText(topic.displayName).includes(normalizeText(label))) return true;
  }
  return false;
}

// ── Shared scoring & dedup logic ──────────────────────────────

function scoredAndDeduped(
  candidates: Map<string, Candidate>,
  existingTopics: Topic[],
  maxSuggestions: number
): Candidate[] {
  interface Scored extends Candidate { finalScore: number }

  const scored: Scored[] = [];

  for (const [, c] of candidates.entries()) {
    if (c.articleCount < 2) continue;
    if (overlapsWithExistingTopics(c.label, existingTopics)) continue;

    const crossSourceBonus = c.sources.size > 1 ? c.sources.size * 2 : 0;
    const score = c.articleCount + crossSourceBonus + c.marketCount * 0.5;
    const wordCount = c.label.split(/\s+/).length;
    const specificityBonus = wordCount >= 2 ? 1.5 : 0;
    scored.push({ ...c, finalScore: score + specificityBonus });
  }

  // Word-subset dedup: remove candidates whose words are a subset of a higher-scoring candidate
  const wordSubsetDeduped = scored
    .sort((a, b) => b.finalScore - a.finalScore)
    .filter((candidate, _, arr) => {
      const candidateWords = new Set(candidate.label.toLowerCase().split(/[\s\-]+/));
      return !arr.some((other) => {
        if (other === candidate || other.finalScore < candidate.finalScore) return false;
        const otherWords = new Set(other.label.toLowerCase().split(/[\s\-]+/));
        if (candidateWords.size >= otherWords.size) return false;
        return [...candidateWords].every((w) => otherWords.has(w));
      });
    });

  // Co-occurrence dedup: if two candidates appear in >40% of the same articles (Jaccard),
  // remove the lower-scoring one — prevents "Israel" + "Lebanon" all appearing
  // when they're about the same story.
  // Also removes a candidate whose articles are a strict subset of another's
  // (e.g. "Cécile Kohler" fully contained within "France").
  const coDeduped = wordSubsetDeduped.filter((a, aIdx) => {
    for (let j = 0; j < aIdx; j++) {
      const b = wordSubsetDeduped[j]; // b has higher finalScore
      if (a.articleIds.size === 0 || b.articleIds.size === 0) continue;

      // Count shared articles
      let shared = 0;
      let strictSubset = true;
      for (const id of a.articleIds) {
        if (b.articleIds.has(id)) shared++;
        else strictSubset = false;
      }

      // Strict subset: all of a's articles are in b
      if (strictSubset) return false;

      // Soft subset: small candidate (≤3 articles) where ≥50% of its articles overlap
      // — catches specific people/events sub-stories of a broader entity (e.g. "Cécile Kohler" under "France")
      if (a.articleIds.size <= 3 && shared >= Math.ceil(a.articleIds.size / 2)) return false;

      // Jaccard overlap
      const union = a.articleIds.size + b.articleIds.size - shared;
      const jaccard = shared / union;
      if (jaccard > 0.40) return false;
    }
    return true;
  });

  return coDeduped.slice(0, maxSuggestions);
}

// ── Public type for LLM pipeline ─────────────────────────────

export interface HotTopicCandidate {
  label: string;
  articleCount: number;
  marketCount: number;
  sources: string[];
  sampleHeadlines: string[];
  keywords: string[];
  score: number;
}

// ── Main exports ──────────────────────────────────────────────

/**
 * Returns raw candidates with sample headlines — for the LLM pipeline in ingest.ts.
 */
export function suggestHotTopicCandidates(
  articles: EditorialArticle[],
  markets: PredictionMarket[],
  existingTopics: Topic[],
  maxSuggestions = 10
): HotTopicCandidate[] {
  const candidates = aggregateCandidates(articles, markets);
  const deduped = scoredAndDeduped(candidates, existingTopics, maxSuggestions);

  return deduped.map((c) => ({
    label: c.label,
    articleCount: c.articleCount,
    marketCount: c.marketCount,
    sources: [...c.sources].map((s) => SOURCE_LABELS[s] ?? s),
    sampleHeadlines: c.sampleHeadlines,
    keywords: c.keywords,
    score: (c as { finalScore?: number }).finalScore ?? c.articleCount,
  }));
}

/**
 * Deterministic fallback — returns HotTopic[] with a simple reason string.
 */
export function suggestHotTopics(
  articles: EditorialArticle[],
  markets: PredictionMarket[],
  existingTopics: Topic[],
  maxSuggestions = 8
): HotTopic[] {
  const candidates = suggestHotTopicCandidates(articles, markets, existingTopics, maxSuggestions);

  return candidates.map((c) => {
    const reason =
      c.sources.length > 1
        ? `Covered by ${c.sources.join(", ")} — ${c.articleCount} articles`
        : `${c.articleCount} articles from ${c.sources[0] ?? "multiple sources"}`;

    return {
      label: c.label,
      reason,
      articleCount: c.articleCount,
      marketCount: c.marketCount,
      keywords: c.keywords,
      score: c.score,
    };
  });
}

/**
 * Suggest keywords for a new topic from Polymarket market titles.
 */
export function suggestKeywordsFromMarkets(
  markets: PredictionMarket[],
  topicLabel: string
): string[] {
  const topicLower = normalizeText(topicLabel);
  const related = markets.filter(
    (m) =>
      normalizeText(m.title).includes(topicLower) ||
      (m.category && normalizeText(m.category).includes(topicLower))
  );

  const allKeywords = related.flatMap((m) => m.extractedKeywords);
  const freq = new Map<string, number>();
  for (const kw of allKeywords) {
    freq.set(kw, (freq.get(kw) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([kw]) => kw);
}
