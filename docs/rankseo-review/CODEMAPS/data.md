<!-- Generated: 2026-10-12 | Source: TechWithEmmaYT/AI-SEO-Marketing-SaaS-App@de4843f | Files scanned: prisma/schema.prisma + 9 query sites | Token estimate: ~1150 -->
# RankSEO — Data model (MongoDB via Prisma 6.19)

`prisma/schema.prisma`, `provider = "mongodb"`, client generated to `generated/prisma` (gitignored,
built by `predev`/`prebuild`). No migrations: indexes reach Atlas only via `prisma db push`, and
no npm script runs it.

## Collections
```
user ─1:N─ session        (Better Auth)   userId String        onDelete: Cascade (Prisma-emulated)
     ─1:N─ account        (Better Auth)   userId String        password hash lives here
     ─1:N─ report         (product)       userId @db.ObjectId  onDelete: Cascade
verification              (Better Auth)   identifier index
subscription              (Stripe plugin) referenceId @db.ObjectId = user id, NO relation → orphaned on user delete
```

| Model | Key fields | Indexes |
|-------|------------|---------|
| `User` (`user`) | email (unique), emailVerified, stripeCustomerId? | `@@unique([email])` |
| `Session` | token (unique), expiresAt, ipAddress?, userAgent?, userId | `@@unique([token])`, `[userId]` |
| `Account` | accountId, providerId, password?, OAuth token fields | `[userId]` |
| `Verification` | identifier, value, expiresAt | `[identifier]` |
| `Subscription` | plan, referenceId, stripeCustomerId?, stripeSubscriptionId?, status, period/trial/cancel dates, billingInterval? | `[referenceId]`, `[stripeSubscriptionId]` |
| `Report` | type `KEYWORD\|VISIBILITY`, status `PENDING→COLLECTING→ANALYZING→COMPLETED\|FAILED`, keyword/language/country, website/brand/topic, progress, currentStep, triggerRunId, brightDataSnapshots String[], result Json?, errorMessage, completedAt | `[userId, createdAt]`, `[userId, type, status]`, `[triggerRunId]` |

Native-type inconsistency: `Report.userId` and `Subscription.referenceId` are `@db.ObjectId`, while
`Session.userId` and `Account.userId` are plain strings. `prisma validate` accepts this, but user
references are stored two ways, which ad-hoc Mongo queries and aggregations must handle.

## Query map (app code)
| Site | Operation | Filter / sort | Index served by |
|------|-----------|---------------|-----------------|
| `lib/billing.ts:36,43` | `report.count` ×2 per billing check | `userId, type` (+ `createdAt ≥ UTC month start` for paid) | prefix of `[userId,type,status]`; no index covers `type`+`createdAt` |
| `app/api/reports/route.ts:21` | `findMany` take 100 | `userId`, sort `createdAt desc` | `[userId, createdAt]` |
| `app/api/reports/[id]/route.ts:31` | `findFirst` | `_id, userId` | `_id` |
| `app/api/{keyword-research,search-visibility}/route.ts` | `create`, `update` ×1–2 | `_id` | `_id` |
| `lib/reports.ts:42` | `update` → FAILED | `_id` | `_id` |
| `trigger/*.ts` | `findUnique`, progress `update` ×4, snapshot `update` (`push` / set array), final `update`, `updateMany` on failure | `_id` (+ `type`, `status ≠ COMPLETED`) | `_id` |

`[triggerRunId]` is never queried, and `status` is never filtered in counts. Paid-plan counts
therefore fetch whole documents (including `result`) to test `createdAt`. A
`[userId, type, createdAt]` index would let both counts run from the index alone.
A report POST costs about 9 DB round trips (session ×2, subscription lookup ×3, counts ×2,
create, update).

## Lifecycle and integrity rules
- Usage is derived from rows. Free plans count every row of a type, of any status (lifetime). Paid
  plans count rows since the UTC month start, not the Stripe period start.
- Only `active`/`trialing` subscriptions count as paid. A `past_due` user falls back to free
  lifetime limits.
- History reads `take: 100` with no cursor, so older reports are unreachable.
- Progress writes are unconditional `update`s by `_id`. The terminal-failure write is guarded
  (`status ≠ COMPLETED`); the success write is not. So a `FAILED` row can become `COMPLETED`, and
  a replayed run can turn `COMPLETED` into `FAILED`.
- Version skew: the app resolves `@prisma/client` 6.19.3, while the Trigger.dev build pins
  `prisma` 6.19.0 (legacy mode).
- `result` is written from Zod-validated task output and read back with an unchecked `as` cast
  (`app/api/reports/[id]/route.ts:95-100`). It has no `schemaVersion`.
- Each result is bounded by its schema's array caps, so documents stay at a few KB, far below
  Mongo's 16 MB limit. A second copy lives in Trigger.dev as run output.
- Multi-document transactions are unused, so a replica set isn't required. Atlas provides one anyway.

## Related
[architecture](architecture.md) · [backend](backend.md) · [workers](workers.md)
