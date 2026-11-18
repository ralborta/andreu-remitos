/**
 * Date utilities with proper timezone handling for Argentina (America/Argentina/Buenos_Aires).
 *
 * Common bug: parsing date-only strings like "2026-01-01" as `new Date("2026-01-01")` treats them as UTC midnight,
 * then converts to local timezone, causing a day shift (e.g., 2026-01-01 00:00 UTC → 2025-12-31 21:00 ART).
 */

export const TIMEZONE = "America/Argentina/Buenos_Aires";

/**
 * Parse a date-only string (YYYY-MM-DD) as local date at noon to avoid timezone shift.
 * Returns null if invalid.
 */
export function parseDateOnly(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const d = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format a Date as YYYY-MM-DD in Argentina timezone.
 */
export function formatDateOnly(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIMEZONE,
  }).split("/").reverse().join("-"); // DD/MM/YYYY → YYYY-MM-DD
}

/**
 * Format a Date or ISO string as localized date string (e.g., "31 de dic de 2025").
 */
export function formatLocalizedDate(dateOrIso: Date | string): string {
  const date = typeof dateOrIso === "string" ? (parseDateOnly(dateOrIso) ?? new Date(dateOrIso)) : dateOrIso;
  if (Number.isNaN(date.getTime())) return "—";
  
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIMEZONE,
  });
}

/**
 * Format a Date or ISO string as localized datetime string.
 */
export function formatLocalizedDateTime(dateOrIso: Date | string): string {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (Number.isNaN(date.getTime())) return "—";
  
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
}

/**
 * Format a Date or ISO string as time only (HH:MM).
 */
export function formatTime(dateOrIso: Date | string): string {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (Number.isNaN(date.getTime())) return "—";
  
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
}

/**
 * Get current date/time in Argentina timezone.
 */
export function now(): Date {
  return new Date();
}

/**
 * Get today's date as YYYY-MM-DD in Argentina timezone.
 */
export function today(): string {
  return formatDateOnly(now());
}
