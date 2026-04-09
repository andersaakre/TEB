// ============================================================
// Simple file-based cache for ingested articles and markets
// Stores JSON to .cache/ directory at project root
// ============================================================

import fs from "fs";
import path from "path";
import type { CacheEntry, EditorialArticle, PredictionMarket } from "@/types";

// On Vercel, process.cwd() is read-only — use /tmp instead
const CACHE_DIR = process.env.VERCEL
  ? path.join("/tmp", "morning-brief-cache")
  : path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "ingestion.json");
const TOPICS_FILE = path.join(CACHE_DIR, "topics.json");
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export function readCache(): CacheEntry | null {
  try {
    ensureCacheDir();
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    const entry: CacheEntry = JSON.parse(raw);
    const age = Date.now() - new Date(entry.fetchedAt).getTime();
    if (age > CACHE_TTL_MS) return null; // stale
    return entry;
  } catch {
    return null;
  }
}

export function writeCache(
  articles: EditorialArticle[],
  markets: PredictionMarket[],
  errors: string[]
): CacheEntry {
  ensureCacheDir();
  const entry: CacheEntry = {
    fetchedAt: new Date().toISOString(),
    articles,
    markets,
    sourceErrors: errors,
  };
  fs.writeFileSync(CACHE_FILE, JSON.stringify(entry, null, 2), "utf-8");
  return entry;
}

export function forceClearCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
  } catch {
    // ignore
  }
}

// ── Topic persistence ────────────────────────────────────────

import type { Topic } from "@/types";
import { SEED_TOPICS } from "@/data/seed-topics";

export function readTopics(): Topic[] {
  try {
    ensureCacheDir();
    if (!fs.existsSync(TOPICS_FILE)) {
      writeTopics(SEED_TOPICS);
      return SEED_TOPICS;
    }
    const raw = fs.readFileSync(TOPICS_FILE, "utf-8");
    return JSON.parse(raw) as Topic[];
  } catch {
    return SEED_TOPICS;
  }
}

export function writeTopics(topics: Topic[]): void {
  ensureCacheDir();
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(topics, null, 2), "utf-8");
}

// ── User settings persistence ─────────────────────────────────

const SETTINGS_FILE = path.join(CACHE_DIR, "settings.json");

export interface UserSettings {
  industry: string;
}

const DEFAULT_SETTINGS: UserSettings = { industry: "FMCG" };

export function readSettings(): UserSettings {
  try {
    ensureCacheDir();
    if (!fs.existsSync(SETTINGS_FILE)) return DEFAULT_SETTINGS;
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: Partial<UserSettings>): UserSettings {
  ensureCacheDir();
  const next = { ...readSettings(), ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
