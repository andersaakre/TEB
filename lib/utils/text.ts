// Text utilities for keyword extraction, normalization, and similarity

/**
 * Normalize text for matching: lowercase, remove punctuation, collapse whitespace
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Simple stemming: strip the first matching English suffix only.
 * Chaining multiple strips causes "flyers" → "flyer" → "fly" → "f",
 * which produces false positives against short keywords like "Fed".
 */
export function stem(word: string): string {
  if (/ing$/.test(word)) return word.replace(/ing$/, "");
  if (/tions$/.test(word)) return word.replace(/tions$/, "");
  if (/tion$/.test(word)) return word.replace(/tion$/, "");
  if (/ies$/.test(word)) return word.replace(/ies$/, "y");
  if (/es$/.test(word)) return word.replace(/es$/, "");
  if (/s$/.test(word)) return word.replace(/s$/, "");
  if (/ed$/.test(word)) return word.replace(/ed$/, "");
  if (/er$/.test(word)) return word.replace(/er$/, "");
  if (/ly$/.test(word)) return word.replace(/ly$/, "");
  return word;
}

/**
 * Extract meaningful keywords from text (removes stopwords)
 */
const STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","as","is","was","are","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might","shall",
  "can","this","that","these","those","it","its","they","them","their","he",
  "she","we","us","i","me","my","you","your","his","her","our","who","which",
  "what","when","where","how","why","about","after","before","than","then",
  "there","here","not","no","also","up","out","into","over","under","more",
  "just","said","say","says","one","two","new","first","last","other","than",
  "so","if","all","any","each","both","few","more","most","some","such",
]);

export function extractKeywords(text: string, maxKeywords = 20): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(" ");
  const keywords: string[] = [];
  const seen = new Set<string>();

  for (const word of words) {
    if (word.length < 3) continue;
    if (STOPWORDS.has(word)) continue;
    const stemmed = stem(word);
    if (!seen.has(stemmed)) {
      seen.add(stemmed);
      keywords.push(word);
    }
    if (keywords.length >= maxKeywords) break;
  }

  return keywords;
}

/**
 * Compute Jaccard similarity between two keyword arrays
 */
export function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a.map(stem));
  const setB = new Set(b.map(stem));
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Quick headline similarity (Jaccard on title words, ignoring stopwords)
 */
export function headlineSimilarity(a: string, b: string): number {
  const kwA = extractKeywords(a, 30);
  const kwB = extractKeywords(b, 30);
  return jaccardSimilarity(kwA, kwB);
}

/**
 * Truncate text to n words
 */
export function truncateWords(text: string, n: number): string {
  const words = text.split(/\s+/);
  if (words.length <= n) return text;
  return words.slice(0, n).join(" ") + "…";
}

/**
 * Strip HTML tags from a string
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ").trim();
}
