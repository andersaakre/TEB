"use client";

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <div className="h-3 bg-[var(--surface-2)] rounded w-1/4" />
      <div className="h-4 bg-[var(--surface-2)] rounded w-3/4" />
      <div className="h-3 bg-[var(--surface-2)] rounded w-full" />
      <div className="h-3 bg-[var(--surface-2)] rounded w-5/6" />
    </div>
  );
}

export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function BriefSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
        <div className="h-5 bg-[var(--surface-2)] rounded w-1/3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 bg-[var(--surface-2)] rounded w-full" />
          ))}
          <div className="h-3 bg-[var(--surface-2)] rounded w-2/3" />
        </div>
      </div>
      <SectionSkeleton rows={4} />
    </div>
  );
}
