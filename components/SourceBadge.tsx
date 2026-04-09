"use client";

import type { EditorialSource } from "@/types";
import clsx from "clsx";

const SOURCE_CONFIG: Record<
  EditorialSource | "polymarket",
  { label: string; color: string }
> = {
  guardian: { label: "Guardian", color: "bg-blue-100 text-blue-800 border-blue-300" },
  lemonde: { label: "Le Monde", color: "bg-purple-100 text-purple-800 border-purple-300" },
  aljazeera: { label: "Al Jazeera", color: "bg-amber-100 text-amber-800 border-amber-300" },
  polymarket: { label: "Polymarket", color: "bg-green-100 text-green-800 border-green-300" },
};

interface SourceBadgeProps {
  source: EditorialSource | "polymarket";
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source] ?? { label: source, color: "bg-gray-100 text-gray-700 border-gray-300" };
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border",
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}
