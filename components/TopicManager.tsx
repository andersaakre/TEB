"use client";

import { useState } from "react";
import type { Topic } from "@/types";
import { v4 as uuidv4 } from "uuid";
import clsx from "clsx";

interface TopicManagerProps {
  topics: Topic[];
  articleCounts: Record<string, number>;
  marketCounts: Record<string, number>;
  onTopicsChange: (topics: Topic[]) => void;
  onSuggestKeywords?: (topicLabel: string) => Promise<string[]>;
  loading?: boolean;
}

const PRESET_COLORS = [
  "#6366f1", "#10b981", "#ef4444", "#f59e0b", "#14b8a6",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

export function TopicManager({
  topics,
  articleCounts,
  marketCounts,
  onTopicsChange,
  loading = false,
}: TopicManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKeywords, setEditKeywords] = useState("");

  const handleToggle = (id: string) => {
    const updated = topics.map((t) =>
      t.id === id ? { ...t, active: !t.active } : t
    );
    onTopicsChange(updated);
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const keywords = newKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywords.length === 0) keywords.push(name.toLowerCase());

    const newTopic: Topic = {
      id: uuidv4(),
      displayName: name,
      keywords,
      active: true,
      color: PRESET_COLORS[topics.length % PRESET_COLORS.length],
    };
    onTopicsChange([...topics, newTopic]);
    setNewName("");
    setNewKeywords("");
  };

  const handleDelete = (id: string) => {
    onTopicsChange(topics.filter((t) => t.id !== id));
  };

  const handleStartEdit = (topic: Topic) => {
    setEditingId(topic.id);
    setEditName(topic.displayName);
    setEditKeywords(topic.keywords.join(", "));
  };

  const handleSaveEdit = (id: string) => {
    const updated = topics.map((t) => {
      if (t.id !== id) return t;
      return {
        ...t,
        displayName: editName.trim() || t.displayName,
        keywords: editKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      };
    });
    onTopicsChange(updated);
    setEditingId(null);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Topics
        </h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-[var(--accent)] hover:text-[var(--text)] transition-colors"
        >
          {expanded ? "Done" : "Manage"}
        </button>
      </div>

      {/* Topic list */}
      <div className="p-3 space-y-1.5">
        {loading && topics.length === 0 ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded bg-[var(--surface-2)]" />)}
          </div>
        ) : topics.length === 0 ? (
          <p className="text-xs text-[var(--muted)] py-2 text-center">No topics yet. Add one below.</p>
        ) : (
          topics.map((topic) => (
            <div key={topic.id}>
              {editingId === topic.id ? (
                <div className="p-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--surface-2)] space-y-2">
                  <input
                    className="w-full text-xs bg-transparent border-b border-[var(--border)] text-[var(--text)] pb-1 outline-none focus:border-[var(--accent)]"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Topic name"
                  />
                  <textarea
                    className="w-full text-[10px] bg-[var(--background)] border border-[var(--border)] rounded p-2 text-[var(--text-secondary)] outline-none focus:border-[var(--accent)] resize-none"
                    value={editKeywords}
                    onChange={(e) => setEditKeywords(e.target.value)}
                    placeholder="Keywords, comma-separated"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(topic.id)}
                      className="text-[10px] px-3 py-1 rounded bg-[var(--accent)] text-white font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-[10px] px-3 py-1 rounded border border-[var(--border)] text-[var(--muted)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                  topic.active
                    ? "bg-[var(--surface-2)] border border-[var(--border)]"
                    : "opacity-50 border border-transparent"
                )}>
                  {/* Color dot */}
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: topic.color ?? "#6366f1" }}
                  />

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(topic.id)}
                    className="flex-1 text-left"
                  >
                    <span className="text-xs font-medium text-[var(--text)]">{topic.displayName}</span>
                  </button>

                  {/* Counts */}
                  <div className="flex items-center gap-2 text-[9px] text-[var(--muted)]">
                    <span>{articleCounts[topic.id] ?? 0}a</span>
                    <span>{marketCounts[topic.id] ?? 0}m</span>
                  </div>

                  {/* Edit / Delete */}
                  {expanded && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(topic)}
                        className="p-1 text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                        title="Edit topic"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(topic.id)}
                        className="p-1 text-[var(--muted)] hover:text-red-400 transition-colors"
                        title="Delete topic"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add topic */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--border)] space-y-2">
          <p className="text-[10px] text-[var(--muted)] pt-2">Add topic</p>
          <input
            className="w-full text-xs bg-[var(--background)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Energy Markets"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <input
            className="w-full text-xs bg-[var(--background)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
            value={newKeywords}
            onChange={(e) => setNewKeywords(e.target.value)}
            placeholder="Keywords: oil, gas, OPEC, energy"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="w-full text-xs py-2 rounded bg-[var(--accent)] text-white font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            + Add Topic
          </button>
        </div>
      )}
    </div>
  );
}
