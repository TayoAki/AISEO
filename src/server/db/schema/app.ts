import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const planEnum = pgEnum("plan", ["free", "pro", "plus"]);
export const usageFeatureEnum = pgEnum("usage_feature", ["keyword", "visibility"]);
export const reportTypeEnum = pgEnum("report_type", ["keyword", "visibility"]);
export const reportStatusEnum = pgEnum("report_status", [
  "queued",
  "collecting",
  "analyzing",
  "completed",
  "failed",
  "canceled",
]);
export const quotaStateEnum = pgEnum("quota_state", ["reserved", "committed", "released"]);
export const collectionPlatformEnum = pgEnum("collection_platform", [
  "perplexity",
  "chatgpt",
  "gemini",
]);
export const collectionStatusEnum = pgEnum("collection_status", [
  "pending",
  "triggered",
  "ready",
  "failed",
  "canceled",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * One allowance per user, feature, plan and window. Free buckets are lifetime
 * (windowEnd null); paid buckets cover one monthly window anchored to the
 * subscription start. `reserved` counts reports in flight; a reservation is
 * committed on success and released on failure, so failures never cost quota.
 */
export const usageBucket = pgTable(
  "usage_bucket",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    feature: usageFeatureEnum("feature").notNull(),
    plan: planEnum("plan").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }),
    quota: integer("quota").notNull(),
    used: integer("used").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique("usage_bucket_window_uq").on(t.userId, t.feature, t.plan, t.windowStart),
    check("usage_bucket_non_negative", sql`${t.used} >= 0 and ${t.reserved} >= 0`),
    check("usage_bucket_within_quota", sql`${t.used} + ${t.reserved} <= ${t.quota}`),
  ],
);

export const report = pgTable(
  "report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: reportTypeEnum("type").notNull(),
    status: reportStatusEnum("status").notNull().default("queued"),
    progress: smallint("progress").notNull().default(0),
    step: text("step").notNull().default("Queued"),
    title: text("title").notNull(),
    /** Validated request input; shape depends on `type` (see reports/input.ts). */
    input: jsonb("input").notNull(),
    /** Plan at creation time; decides which paid sections were generated. */
    tier: planEnum("tier").notNull(),
    usageBucketId: uuid("usage_bucket_id")
      .notNull()
      .references(() => usageBucket.id, { onDelete: "cascade" }),
    quotaState: quotaStateEnum("quota_state").notNull().default("reserved"),
    idempotencyKey: text("idempotency_key").notNull(),
    /** Visibility only: the five generated prompts, persisted before any scrape. */
    prompts: jsonb("prompts").$type<string[]>(),
    result: jsonb("result"),
    resultVersion: smallint("result_version"),
    /** Safe to show to the user. */
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    /** Internal diagnostics. Never serialized to clients. */
    failureDetail: text("failure_detail"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("report_idempotency_uq").on(t.userId, t.idempotencyKey),
    index("report_user_created_idx").on(t.userId, t.createdAt.desc(), t.id.desc()),
    index("report_active_idx")
      .on(t.status, t.updatedAt)
      .where(sql`${t.status} in ('queued', 'collecting', 'analyzing')`),
  ],
);

/** One Bright Data collection (snapshot) per report and platform. */
export const reportCollection = pgTable(
  "report_collection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => report.id, { onDelete: "cascade" }),
    platform: collectionPlatformEnum("platform").notNull(),
    status: collectionStatusEnum("status").notNull().default("pending"),
    snapshotId: text("snapshot_id").unique(),
    recordCount: integer("record_count"),
    errorCount: integer("error_count"),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [unique("report_collection_platform_uq").on(t.reportId, t.platform)],
);

/**
 * What each report cost to produce: one row per paid provider call (a Claude
 * request, or a delivered Bright Data snapshot). Retries and failed reports are
 * included, because they are billed too. Costs are USD in micro-dollars.
 */
export const reportUsage = pgTable(
  "report_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => report.id, { onDelete: "cascade" }),
    /** "anthropic" or "brightdata". */
    provider: text("provider").notNull(),
    /** e.g. "keyword-analysis", "visibility-prompts", "collect:chatgpt". */
    task: text("task").notNull(),
    /** The Claude model that served the call (differs from the request when a fallback ran). */
    model: text("model"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    /** Bright Data rows delivered (billed per record, error rows included). */
    records: integer("records").notNull().default(0),
    /** Null when the price isn't known (e.g. a model missing from the price table). */
    costMicros: bigint("cost_micros", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("report_usage_report_idx").on(t.reportId), index("report_usage_created_idx").on(t.createdAt)],
);

/** Dedupe ledger for webhook events the app handles itself (e.g. Stripe onEvent). */
export const webhookEvent = pgTable("webhook_event", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});
