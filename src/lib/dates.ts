import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

function toDate(value: string | Date): Date {
  return typeof value === "string" ? parseISO(value) : value;
}

/** "3 hours ago", "in 2 days", etc. Null-safe → em dash. */
export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return formatDistanceToNowStrict(toDate(value), {
    addSuffix: true,
    locale: ko,
  });
}

/** Absolute timestamp for tooltips, e.g. "21 Jun 2026, 04:05 UTC". */
export function absoluteTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return `${format(toDate(value), "yyyy년 M월 d일 HH:mm", { locale: ko })} (현지 시간)`;
}

/** Short calendar date for chart axes / tables, e.g. "Jun 21". */
export function shortDate(value: string | Date): string {
  return format(toDate(value), "M월 d일", { locale: ko });
}
