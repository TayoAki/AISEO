import { NonRetryableError } from "./errors";

export type SnapshotStatus = "starting" | "running" | "ready" | "failed" | "canceled";

export type TriggerArgs = {
  datasetId: string;
  inputs: Record<string, unknown>[];
  /** Bright Data POSTs {snapshot_id, status} here when the snapshot finishes. */
  notifyUrl: string;
  /** Hints for the fake provider only; the live client ignores them. */
  fakeContext?: { brand?: string; website?: string; keyword?: string };
};

export interface CollectionProvider {
  trigger(args: TriggerArgs): Promise<string>;
  progress(snapshotId: string): Promise<SnapshotStatus>;
  download(snapshotId: string): Promise<unknown[]>;
  cancel(snapshotId: string): Promise<void>;
}

const API = "https://api.brightdata.com/datasets/v3";

class SnapshotNotReadyError extends Error {
  constructor(snapshotId: string) {
    super(`Snapshot ${snapshotId} is not ready yet`);
    this.name = "SnapshotNotReadyError";
  }
}

/** Live client for Bright Data's Web Scraper API (datasets v3). */
export class BrightDataClient implements CollectionProvider {
  constructor(private readonly token: string) {}

  private async request(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
    });
    if (response.status === 401 || response.status === 403) {
      throw new NonRetryableError("CONFIGURATION", `Bright Data rejected credentials (${response.status}) for ${path}`);
    }
    if (response.status === 400 || response.status === 404 || response.status === 422) {
      const body = (await response.text()).slice(0, 500);
      throw new NonRetryableError("COLLECTION_FAILED", `Bright Data ${response.status} for ${path}: ${body}`);
    }
    if (!response.ok && response.status !== 202) {
      const body = (await response.text()).slice(0, 300);
      // 429 and 5xx: let the job retry with backoff.
      throw new Error(`Bright Data ${response.status} for ${path}: ${body}`);
    }
    return response;
  }

  async trigger({ datasetId, inputs, notifyUrl }: TriggerArgs): Promise<string> {
    const params = new URLSearchParams({
      dataset_id: datasetId,
      notify: notifyUrl,
      include_errors: "true",
      format: "json",
    });
    const response = await this.request(`/trigger?${params.toString()}`, {
      method: "POST",
      body: JSON.stringify(inputs),
    });
    const body = (await response.json()) as { snapshot_id?: unknown };
    if (typeof body.snapshot_id !== "string" || body.snapshot_id.length === 0) {
      throw new Error("Bright Data did not return a snapshot_id");
    }
    return body.snapshot_id;
  }

  async progress(snapshotId: string): Promise<SnapshotStatus> {
    const response = await this.request(`/progress/${encodeURIComponent(snapshotId)}`, { timeoutMs: 15_000 });
    const body = (await response.json()) as { status?: unknown };
    const status = typeof body.status === "string" ? body.status : "running";
    if (status === "ready" || status === "failed" || status === "canceled" || status === "starting") return status;
    return "running";
  }

  async download(snapshotId: string): Promise<unknown[]> {
    const response = await this.request(`/snapshot/${encodeURIComponent(snapshotId)}?format=json`, {
      timeoutMs: 120_000,
    });
    if (response.status === 202) throw new SnapshotNotReadyError(snapshotId);
    const body: unknown = await response.json();
    if (!Array.isArray(body)) throw new Error(`Snapshot ${snapshotId} did not return a JSON array`);
    return body;
  }

  async cancel(snapshotId: string): Promise<void> {
    await this.request(`/snapshot/${encodeURIComponent(snapshotId)}/cancel`, { method: "POST", timeoutMs: 15_000 });
  }
}

/* ---------- Dataset inputs: one place to adjust prompts per platform ---------- */

export function perplexityInputs(keyword: string, country: string): Record<string, unknown>[] {
  const prompts = [
    keyword,
    `What are the most trusted sources and leading brands for "${keyword}"?`,
    `What questions do people ask about "${keyword}", and what are the best answers?`,
  ];
  return prompts.map((prompt, index) => ({ url: "https://www.perplexity.ai", prompt, country, index: index + 1 }));
}

export function chatgptInputs(prompts: string[], webSearch: boolean): Record<string, unknown>[] {
  return prompts.map((prompt, index) => ({
    url: "https://chatgpt.com/",
    prompt,
    country: "",
    web_search: webSearch,
    additional_prompt: "",
    index: index + 1,
  }));
}

export function geminiInputs(prompts: string[]): Record<string, unknown>[] {
  return prompts.map((prompt, index) => ({ url: "https://gemini.google.com/", prompt, index: index + 1 }));
}
