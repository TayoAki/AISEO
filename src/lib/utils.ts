export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// Dates render on the server, so show them in UTC and say so rather than
// silently using whatever timezone the server runs in.
const dateTimeFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const dayFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

export function formatDate(iso: string | Date): string {
  return `${dateTimeFormat.format(new Date(iso))} UTC`;
}

export function formatDay(iso: string | Date): string {
  return dayFormat.format(new Date(iso));
}

/** "1 mention", "3 mentions". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Per-submission key so retries and double-clicks create one report. */
export function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}
