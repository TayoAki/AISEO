import "server-only";

import { EventEmitter } from "node:events";

import { Client } from "pg";

import { getEnv } from "../env";
import { REPORT_UPDATES_CHANNEL } from "../reports/state";

/**
 * One dedicated LISTEN connection per server process, fanned out to every
 * open progress stream. Payloads are just report ids; subscribers re-read
 * the row, which stays the source of truth. Must not go through a
 * transaction-mode pooler.
 */
class ReportUpdatesListener {
  private readonly emitter = new EventEmitter();
  private client: Client | null = null;
  private connecting: Promise<void> | null = null;
  private retryDelayMs = 1_000;

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  private connect(): Promise<void> {
    if (this.client) return Promise.resolve();
    this.connecting ??= (async () => {
      // keepAlive surfaces half-open connections as errors instead of silence.
      const client = new Client({
        connectionString: getEnv().DATABASE_URL,
        application_name: "aiseo-realtime",
        keepAlive: true,
      });
      client.on("notification", (message) => {
        if (message.channel === REPORT_UPDATES_CHANNEL && message.payload) {
          this.emitter.emit(message.payload);
        }
      });
      client.on("error", (error) => {
        console.error("[realtime] listener error", { message: error.message });
        this.reset();
      });
      client.on("end", () => this.reset());
      await client.connect();
      await client.query(`LISTEN ${REPORT_UPDATES_CHANNEL}`);
      this.client = client;
      this.retryDelayMs = 1_000;
      // Wake every subscriber so it re-reads state missed while disconnected.
      for (const event of this.emitter.eventNames()) this.emitter.emit(event);
    })().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private reset(): void {
    const stale = this.client;
    this.client = null;
    stale?.removeAllListeners();
    void stale?.end().catch(() => undefined);
    if (this.emitter.eventNames().length > 0) {
      const delay = this.retryDelayMs;
      this.retryDelayMs = Math.min(this.retryDelayMs * 2, 30_000);
      setTimeout(() => void this.connect().catch(() => this.reset()), delay);
    }
  }

  async subscribe(reportId: string, onUpdate: () => void): Promise<() => void> {
    this.emitter.on(reportId, onUpdate);
    try {
      await this.connect();
    } catch (error) {
      console.error("[realtime] could not listen", { message: (error as Error).message });
      this.reset();
    }
    return () => {
      this.emitter.off(reportId, onUpdate);
    };
  }
}

const globalForRealtime = globalThis as unknown as { __aiseoListener?: ReportUpdatesListener };

export function getReportListener(): ReportUpdatesListener {
  globalForRealtime.__aiseoListener ??= new ReportUpdatesListener();
  return globalForRealtime.__aiseoListener;
}
