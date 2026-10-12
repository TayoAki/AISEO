/**
 * Runs once when the web server starts. Fails the boot (and so the Railway
 * deploy) when production configuration is missing, instead of failing on
 * the first request that needs it.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionConfig } = await import("./server/env");
  assertProductionConfig("web");
}
