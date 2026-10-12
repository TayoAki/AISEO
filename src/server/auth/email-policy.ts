/**
 * Sign-up email policy: block disposable domains and collapse aliases so one
 * inbox can't farm free credits (jane+1@gmail.com, j.a.n.e@gmail.com, ...).
 */

const DOT_INSENSITIVE_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function splitEmail(email: string): { local: string; domain: string } | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  return { local: trimmed.slice(0, at), domain: trimmed.slice(at + 1) };
}

/** Lowercases, strips +tags everywhere and dots for Gmail. */
export function normalizeEmail(email: string): string {
  const parts = splitEmail(email);
  if (!parts) return email.trim().toLowerCase();
  let local = parts.local.split("+")[0] ?? parts.local;
  let domain = parts.domain;
  if (DOT_INSENSITIVE_DOMAINS.has(domain)) {
    local = local.replaceAll(".", "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

type DisposableLists = { exact: Set<string>; wildcard: string[] };
let lists: Promise<DisposableLists> | undefined;

async function loadLists(): Promise<DisposableLists> {
  const [exact, wildcard] = await Promise.all([
    import("disposable-email-domains/index.json", { with: { type: "json" } }),
    import("disposable-email-domains/wildcard.json", { with: { type: "json" } }),
  ]);
  return {
    exact: new Set((exact.default as string[]).map((d) => d.toLowerCase())),
    wildcard: (wildcard.default as string[]).map((d) => d.toLowerCase()),
  };
}

export async function isDisposableEmail(email: string): Promise<boolean> {
  const parts = splitEmail(email);
  if (!parts) return false;
  lists ??= loadLists();
  const { exact, wildcard } = await lists;
  if (exact.has(parts.domain)) return true;
  return wildcard.some((base) => parts.domain === base || parts.domain.endsWith(`.${base}`));
}
