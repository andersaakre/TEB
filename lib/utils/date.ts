import { formatDistanceToNow, format, parseISO, isValid } from "date-fns";

export function safeParseDate(dateStr: string | undefined | null): string {
  if (!dateStr) return new Date().toISOString();
  try {
    const d = new Date(dateStr);
    if (isValid(d)) return d.toISOString();
  } catch {
    // fall through
  }
  return new Date().toISOString();
}

export function formatRelative(isoStr: string): string {
  try {
    return formatDistanceToNow(parseISO(isoStr), { addSuffix: true });
  } catch {
    return "recently";
  }
}

export function formatDate(isoStr: string): string {
  try {
    return format(parseISO(isoStr), "MMM d, yyyy HH:mm");
  } catch {
    return "Unknown date";
  }
}

export function todayLabel(): string {
  return format(new Date(), "EEEE, MMMM d, yyyy");
}
