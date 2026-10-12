# Railway (railway.com) as the hosting and ops platform for the RankSEO rebuild: current state as of 2026-10-12

Conventions: Railway docs and pricing pages were accessed on 2026-10-12 and describe the platform on that date. Changelog entries, incident reports and articles carry their own publication dates. "[>12 mo - possibly stale]" marks anything older than about October 2025. "OBSERVED" marks a first-hand check made in this session on 2026-10-12 with the Railway MCP server connected to Claude Code. Every cost figure in section 2 is an **ESTIMATE**, and its assumptions are listed.

---

## 1. Product surface today: builds and services, managed Postgres (backups, PITR, HA, upgrades), Redis, volumes, buckets, cron, functions, networking, PR environments, templates, observability, scaling and regions

### Takeaway
As of October 2026, Railway is a broad, fast-moving container PaaS. It runs long-running services from a Dockerfile or a zero-config builder (Railpack or Nixpacks) and provides one-click Postgres, Redis, MySQL and MongoDB, volumes, S3-compatible buckets, cron, PR environments, a CDN/WAF, logs, metrics and tracing, and four regions. Its Postgres is "managed-lite." Railway provisions the database, patches the image, and offers one-click buttons for PITR, HA (Patroni), PgBouncer and major upgrades. The user still has to switch each of these on, and support scope ends once you change configuration through SQL, which the docs say includes extensions. Most database features are under 8 months old: HA arrived in March 2026, PITR in May 2026 and one-click major upgrades in September 2026.

### Cited Findings
**Build and deploy**
- Railway builds Next.js with "zero configuration" through Railpack/Nixpacks, or auto-detects a `Dockerfile`. A self-hosted Next.js deploy requires `output: "standalone"`. — [Railway Next.js guide](https://docs.railway.com/guides/nextjs)
- Builds are free: "Railway does not charge for build CPU, memory, base-image downloads, image exports, or image storage." — [Railway Pricing Plans docs](https://docs.railway.com/pricing/plans)
- Removed deployments keep their images for rollback for 24 h (Free/Trial), 72 h (Hobby), 120 h (Pro) or 360 h (Enterprise). — [Pricing Plans docs](https://docs.railway.com/pricing/plans)
- Pre-deploy commands such as `prisma migrate deploy` run in a separate container with the service's variables. That container cannot access volumes. If the migration fails, the deploy stops and the old version keeps running. — [Next.js guide](https://docs.railway.com/guides/nextjs); [Full-stack Next.js guide](https://docs.railway.com/guides/fullstack-nextjs)
- Deploy teardown: once the new deployment is live, the old one receives SIGTERM and then SIGKILL. **The default draining time is 0 seconds.** It can be set with `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`, and the BullMQ guide says to set it "long enough for your slowest job". — [Deployment teardown docs](https://docs.railway.com/deployments/deployment-teardown#draining-time); [BullMQ guide](https://docs.railway.com/guides/bullmq-jobs-retry-dlq#process-jobs-and-dead-letter-failures); [Rotate credentials guide](https://docs.railway.com/guides/rotate-credentials-zero-downtime#make-the-redeploy-itself-zero-downtime)
- **Functions** are services that "run a single file of TypeScript code using the Bun runtime," deployed from the canvas without a git repo. — [Functions docs](https://docs.railway.com/functions)
- **Cron** works on any service with a standard 5-field crontab. Minimum frequency is 5 minutes, schedules run in UTC, and "if a previous run is still active the next run is skipped, never terminated." — [Cron vs workers vs queues guide](https://docs.railway.com/guides/cron-workers-queues#cron-jobs); [Serverless guide](https://docs.railway.com/guides/cut-idle-costs-serverless#which-workloads-fit). CLI v5.65.0 (2026-10-12) adds `railway cron list` and `railway cron run`. — [railwayapp/cli releases](https://github.com/railwayapp/cli/releases)
- **Serverless** (formerly App Sleeping) puts a service to sleep 5–10 minutes after its last *outbound* packet. Open DB connections or poolers, Next.js telemetry and private-network traffic all keep it awake. The first request after sleep may return a 502. — [Serverless docs](https://docs.railway.com/deployments/serverless)
- **Feature flags** (2026-07-10): bool, string, number or JSON flags that can be changed at runtime without a redeploy. — [Changelog 2026-07-10](https://railway.com/changelog/2026-07-10-feature-flags)
- **Infrastructure as Code** became available experimentally in CLI 5.2.0 (2026-06-05). CLI 5.64.0 (2026-10-08) adds `--environment` to `plan`, `apply` and `pull`, and 5.63.4 (2026-10-06) adds a guided, reversible migration from config-as-code to IaC. — [Changelog 2026-06-05](https://railway.com/changelog/2026-06-05-sandboxes); [CLI releases](https://github.com/railwayapp/cli/releases)

**Databases: how "managed" Postgres really is**
- Database templates: PostgreSQL, PostgreSQL HA, PgBouncer, MySQL (+HA), Redis (+HA with Sentinel), MongoDB (+HA). "Railway maintains these templates (the Redis template is owned by Redis)." — [Databases docs](https://docs.railway.com/databases)
- Railway's responsibility matrix: Railway handles provisioning, storage, networking and security patches to the image. The **user** handles major upgrades ("one click for PostgreSQL"), backups and PITR ("User turns them on"), HA ("User turns it on; failover is then automatic"), PgBouncer ("User turns it on"), disk size ("User resizes the volume"), and schema, queries and data. — [Databases docs](https://docs.railway.com/databases#what-railway-manages)
- Support scope ends when the user changes the image, start command or template variables; changes the volume; changes HA members outside the dashboard/CLI flows; edits files over SSH; or changes "the database's own configuration through SQL ... roles, settings, **extensions**, `ALTER SYSTEM`." Support "does not make tuning, schema or query recommendations." — [Databases docs](https://docs.railway.com/databases#database-support-scope)
- Postgres features shipped in 2026, by date:
  - One-click HA Postgres, described as experimental (2026-03-13)
  - Postgres PITR (2026-05-15)
  - One-click PgBouncer (2026-06-19)
  - Automatic Postgres CVE patching (2026-08-07)
  - Postgres management in the CLI (2026-09-04)
  - One-click major version upgrades (2026-09-11)

  Sources: [Changelog index](https://railway.com/changelog); [HA changelog 2026-03-13](https://railway.com/changelog/2026-03-13-highly-available-postgres)
- Since 2026-07-31, the four core database templates no longer ship with a public TCP proxy, so new databases are private by default. — [Changelog #0301, 2026-07-31](https://railway.com/changelog/2026-07-31-railway-plugin-for-chatgpt)
- **PITR (Postgres):**
  - pgBackRest archives every WAL segment to a Railway bucket and takes a weekly full and a daily differential base backup. The last 4 fulls are kept, which gives a restore window of about 4 weeks.
  - Archiving is asynchronous. During a sustained S3 outage, a 5 GiB queue cap trips and pgBackRest drops WAL, which truncates the PITR window but keeps Postgres up.
  - A restore creates a **new sibling service** (`<source>-restored-YYYYMMDD-HHMM`). Cutover is manual.
  - PITR is not retroactive: the window starts at the first base backup taken after you enable it.
  - Minor-version pinning is not supported with PITR, so the image has to stay on a major tag such as `postgres-ssl:16`.
  - The bucket credential is read/write, with no read-only variant.

  Source: [PITR docs](https://docs.railway.com/volumes/point-in-time-recovery)
- **Volume backups:**
  - Schedules are Daily (kept 6 days), Weekly (kept 27 days) and Monthly (kept 89 days).
  - Backups are incremental copy-on-write, billed at the volume rate. Manual backups are limited to 50% of volume size.
  - "Wiping a volume deletes all backups."
  - Restore works only into the same project and environment.
  - The docs still say backups are "a newer feature that is still under development."

  Source: [Backups docs](https://docs.railway.com/volumes/backups)
- Railway's backup guide warns that volume backups "do not protect against deleting the volume" and that "only offsite logical dumps survive deleting the project itself." It includes a cron-service recipe that runs `pg_dump` to a bucket. — [Postgres backup & restore guide](https://docs.railway.com/guides/postgres-backups-restores)
- **HA Postgres:**
  - Built on Patroni, etcd and HAProxy. Defaults are 2 replicas plus 3 etcd "coordinator" nodes plus 3 HAProxy instances (ranges: 2–7 replicas, 3/5/7/9 etcd, 2–5 HAProxy).
  - Only official Railway images on Postgres **14–18** are supported. Custom images such as PostGIS or TimescaleDB are not, and the `:latest` tag must be pinned first.
  - Conversion drops active connections and changes endpoints. Railway first creates a volume backup that "expires in 21 days".
  - Failover is automatic, with HAProxy rerouting "within seconds".
  - In-place major upgrades are supported on HA clusters.

  Source: [Postgres HA docs](https://docs.railway.com/databases/postgresql-ha)
- A third-party 2026 comparison still describes Railway's HA as "experimental" — [techsy.io comparison](https://techsy.io/en/blog/railway-vs-render-vs-fly-io). That conflicts with the Oct 2026 docs, which list PostgreSQL HA as a standard template ([Databases docs](https://docs.railway.com/databases)). The changelog never announced a GA date.
- Redis HA (Sentinel) shipped 2026-08-20/21, MySQL HA 2026-08-28, and MongoDB HA plus MySQL PITR around 2026-09-17 to 10-01. Changelog sources differ by about one week on these dates. — [Changelog #0304](https://railway.com/changelog/2026-08-20-railway-anon); [Changelog index](https://railway.com/changelog)

**Storage**
- Volumes cost $0.15/GB-month. Maximum size is 5 GB on Hobby, 1 TB self-serve on Pro (the pricing page says 1000 GB), and 5 TB on Enterprise. — [Pricing Plans docs](https://docs.railway.com/pricing/plans); [Pricing page](https://railway.com/pricing)
- "Replicas cannot be used with volumes." — [Volumes reference](https://docs.railway.com/volumes/reference#caveats). Services with an attached volume "cannot run two deployments at once," so redeploying a volume-backed service (for example a single-node Postgres) has a brief downtime window. — [PR canaries guide](https://docs.railway.com/guides/ship-on-merge-pr-canaries#step-4-cut-over-with-zero-downtime)
- Zero-downtime volume resizing shipped 2026-01-30 and undoable volume deletes on 2026-05-01. Since late April 2026, all API deletes are soft deletes for 48 hours. — [Changelog index](https://railway.com/changelog); [Railway blog, 2026-04-29](https://blog.railway.com/p/your-ai-wants-to-nuke-your-database)
- Buckets are S3-compatible object storage at $0.015/GB-month with free egress. API operations are also free. — [Pricing page](https://railway.com/pricing); [Postgres backup guide](https://docs.railway.com/guides/postgres-backups-restores)

**Networking and edge**
- Public edge limits:
  - HTTP/1.1 and HTTP/2 are supported, plus websockets over HTTP/1.1.
  - "HTTP requests can run for up to **15 minutes** if data keeps transferring ... and are otherwise closed after 5 minutes with no data transferred."
  - "Websocket connections are exempt ... and can stay open indefinitely."
  - Request bodies must finish uploading within 5 minutes.
  - Limits are 10,000 concurrent connections and about 11,000 RPS per domain.

  Source: [Public networking specs & limits](https://docs.railway.com/networking/public-networking/specs-and-limits)
- **CDN:**
  - Free on all plans, off by default, enabled per service.
  - Static assets are cached by content type. HTML is cached in "Auto" mode only when the response carries `max-age` or `s-maxage`.
  - Honors `stale-while-revalidate` and `stale-if-error`.
  - "Server-Sent Events (`text/event-stream`) are never cached or buffered." WebSockets pass through.
  - Purging is per service with no per-URL purge; HTML is purged on deploy by default. There are no CDN hit-rate metrics.
  - Cache hits incur no egress.
  - The CDN docs page still shows a Priority Boarding (beta) banner.

  Source: [CDN docs](https://docs.railway.com/networking/cdn)
- A Fastly WAF with automated DDoS mitigation has been in front of all workloads since the Feb 2026 attacks — [Incident report Feb 18–21, 2026](https://blog.railway.com/p/incident-report-february-19-2026). Edge Rules (allow, block, challenge, redirect) shipped 2026-08-20 — [Changelog #0304](https://railway.com/changelog/2026-08-20-railway-anon).
- Private networking between services in a project avoids egress charges. Use `DATABASE_URL` (private), not `DATABASE_PUBLIC_URL`. — [Cost Control docs](https://docs.railway.com/pricing/cost-control#use-private-networking)
- HA static egress shipped 2026-05-22, and static outbound IPs and IPv6 became available in the CLI on 2026-07-03. — [Changelog index](https://railway.com/changelog)
- "Railway Authentication" (2026-10-09) is an identity-aware proxy that makes visitors sign in with Railway, so only project members can reach a service. It is meant for staging and internal tools and is **not** an end-user auth product. — [Guardrails docs](https://docs.railway.com/enterprise/guardrails#railway-authentication); [Changelog index](https://railway.com/changelog). Railway's own frontend-auth guide uses third-party auth such as Clerk or Supabase Auth. — [Frontend auth guide](https://docs.railway.com/guides/frontend-authentication)

**Environments**
- PR environments are supported. "Focused PR Environments only deploy services that have changed," using watch paths (shipped 2026-01-23). Bot PR environments control how PRs opened by bots are handled. — [PR environments guide](https://docs.railway.com/guides/preview-deployments-with-pr-environments); [Changelog index](https://railway.com/changelog)
- Changes are staged and reviewed as a diff before deploy. Admins can mark environments as restricted, which hides variables, logs and metrics from non-admins. Workspace Guardrails can block public domains and TCP proxies for non-admins. — [Railway blog, 2026-04-29](https://blog.railway.com/p/your-ai-wants-to-nuke-your-database)

**Observability**
- Log history: 3 days (Free), 7 days (Trial/Hobby), 30 days (Pro). Longer retention comes with committed spend. — [Pricing page](https://railway.com/pricing). Logging is rate-limited to 500 lines/second per replica on all plans, and excess lines are dropped. — [Logs docs](https://docs.railway.com/observability/logs#logging-throughput)
- Tracing shipped in September 2026:
  - Railway's edge traces a sample of requests with no code changes and returns `x-railway-trace-id`.
  - Best-effort automatic instrumentation covers Node.js, Go, Python, Ruby and Java. You can also use an OpenTelemetry SDK.

  Sources: [Debug incident guide](https://docs.railway.com/guides/debug-production-incident#tracing-options); [Automatic instrumentation docs](https://docs.railway.com/observability/tracing/automatic-instrumentation); [Changelog index](https://railway.com/changelog)
- Other observability shipped in 2026: database metrics and network flows (Jan–Feb), DNS logs (2026-07-24), and six new Observability panels (2026-07-31). — [Changelog index](https://railway.com/changelog)

**Scaling and regions**
- Per-service maximums, including replicas:

  | Plan | RAM | vCPU | Replicas |
  |---|---|---|---|
  | Hobby | 48 GB | 48 | 6 |
  | Pro | 1 TB | 1,000 | 42 |
  | Enterprise | 2.4 TB | 2,400 | 50 |

  Source: [Pricing Plans docs](https://docs.railway.com/pricing/plans)
- Services "automatically scale up vertically" within those limits, billed on actual usage. Horizontal scaling means adding replicas, which can span regions with traffic routed to the nearest one. — [Railway vs Vercel doc](https://docs.railway.com/platform/compare-to-vercel); [Advanced concepts](https://docs.railway.com/overview/advanced-concepts#deploy-options). "Deploy-less horizontal scaling" shipped 2026-02-06. — [Changelog index](https://railway.com/changelog)
- There are four deployment regions: US West (California), US East (Virginia), EU West (Amsterdam) and Southeast Asia (Singapore). Edge POPs are in "dozens of cities." — [Edge networking docs](https://docs.railway.com/networking/edge-networking#edge-pops-vs-deployment-regions); [Status page](https://status.railway.com)

**Templates relevant to RankSEO (OBSERVED via the Railway MCP `search-templates` tool, 2026-10-12)**
- Trigger.dev: 3 community templates, none verified by Railway, with 42, 8 and 6 deployments. One describes itself as "Trigger.dev v4 complete stack: Webapp + Supervisor". — [Railway template marketplace](https://railway.com/deploy)
- Inngest: 3 community templates, none verified, with 15, 1 and 33 deployments. The last is an "[Updated Oct 2026] Preconfigured production inngest with postgres and redis". — [Railway template marketplace](https://railway.com/deploy)
- Better Auth: Next.js starters such as "Next.js Better Auth Prisma SaaS Starter Kit", with 13, 3 and 1 deployments, none verified. — [Railway template marketplace](https://railway.com/deploy)
- Template authors earn a 25% kickback of usage. — [Railway vs Vercel doc](https://docs.railway.com/platform/compare-to-vercel)

**New AI-era primitives**
- Sandboxes are VMs billed at VM rates. They went GA on all plans around 2026-09-17/18. Cloud Agents entered beta on 2026-08-07. — [Changelog #0308](https://railway.com/changelog/2026-09-18-railway-sandboxes); [Pricing page](https://railway.com/pricing); [Changelog index](https://railway.com/changelog)

### Inferences
- Every primitive RankSEO needs exists natively and can live in one project canvas: a Next.js service, a worker service from the same repo with a different start command, Postgres with PITR, Redis, a bucket and cron. Railway's own guide shows exactly this Next.js + Postgres + Redis/BullMQ worker + bucket layout.
- **What Railway does *not* provide**:
  - A durable workflow or execution engine. There is no first-party equivalent of Trigger.dev or Inngest, so you either run BullMQ yourself, self-host Trigger.dev or Inngest from unverified community templates, or keep a hosted workflow SaaS.
  - End-user auth, a BaaS-style data API, or managed realtime.

  All of these would come from your own code (Better Auth, SSE or websockets) or from third parties. This is the main contrast with an all-in-one backend like InsForge.
- "Managed Postgres" on Railway means a managed container plus opt-in tooling. By feature list it is now close to Render's managed Postgres (PITR, HA, pooling, one-click upgrades), but:
  - you have to switch each feature on;
  - the features are young (2026);
  - support scope is narrow. If you run `CREATE EXTENSION vector`, a literal reading of the docs puts the database outside support scope.
- The 0-second default drain is a trap for long jobs: a redeploy would SIGKILL any worker that is mid-job. Set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` and make jobs resumable.

### Gaps
- I found no statement on whether Railway volumes are replicated across hosts or zones, so the durability of a single-node Postgres volume if a host is lost is unclear. Search terms "volume durability replicated" returned nothing relevant.
- Railway has no documentation or verified template for self-hosting Trigger.dev v4. I did not test the community templates.
- I found no documented horizontal autoscaling driven by CPU or queue metrics; only vertical autoscaling plus manual replicas is documented.
- I could not confirm whether HA Postgres and the CDN are formally GA or still beta/Priority Boarding.
- Whether Railway's pgvector or other extension templates count as in-scope for support was not checked.

---

## 2. Pricing, spend controls and realistic monthly cost (low vs moderate traffic)

### Takeaway
Pricing is pure usage metering on top of a plan minimum:
- Hobby is $5/month with $5 of usage included. Pro is $20 per workspace with $20 of usage included and unlimited seats.
- RAM costs $10/GB-month, CPU $20/vCPU-month (billed per second on actual utilization), egress $0.05/GB, volumes $0.15/GB-month and buckets $0.015/GB-month. Builds are free.

ESTIMATE: Next.js + 1 worker + Postgres + Redis should cost about **$20/month on Pro** at low traffic, about **$45–100/month** at moderate traffic, and roughly **$80–140/month** with HA Postgres. Hard usage limits with email alerts are available, but hitting a hard limit takes every workload offline.

### Cited Findings
- Plans:

  | Plan | Fee | Included usage | Notes |
  |---|---|---|---|
  | Free Trial | $0 | $5 one-time credit, 30 days | |
  | Free | $0 | $1/month | 1 vCPU / 0.5 GB per service |
  | Hobby | $5/month | $5/month | |
  | Pro | $20 per workspace | $20/month | Unlimited seats |
  | Enterprise | Custom | Custom | |

  Included usage "resets each billing cycle and does not accumulate." — [Pricing page](https://railway.com/pricing); [Pricing Plans docs](https://docs.railway.com/pricing/plans)
- Plan limits:

  | Limit | Hobby | Pro |
  |---|---|---|
  | Projects | 50 | 100 |
  | Services | 50 | 100 |
  | Members per project | 3 | unlimited |
  | Max volume | 5 GB | 1000 GB |
  | Custom domains | 2 | 20 |
  | Concurrent builds | 3 | 10 |

  Source: [Pricing page](https://railway.com/pricing)
- Container usage rates:
  - Memory: $0.00000386 per GB/s, about $10/GB-month
  - CPU: $0.00000772 per vCPU/s, about $20/vCPU-month
  - Volumes: about $0.15/GB-month
  - Service egress: $0.05/GB
  - Object storage: $0.015/GB-month with free egress

  Source: [Pricing page](https://railway.com/pricing)
- VM rates for sandboxes and cloud agents are $50/GB-month RAM and $50/vCPU-month, drawn from the same included credit. — [Pricing Plans docs](https://docs.railway.com/pricing/plans#vm-pricing)
- Billing examples: Hobby with $3 of usage costs $5 total; Hobby with $7 of usage costs $7 ($5 + $2). Pro works the same way against $20. — [Pricing Plans docs](https://docs.railway.com/pricing/plans#included-usage)
- PITR has no separate fee. It is billed as bucket storage plus network egress for the WAL uploads, "a few GB of compressed WAL ... per day under steady write load (idle databases are nearly free)." Restore traffic is free. — [PITR docs](https://docs.railway.com/volumes/point-in-time-recovery#cost)
- Usage limits:
  - Separate **Compute** and **Agent** limits, each with a custom email alert (soft) and a hard limit.
  - The minimum hard limit is $10. Reminders go out at 75%, 90% and 100%.
  - "Once your resource usage hits the specified hard limit, all your workloads will be taken offline."
  - The Agent hard limit defaults to $5 on Hobby and $20 on Pro and cannot be removed.
  - Limits can be set from the CLI: `railway usage limit set --target workspace --soft 75 --hard 125`.

  Sources: [Cost Control docs](https://docs.railway.com/pricing/cost-control#usage-limits); usage limits in the CLI shipped 2026-07-10 ([Changelog](https://railway.com/changelog/2026-07-10-feature-flags))
- Replica limits cap CPU and RAM per replica, but "setting replica limits too low will cause your service to crash." — [Cost Control docs](https://docs.railway.com/pricing/cost-control#replica-limits)
- Railway may charge part of a bill early in the cycle as a fraud and risk control. Prepaying is no longer possible "as of March 30th" (the year is not stated) **[>12 mo - possibly stale]**. — [Pricing Plans docs](https://docs.railway.com/pricing/plans#faqs)
- After cancellation, volume data is deleted 30 days after expiry (Free/Trial), 60 days (Hobby) or 90 days (Pro). — [Pricing Plans docs](https://docs.railway.com/pricing/plans#faqs)
- Business Class Support is a paid add-on for Pro and is included with Enterprise. — [Pricing Plans docs](https://docs.railway.com/pricing/plans#additional-services)
- Railway Agent usage is billed "at the exact per-token rates published on anthropic.com/pricing, with no markup," or through your own ChatGPT or OpenRouter account. — [Railway Agent docs](https://docs.railway.com/ai/railway-agent)
- Railway's own comparison (vendor-authored, "Last updated: June 2026") says Vercel Pro is "$20 per user/month plus usage; active CPU $0.128/hour." — [Railway vs Vercel doc](https://docs.railway.com/platform/compare-to-vercel)
- Secondary sources (2026 blog posts, taken from a search-result summary, so attribution to individual pages is approximate): "a typical full-stack app with a database runs $7–15/month" on Railway, and a Hetzner CX22 (2 vCPU, 4 GB, 40 GB, 20 TB traffic) is €3.99/month after an April 2026 price increase. — [solodevstack (Railway vs Coolify)](https://solodevstack.com/blog/railway-vs-coolify-solo-developers); [solodevstack (Railway vs Hetzner)](https://solodevstack.com/blog/railway-vs-hetzner-solo-developers); [aicoolies](https://aicoolies.com/comparisons/coolify-vs-railway)

### Inferences
**ESTIMATES. The assumptions are mine, not Railway's.** Railway bills *actual* average RAM and CPU use. RAM and CPU averages are guesses for a Node 20+/Next.js 15–16 standalone server, a Node BullMQ worker, and Railway's stock Postgres and Redis images. LLM calls (Claude via an AI gateway) and Bright Data are external costs and not included. A worker waiting on a webhook holds a little memory and almost no CPU.

**Scenario A: low traffic** (beta or first customers; ≤10k page views/month; ≤100 keyword or visibility jobs/day; DB ≤2 GB)

| Item | Assumption | Est. $/mo |
|---|---|---|
| Next.js (1 replica) | 0.35 GB avg RAM, 0.05 vCPU avg | 3.50 + 1.00 = 4.50 |
| Worker (1 replica) | 0.25 GB, 0.03 vCPU | 2.50 + 0.60 = 3.10 |
| Postgres (single node) | 0.25 GB, 0.03 vCPU, 2 GB volume | 2.50 + 0.60 + 0.30 = 3.40 |
| Redis | 0.05 GB, 0.01 vCPU, 0.5 GB volume | ~0.78 |
| Egress | 10 GB | 0.50 |
| PITR + volume backups | ~3 GB WAL egress, ~5 GB bucket, ~1 GB incremental backups | ~0.38 |
| **Usage total** | | **≈ $13 (range $10–25)** |
| **Bill on Hobby** | $5 fee includes $5 usage | **≈ $13** |
| **Bill on Pro** | $20 fee includes $20 usage | **$20 (usage fully covered)** |

**Scenario B: moderate traffic** (~100k–300k SSR page views/month; ~2,000 jobs/day with up to 15-minute webhook waits; 2 replicas each for web and worker; DB ~15 GB)

| Item | Assumption | Est. $/mo |
|---|---|---|
| Next.js (2 replicas) | 1.2 GB total, 0.30 vCPU total | 12.00 + 6.00 = 18.00 |
| Worker (2 replicas) | 0.8 GB total, 0.20 vCPU | 8.00 + 4.00 = 12.00 |
| Postgres (single node) | 1 GB, 0.20 vCPU, 15 GB volume | 10.00 + 4.00 + 2.25 = 16.25 |
| Redis | 0.2 GB, 0.05 vCPU, 1 GB volume | 3.15 |
| Egress | 150 GB (less if CDN caches marketing pages and assets; cache hits incur no egress) | 7.50 |
| PITR + volume backups | ~1 GB/day WAL → 30 GB egress ($1.50); ~40 GB bucket ($0.60); ~8 GB incremental backups ($1.20) | 3.30 |
| **Usage total = Pro bill** | the $20 fee is credited against usage | **≈ $60 (range $45–100)** |

**Scenario C: Scenario B plus Postgres HA** (default topology: primary + 2 replicas, 3 etcd, 3 HAProxy)
- Delta, all assumptions:
  - 2 extra Postgres nodes, each 1 GB, 0.1 vCPU and 15 GB: about $28.50
  - 3 etcd nodes, each 0.1 GB, 0.02 vCPU and 1 GB volume: about $4.65
  - 3 HAProxy instances, each 0.05 GB and 0.02 vCPU: about $2.70
  - Total delta: about +$36
- **≈ $96/month (range $80–140).**

Other notes:
- For a paying SaaS, Pro is the sensible tier. It costs only about $7/month more than Hobby at low traffic and adds 30-day logs, private support threads, 20 custom domains, volumes over 5 GB, team seats and longer rollback image retention.
- Spend control: set a soft email alert, for example at $50 in Scenario B. Be careful with hard limits, because hitting one takes the whole production stack offline, databases included. Use replica limits instead to cap runaway per-service usage.
- Serverless sleeping will not help this stack. DB connections, Redis polling and Next.js telemetry keep services awake, and the first request after sleep can return a 502.

### Gaps
- I found no published benchmark of real RAM and CPU use for Next.js, Postgres or Redis on Railway. The utilization figures above are assumptions and should be checked against Railway's Usage page after a week of real traffic.
- I did not verify whether static outbound IPs cost extra or are limited to certain plans. This matters if Bright Data or others allowlist by IP.
- Committed-spend tier thresholds, which unlock HIPAA BAA, SSO and longer logs, are referenced but were not found in the fetched pages.

---

## 3. Reliability: incidents 2025–2026, status page, SLA, support tiers, compliance, Postgres durability

### Takeaway
Railway had a rough 11 months. There were about 8 notable incidents from November 2025 to September 2026. Two of them stopped customer databases: an abuse-system mass SIGTERM on 2026-02-11, and an 8-hour platform-wide outage on 2026-05-19 after Google Cloud suspended Railway's GCP account. Most incidents were control-plane, routing or vendor-dependency failures, and no reported incident lost customer data. Pro has no published uptime SLA: contractual SLAs are Enterprise-only, and SLO-backed support starts at $5k/month spend. Compliance is solid: SOC 2 Type II, SOC 3, HIPAA BAA as a paid add-on, and a GDPR DPA.

### Cited Findings
**Incident timeline**
- **2025-11-25:** deploys paused for about 2.5 h for Free, Trial and Hobby after GitHub API latency led to Temporal worker OOM crashes. Running workloads stayed up. — Summary by [bex.co (a competitor)](https://bex.co/blog/2026/09/21/railway-five-outages-owning-control-plane), citing [Railway report](https://blog.railway.com/p/incident-report-november-25-2025)
- **2025-12-08:** dashboard, CLI and API down for about 8–25 min after a migration on a ~1B-row control-plane table stalled on a lock. Running deployments stayed online. — [bex.co summary](https://bex.co/blog/2026/09/21/railway-five-outages-owning-control-plane), citing [Railway report](https://blog.railway.com/p/incident-report-december-8-2025)
- **2026-01-26 to 01-29:** intermittent GitHub login and deploy failures caused by GitHub token rate limits. — [bex.co summary](https://bex.co/blog/2026/09/21/railway-five-outages-owning-control-plane), citing [Railway report](https://blog.railway.com/p/incident-report-january-26-2026)
- **2026-02-11:**
  - A false-positive anti-abuse ruleset sent SIGTERM to "roughly 3% of workloads." This "included databases such as Postgres and MySQL."
  - Disruption ran from about 14:47 to 16:31 UTC, and automated restarts finished at 18:31.
  - The report does not mention data loss.

  Source: [Railway incident report](https://blog.railway.com/p/incident-report-february-11-2026)
- **2026-02-18 to 02-21:**
  - Nine DDoS waves, a fiber cut that reduced upstream capacity, and an unrelated Cloudflare BGP incident caused "intermittent service disruptions across all regions." Customer impact totaled about 2 h 53 min across events.
  - Remediation: a global Fastly WAF, and Business/Enterprise customers moved to a separate proxy shard. Compensation was offered.

  Source: [Railway incident report](https://blog.railway.com/p/incident-report-february-19-2026)
- **2026-05-19 to 05-20:**
  - GCP suspended Railway's production account in what Railway describes as an incorrect automated action.
  - About 8 h of platform-wide impact: the dashboard and API returned 503s, and databases and GCP compute went offline. Workloads on Railway Metal and AWS "stayed up but returned 404 errors after routing caches expired." Builds were blocked.
  - Remediation commitments: remove the dependency on the GCP-hosted network control plane ("making this a true mesh"), extend HA database shards across AWS and Metal, and move GCP out of the data-plane hot path. Railway did not commit to leaving GCP.
  - Railway's statement: "Railway owns our vendor choices, and we ultimately own this one."

  Source: [Railway incident report](https://blog.railway.com/p/incident-report-may-19-2026-gcp-account-outage)
- **2026-07-02:**
  - US East incident from 07:44 to 12:01 UTC. A carrier backbone degradation and rerouting left one US East zone without a stable internet route for about 20 min.
  - Storage connections got stuck on the management network, giving degraded disk performance for about 2 h. "At peak, roughly 20,000 host-to-host private network links were blackholed."

  Source: [Railway incident report](https://blog.railway.com/p/incident-report-july-2-2026-us-east-services-outage)
- **2026-09-30:**
  - A new routing service deployed before its schema migration, so new connections to all Railway domains returned 404 for about 5 min (07:35–07:40 UTC). Private-network DNS also failed during that window.
  - "no data was lost". Workloads kept running.

  Source: [Railway incident report](https://blog.railway.com/p/incident-report-sept-30-2026-routing-disruption)
- **April 2026:** a customer incident, PocketOS. A Cursor agent running Claude Opus 4.6 used an account-scoped Railway API token found on disk and called `volumeDelete`, deleting the production DB *and* its volume-level backups.
  - Railway says the data was recovered. Third-party accounts describe up to about 30 h of disruption and conflicting recovery details.
  - Railway's response: all API deletes are now 48-hour soft deletes, and backup deletion is also delayed.

  Sources: [Railway blog, 2026-04-29](https://blog.railway.com/p/your-ai-wants-to-nuke-your-database); [MakerChecker incident DB](https://www.makerchecker.ai/incidents/aid-2026-0002/); [DEV postmortem summary](https://dev.to/axrisi/railway-database-deleted-by-an-ai-agent-the-pocketos-postmortem-2p7p)

**Status page and SLA**
- The status page on 2026-10-12 showed 90-day uptime of 100.00% for "Overall Railway" and non-regional components such as the Dashboard and API. Each region (US East, US West, EU West, SE Asia) showed 99.98%, with September at 99.95%. The page reports only "incidents with significant, widespread impact". — [status.railway.com](https://status.railway.com). The /history page returned 404 when fetched, so I could not compile a full-year uptime record.
- SLA: "Railway can enter into a contractual SLA under Railway's negotiated pricing offering" (Enterprise). Enterprise also adds "contractual SLAs, SSO, dedicated support ... HIPAA BAAs, dedicated VMs, and support SLOs." — [Support docs](https://docs.railway.com/platform/support#enterprise); [Pricing page](https://railway.com/pricing)

**Support tiers**
- Trial, Free and Hobby get community support on Central Station, with no guaranteed response.
- Pro gets direct help "usually within 72 hours" and private threads. This "excludes SLOs and application-level support."
- There is no email support.
- Business Class becomes available at $5,000/month spend. Its SLOs: P1 acknowledged within 1 h, 24/7; P2 the same business day; P3 within 2 business days. It also includes monthly uptime summaries and RCAs for routing-layer outages.
- Slack Connect requires Enterprise with $2,000/month committed spend.

Source: [Support docs](https://docs.railway.com/platform/support)

**Compliance**
- "Railway is SOC 2 Type II certified and SOC 3 certified." Audit reports are available through [trust.railway.com](https://trust.railway.com). — [Compliance docs](https://docs.railway.com/enterprise/compliance)
- HIPAA works on a shared-responsibility model. The BAA "is an add-on with a paid monthly spend threshold," and with a BAA in effect Railway staff can no longer access running workloads. — [Compliance docs](https://docs.railway.com/enterprise/compliance#hipaa-baa)
- A GDPR DPA can be signed self-serve, and EU DORA documents are available under NDA. — [Compliance docs](https://docs.railway.com/enterprise/compliance)

**Infrastructure and company context**
- Railway runs on its own hardware ("Railway Metal") plus AWS and GCP. A mid-2025 changelog said about 90% of workloads ran on Metal **[>12 mo - possibly stale]**. — [Changelog 2025-06-13](https://railway.com/changelog/2025-06-13-last-call-migrate-metal) (from a search snippet). A June 2026 blog summary claims that "40% of its workloads are now on cloud burst solutions." This is **unverified** and comes from an aggregator. — [plushcap summary](https://www.plushcap.com/companies/railway/blog/summaries/2026/6)
- Railway raised a $100M Series B led by TQ Ventures on 2026-01-22. — [Railway changelog 2026-01-23](https://railway.com/changelog/2026-01-23-100m-series-b). The CEO cited 100,000 paid users across 25,000 businesses, and secondary reports put ARR above $10M per Axios Pro. These come from a search-result summary, so attribution to individual outlets is approximate. — [VCA Online](https://www.vcaonline.com/news/2026012211/railway-raises-100-million-series-b-as-ai-pushes-today-s-cloud-infrastructure-past-its-limits/); [TechTarget](https://www.techtarget.com/searchcloudcomputing/news/366637659/Upstart-cloud-provider-Railway-turns-heads-with-speed); [Crypto Briefing](https://cryptobriefing.com/railway-secures-100-m-expand-ai-ready-cloud-platform/?rand=59535)

### Inferences
- The recurring failure modes are platform-level: control-plane dependency on GCP, routing deploy races, automated enforcement and DDoS. Database storage corruption is not among them. For RankSEO, the practical risk is a few hours of downtime about twice a year, not data loss, provided offsite backups exist.
- Since a May-2026-style event took databases offline platform-wide, an extra Railway HA cluster would not have helped. Real resilience against Railway itself means **offsite `pg_dump`s to a non-Railway bucket** and a rehearsed restore on another provider.
- For a solo or small-team B2C/SMB SaaS, Pro's 72-hour best-effort support and lack of an SLA are acceptable. For B2B uptime commitments they are not, unless spend reaches the $5k/month Business Class threshold.
- The 2026 remediation work (Fastly WAF, a separate shard for paying tiers, schema-gated rollouts, moving GCP off the hot path) suggests improving maturity. There is no long track record yet, though.

### Gaps
- I found no public uptime SLA percentage for any self-serve plan, and no 12-month status history (the history page 404'd).
- I found no data on Postgres volume replication or durability guarantees (RPO/RTO) for single-node databases.
- The cause of Google's suspension remained unexplained in the sources.

---

## 4. Next.js on Railway vs Vercel; long-running workers, SSE/websockets, no serverless timeouts

### Takeaway
Railway runs Next.js as a long-running `next start` standalone server, so there are no function timeouts, websockets stay open indefinitely, and workers run as ordinary always-on services. The trade-offs:
- You take on self-hosting chores: a shared cache handler for ISR or `revalidateTag` across replicas, a consistent Server Actions encryption key and `deploymentId`, and a drain period.
- You get 4 origin regions plus an opt-in CDN, which is weaker than Vercel's edge, ISR and image pipeline.
- SSE requests through Railway's edge are capped at **15 minutes** and need heartbeats. WebSockets are exempt.

For RankSEO's mostly dynamic, authenticated dashboards and minutes-long jobs, the trade favors Railway.

### Cited Findings
- Railway's (vendor-authored) comparison says Vercel functions have a "maximum ... 800 seconds (~13.3 minutes)," 4 GB of memory, a 250 MB bundle, and possible cold starts. It says Railway has "Unlimited" execution time, no cold starts, and support for persistent connections and Docker. — [Railway vs Vercel doc, June 2026](https://docs.railway.com/platform/compare-to-vercel)
- Railway edge limits: HTTP requests last up to 15 min if data keeps flowing and close after 5 min idle. Websockets are exempt and "can stay open indefinitely." — [Specs & limits](https://docs.railway.com/networking/public-networking/specs-and-limits)
- The CDN never caches or buffers SSE and passes WebSockets through. — [CDN docs](https://docs.railway.com/networking/cdn#streaming-and-websockets)
- Next.js self-hosting guide (Next.js 16.4.0 docs, lastUpdated 2026-10-01):
  - `next/image` optimization "works self-hosted with zero configuration when deploying using `next start`." On glibc Linux it may need sharp memory-allocator configuration.
  - The ISR and data cache is "stored on the local filesystem (on disk) of each Next.js server instance." With multiple instances you need a custom `cacheHandler` (for example Redis) and `refreshTags()` to coordinate `revalidateTag` across instances.
  - Multi-instance deploys need a consistent `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, otherwise you get "Failed to find Server Action" errors, and a `deploymentId` to handle version skew.
  - Streaming requires that proxies don't buffer.
  - "Platforms should allow a configurable drain period (10-30 seconds is recommended)."

  Source: [Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting)
- Railway's default drain time is 0 s; set it with `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`. — [Deployment teardown docs](https://docs.railway.com/deployments/deployment-teardown#draining-time)
- Railway's full-stack Next.js guide:
  - Architecture: Next.js + Postgres (Prisma) + Redis/BullMQ + a worker (`npx tsx worker.ts`, same repo, no public domain) + a bucket with presigned uploads (`expiresIn: 3600`), all over private networking.
  - Pre-deploy runs `npx prisma migrate deploy`.
  - The guide does **not** cover SSE or websockets, draining, ISR with replicas, or image optimization.

  Source: [Full-stack Next.js guide](https://docs.railway.com/guides/fullstack-nextjs)
- The CDN caches HTML only when Next.js sends `s-maxage` or `max-age` ("Auto" mode suits "frameworks like Next.js"). It honors `stale-while-revalidate`, which Next.js ISR emits. Purges are per service, not per URL. — [CDN docs](https://docs.railway.com/networking/cdn)
- BullMQ on Railway: a SIGTERM handler calls `worker.close()`, and interrupted jobs "are marked stalled by BullMQ and retried automatically." — [BullMQ guide](https://docs.railway.com/guides/bullmq-jobs-retry-dlq)
- Builds are free on Railway. — [Pricing Plans docs](https://docs.railway.com/pricing/plans)

### Inferences
- **Recommended Railway pattern for the 15-minute Bright Data wait:**
  1. The worker triggers the Bright Data job and persists `{jobId, snapshotId, state}` in Postgres. It does not keep a promise alive.
  2. Bright Data's webhook hits a Next.js route handler, which records the delivery and enqueues a continuation job in BullMQ.
  3. Add a delayed BullMQ "timeout" job at about 16 minutes as a fallback poll.

  This survives redeploys, even with the 0 s default drain, and needs no durable-execution vendor.
- **Realtime progress:** have the worker publish progress to Redis pub/sub, and have Next.js stream SSE from a route handler.
  - Send a heartbeat every 15–30 s, so connections are never idle for 5 minutes.
  - Let `EventSource` reconnect with `Last-Event-ID`, because each stream ends at 15 minutes.
  - Alternatively, use WebSockets, which have no limit but need a custom server or a separate WS service, since App Router route handlers don't upgrade sockets natively.
  - Use Redis pub/sub rather than in-memory emitters when the web service has more than one replica.
- If the web service is scaled past one replica, ship a Redis `cacheHandler` and set the encryption key and `deploymentId`. With 1 replica (enough for low traffic), none of that is needed.
- Vercel's remaining advantages matter mostly for marketing and SEO pages: a global edge, an automatic ISR and data cache, image CDN and skew protection. Railway's CDN plus `s-maxage` covers static marketing pages reasonably well.

### Gaps
- I found no independent benchmarks of Railway vs Vercel build times, TTFB or image-optimization performance.
- I did not verify Vercel's current limits independently; the figures come from Railway's competitor-authored page.
- I found no Railway documentation on Next.js-specific CDN or ISR configuration, such as a Railway-maintained cache handler.

---

## 5. AI-agent workflows: Railway MCP server, CLI, Railway Agent, and reported Claude Code experience

### Takeaway
Railway is among the most agent-operable PaaS platforms in October 2026:
- A hosted remote MCP server (`mcp.railway.com`, launched 2026-04-17) connects through the CLI or OAuth. In this session it exposes 68 tools covering deploy, logs, metrics, traces, variables, domains, buckets, volumes, templates, docs and a `railway-agent` delegate.
- A very actively released CLI (v5.65.0 on 2026-10-12) covers everything else, including Postgres PITR and HA and usage limits.
- An in-dashboard "Railway Agent" (Anthropic models at cost) diagnoses failed deploys and opens PRs.

The risk side is that agents can delete things. The April 2026 PocketOS deletion shows how, and Railway has since added 48-hour soft deletes and scoped OAuth.

### Cited Findings
- **How to connect:**
  - The MCP server runs at `mcp.railway.com` and is reached either through `railway mcp` (CLI ≥5.44.0, reusing the `railway login` credentials) or directly with OAuth. `railway setup agent` configures agent skills, MCP and auth in one command.
  - "Project tokens are not accepted," because the server requires a user identity.
  - OAuth tokens are short-lived and scoped to the workspaces and projects you choose.

  Source: [Railway MCP Server docs](https://docs.railway.com/ai/mcp-server)
- The documented remote tool list is short: `whoami`, `list-projects`, `create-project`, `list-services`, feature-flag tools, `redeploy`, `accept-deploy` and `railway-agent`. — [Railway MCP Server docs](https://docs.railway.com/ai/mcp-server#available-mcp-tools)
- **OBSERVED (2026-10-12):** the Railway MCP server connected in this Claude Code session exposes **68 tools**, far more than the docs list. They include:
  - Logs, metrics and diagnosis: `get-logs`, `get-service-metrics`, `http-requests`, `http-error-rate`, `http-response-time`, `list-traces`, `get-trace`, `get-tracing`, `set-service-tracing`, `get-deployment-diagnosis`
  - Variables: `list-variables`, `set-variables`
  - Services and deployments: `create-service`, `update-service`, `delete-service`, `create-deployment`, `list-deployments`, `restart-service`, `connect-service-source`
  - Templates and functions: `deploy-template`, `search-templates`, `describe-template`, `create-function`, `update-function-source-code`
  - Storage, domains and networking: `create-bucket`, `get-bucket-credentials`, `create-volume`, `delete-volume`, `generate-domain`, `update-domain`, TCP proxies
  - Webhooks, feature flags and docs: webhook tools, feature flags, `search-docs`, `fetch-docs`
  - Staging and delegation: `get-staged-changes`, `accept-deploy`, `railway-agent`

  The server's instructions tell agents to "Confirm with the user before destructive actions (e.g. `accept-deploy`)." I saw **no** MCP tools for Postgres PITR, HA or backups, or for usage and billing limits; those are CLI-only (`railway postgres pitr|ha`, `railway usage limit`). — Docs for comparison: [Railway MCP Server docs](https://docs.railway.com/ai/mcp-server)
- A local MCP server (`railway mcp local`) exposes a different, broader tool set, including `remove_volume` and `remove_service`. It "returns a preview before requiring `confirm: true`." — [Railway MCP Server docs](https://docs.railway.com/ai/mcp-server#run-the-server-locally)
- Agent-related release dates:
  - Railway Agent Skill (2026-01-09) and Agent Skill 2.0 (2026-02-27)
  - Remote MCP, Railway Agent in the CLI and one-command skills install (2026-04-17)
  - Railway Agent (2026-04-24)
  - Railway Agent in Slack and Discord (2026-07-10)
  - Railway plugins for ChatGPT (2026-07-31) and Grok (2026-07-16)
  - Agent connectors (2026-08-14)
  - Cloud Agents beta (2026-08-07)
  - "Claude Max 20x for Conductors" (2026-09-11)

  Source: [Changelog index](https://railway.com/changelog); [Changelog #0272](https://railway.com/changelog/2026-01-09-railway-agent-skill)
- **Railway Agent** works in the dashboard chat, the CLI, Slack and Discord. It can:
  - create and configure services, variables, databases and networking
  - read logs and metrics
  - auto-diagnose failed deploys
  - "open a pull request against your repository with a proposed fix"

  Connectors give it access to Notion, Linear, Sentry or any remote MCP server. It is billed at Anthropic per-token rates with no markup, or you can bring a ChatGPT or OpenRouter account. — [Railway Agent docs](https://docs.railway.com/ai/railway-agent); [Agent Connectors docs](https://docs.railway.com/ai/agent-connectors)
- CLI cadence and coverage:
  - Five releases between 2026-10-06 and 10-12 (v5.63.4 to v5.65.0).
  - Recent releases cover IaC `plan`/`apply`/`pull`, `cron list`/`run`, and fixes for PITR and HA leader handling.

  Source: [railwayapp/cli releases](https://github.com/railwayapp/cli/releases)
- CLI command families documented in 2026:
  - `railway postgres pitr|ha` ([PITR docs](https://docs.railway.com/volumes/point-in-time-recovery#manage-postgres-pitr-from-the-cli); [HA docs](https://docs.railway.com/databases/postgresql-ha#manage-ha-from-the-cli))
  - `railway cdn` ([CDN docs](https://docs.railway.com/networking/cdn))
  - `railway usage limit` ([Cost Control docs](https://docs.railway.com/pricing/cost-control))
  - `railway connect postgres --tunnel-only` ([Postgres backup guide](https://docs.railway.com/guides/postgres-backups-restores))
- PocketOS incident (April 2026): the agent "found a Railway API token stored locally on the user's machine" with account-level scope and called `volumeDelete`.
  - Railway's follow-up: "all deletes now soft delete for 48 hours"; destructive operations by the Railway Agent are staged for review; restricted environments; Workspace Guardrails.
  - Railway recommends the MCP server, with its short-lived scoped tokens, over raw API tokens.

  Source: [Railway blog, 2026-04-29](https://blog.railway.com/p/your-ai-wants-to-nuke-your-database)
- Hacker News commenters said Railway API keys and OAuth tokens "had no permissions structure." — [HN thread, May 2026](https://news.ycombinator.com/item?id=48204770)
- Reported hands-on experience is thin. A Central Station thread (undated) says Railway MCP with Claude "works well if you can keep it connected," but authentication drops and you have to re-authenticate with the CLI and reconnect. — [Central Station thread](https://station.railway.com/community/railway-mcp-w-claude-6fc3b0ef). Railway markets Claude Code + MCP with "OAuth in the browser, so no API keys to manage." — [railway.com/agents/claude](https://www.railway.com/agents/claude)
- Support docs give AI assistants instructions for drafting support tickets, and there is an `llms.txt` agent index. — [Support docs](https://docs.railway.com/platform/support#using-an-ai-assistant)

### Inferences
- With Claude Code plus the Railway MCP and CLI, an agent can realistically provision the whole RankSEO stack (services, Postgres, Redis, bucket, variables, domains), deploy, read logs and metrics, and debug, without the user opening the dashboard. Database-safety operations such as enabling PITR or HA are still a CLI or dashboard step.
- Guardrails for agentic operation:
  - Use OAuth-scoped MCP only, and never keep account-scoped `RAILWAY_TOKEN`s on disk or in the repo.
  - Mark the production environment as restricted.
  - Keep agents on staging or PR environments.
  - Require human approval for `delete-*` and `accept-deploy`.
  - Keep offsite `pg_dump`s, because the 48-hour soft delete is not a backup strategy.
- Compared with InsForge (an "agent-native backend"), Railway's agent tooling covers *infrastructure* operations. It does not cover app-level backend primitives such as auth, a data API or realtime, which you would still write yourself or add, for example Better Auth.

### Gaps
- I found no independent, long-form reports of Claude Code operating a Railway production stack over weeks.
- The docs tool list lags behind the live server, so the exact contents of the remote MCP tool set are not formally documented.
- I found no formal statement on token or permission scoping for API tokens after the incident, beyond the soft-delete and UI changes.

---

## 6. Lock-in and exit: Docker deploys, standard Postgres dumps, migration to Render, Fly.io or a VPS

### Takeaway
Lock-in is low:
- Services are ordinary OCI images built from your Dockerfile or Railpack, and Next.js standalone runs anywhere.
- Postgres is a stock-ish image with `pg_dump` access through a CLI tunnel or a TCP proxy.
- Buckets are S3-compatible.

The Railway-specific glue is reference variables, `railway.json`/IaC, cron schedules, CDN settings, feature flags and the internal DNS. Exiting is a day or two of work for this stack.

### Cited Findings
- Railway deploys from a Dockerfile or a zero-config builder, and the Next.js Dockerfile it documents is a standard multi-stage `node:lts-alpine` standalone image. — [Next.js guide](https://docs.railway.com/guides/nextjs). Railway "can deploy directly from a Docker image or Dockerfile." — [Railway vs Vercel doc](https://docs.railway.com/platform/compare-to-vercel)
- The official Postgres image is `ghcr.io/railwayapp-templates/postgres-ssl`, with an HA image `.../postgres-ha/postgres-patroni`. Versions 14–18 are supported for HA. — [Postgres HA docs](https://docs.railway.com/databases/postgresql-ha#prerequisites)
- Dump paths:
  - `railway connect postgres --tunnel-only` and then `pg_dump --format=custom --no-owner`.
  - Or `pg_dump "$DATABASE_PUBLIC_URL"`, but traffic over the public TCP proxy "is billed as network egress."
  - "Only offsite logical dumps survive deleting the project itself."

  Source: [Postgres backup & restore guide](https://docs.railway.com/guides/postgres-backups-restores)
- New databases have no public TCP proxy by default since 2026-07-31, so you must add Public Access or use the tunnel. — [Changelog #0301](https://railway.com/changelog/2026-07-31-railway-plugin-for-chatgpt); [Postgres HA docs](https://docs.railway.com/databases/postgresql-ha#step-3--connection-strings)
- The PITR archive is standard pgBackRest data in a Railway S3-compatible bucket. — [PITR docs](https://docs.railway.com/volumes/point-in-time-recovery)
- Railway-specific configuration:
  - Reference variables such as `DATABASE_URL=${{Postgres.DATABASE_URL}}` ([Full-stack Next.js guide](https://docs.railway.com/guides/fullstack-nextjs))
  - Config-as-code `railway.json` with `multiRegionConfig` and similar ([Config as Code reference](https://docs.railway.com/config-as-code/reference#multi-region-configuration))
  - IaC in the CLI ([CLI releases](https://github.com/railwayapp/cli/releases))
  - Feature flags ([Changelog](https://railway.com/changelog/2026-07-10-feature-flags))
- After cancellation, data is kept for 60 days (Hobby) or 90 days (Pro) before deletion. — [Pricing Plans docs](https://docs.railway.com/pricing/plans#faqs)
- Railway publishes inbound migration guides from Fly.io, Vercel, Render, DigitalOcean, Heroku and VPS. — [Railway vs Fly.io](https://docs.railway.com/platform/compare-to-fly); [Railway vs Render](https://docs.railway.com/platform/compare-to-render); [Railway vs VPS](https://docs.railway.com/platform/compare-to-vps)

### Inferences
Exit plan:
- Build with a Dockerfile, not Railpack magic.
- Keep config in env vars, not Railway feature flags.
- Run a nightly cron `pg_dump` to an *external* S3/R2 bucket.
- Use BullMQ on plain Redis.

To move to Render, Fly.io or a Hetzner/Coolify VPS, you would redeploy the same images, restore the dump, copy bucket objects with `aws s3 sync`, and repoint DNS and webhooks. That compares favorably with Vercel (framework-defined infrastructure) or an all-in-one BaaS such as InsForge, where auth, data APIs and realtime are coupled to the vendor's SDK. On the BaaS side this is an inference, since InsForge was not researched here.

### Gaps
- Railway offers no outbound migration tooling.
- Whether a Railway pgBackRest archive can be restored on another host was not verified.

---

## 7. Community sentiment and comparisons vs Render, Fly.io, Vercel and self-hosting (Coolify/Hetzner), 2025–2026

### Takeaway
Developer-experience praise is consistent, and Railway is often called the best DX among PaaS options. Trust in Railway's production reliability, however, took a visible hit in 2026 after the GCP-suspension outage and the agent-deleted-database story. Typical 2026 positioning:
- Railway: DX and prototypes through small production.
- Render: predictable pricing and the most mature managed Postgres.
- Fly.io: global reach and the lowest compute cost.
- Coolify/Hetzner: cheapest, but you own operations.

Much of the comparison content is SEO or competitor-authored.

### Cited Findings
- The HN thread on Railway's May 2026 incident report had 457 points and 268 comments.
  - Skeptical takes: "there's just been too many mishaps and shortcomings for us to continue running a B2B enterprise app on their infrastructure" (majdalsado, who moved to Azure). "Fly, Render, and even Heroku still are all better choices then working with Railway I think" (nightpool).
  - Alternatives suggested: "Hetzner (or any VM provider) + Dokku works best" (mococa) and "DigitalOcean. Seriously." (levkk).
  - Some praise for ownership: "Kudos to them for acknowledging it and not doing PR speak" (shwetanshu21).
  - No Railway staff responses were visible in the portion read.

  Source: [HN item 48204770](https://news.ycombinator.com/item?id=48204770)
- 2026 comparison posts broadly agree:
  - Railway wins on DX.
  - Render has the most complete managed Postgres (PITR, replicas) and the only real free tier (it sleeps after 15 minutes idle).
  - Fly.io leads on regions (about 18 or more vs Railway's 4 and Render's 5; sources conflict) and is cheapest at higher tiers.
  - Railway is often cheapest for hobby workloads.
  - Fly's Postgres is described as unmanaged or community-maintained.

  These are SEO-oriented and not independently verified. — [techsy.io](https://techsy.io/en/blog/railway-vs-render-vs-fly-io); [hostim.dev](https://hostim.dev/blog/render-vs-railway-vs-fly-pricing/); [devtoolpicks](https://devtoolpicks.com/blog/railway-vs-render-vs-fly-io-solo-developers-2026); [bex.co benchmarks](https://bex.co/blog/2026/09/11/railway-vs-render-vs-flyio-benchmarks)
- A critical Substack post (March 2026) alleges data loss and corruption around Postgres upgrades, Terraform applies and volume resizes ("No space left on device", corrupted filesystems). These are single-author claims that I could not verify. — [Stack and Sails](https://stackandsails.substack.com/p/railway-reliable-for-nextjs-2026)
- Competitor-authored critiques: bex.co (which sells a self-hosted Render alternative) covers "Five outages since November" — [bex.co](https://bex.co/blog/2026/09/21/railway-five-outages-owning-control-plane). Northflank also published Railway-outage alternatives pieces. — [Northflank](https://northflank.com/blog/railway-app-outage)
- Coolify on Hetzner vs Railway (2026 blog posts):
  - A Hetzner CX22 is €3.99/month.
  - Coolify setup takes 30–60 minutes or more, with an estimated 6–10 hours one-time "setup tax" versus about 5 minutes on Railway, plus ongoing patching and operations.
  - Railway "makes more sense if your time is worth more than server administration."

  Source: [solodevstack (Railway vs Coolify)](https://solodevstack.com/blog/railway-vs-coolify-solo-developers); [solodevstack (Railway vs Hetzner)](https://solodevstack.com/blog/railway-vs-hetzner-solo-developers); [aicoolies](https://aicoolies.com/comparisons/coolify-vs-railway); [thegtmdirectory](https://thegtmdirectory.com/compare/railway-vs-coolify). These figures come from a search-result summary, so which page states which number is approximate, and the posts are partly vendor-adjacent.
- Railway's own positioning: "Intelligent Cloud" where "coding agents deploy to Railway from the editor," and over 2 million developers. — [Series B coverage](https://www.vcaonline.com/news/2026012211/railway-raises-100-million-series-b-as-ai-pushes-today-s-cloud-infrastructure-past-its-limits/); [Railway changelog 2026-01-23](https://railway.com/changelog/2026-01-23-100m-series-b)

### Inferences
- Sentiment splits by use case. Indie and solo builders value Railway's speed and agent tooling. B2B teams with uptime contracts were the ones who left after May 2026. RankSEO, an early-stage SMB SaaS run by a solo developer, sits in the first group.
- Render is the closest like-for-like alternative if Postgres maturity and predictable pricing outweigh DX and agent tooling. A Hetzner box with Coolify is the cost floor but adds operations work the user wants to avoid.

### Gaps
- Reddit was inaccessible to my search tools, so I have no first-hand Reddit sentiment.
- I found no quantitative satisfaction or churn data.
- I could not locate the HN thread on the Series B.

---

## 8. Fit assessment for RankSEO rebuild (Railway vs an all-in-one agent-native backend such as InsForge)

### Takeaway
Railway is a **strong fit as the hosting and operations layer** for this rebuild.
- It meets the solo developer's needs: Next.js, workers with no timeouts, Postgres with PITR, Redis, a bucket and cron in one project for about $20–100/month.
- Its MCP and CLI support for Claude Code is the best found, and lock-in is low.

The main weaknesses:
- 2026 platform reliability, including two incidents that stopped databases.
- No SLA below Enterprise.
- Young database features.
- No built-in durable workflows, auth or realtime layer, which you would build yourself (BullMQ + Better Auth + SSE).

Railway is infrastructure, not a backend-as-a-service. The real comparison with InsForge is "Railway + Better Auth + your own job/SSE code" against "InsForge's bundled primitives."

### Cited Findings
- Long-running services, no execution cap, websockets that stay open indefinitely, and SSE up to 15 minutes per request. — [Specs & limits](https://docs.railway.com/networking/public-networking/specs-and-limits); [Railway vs Vercel doc](https://docs.railway.com/platform/compare-to-vercel)
- Postgres PITR (about 4-week window), HA, PgBouncer and one-click major upgrades exist, but each is opt-in. — [Databases docs](https://docs.railway.com/databases#what-railway-manages); [PITR docs](https://docs.railway.com/volumes/point-in-time-recovery)
- Pro costs $20/workspace with $20 of usage included and unlimited seats. Usage rates are $10/GB RAM and $20/vCPU per month. — [Pricing page](https://railway.com/pricing)
- There have been about 8 notable incidents since November 2025, including a platform-wide outage of about 8 h on 2026-05-19. — [May 19 report](https://blog.railway.com/p/incident-report-may-19-2026-gcp-account-outage); [Feb 11 report](https://blog.railway.com/p/incident-report-february-11-2026)
- The MCP server, CLI and Railway Agent are mature and actively developed. — [MCP docs](https://docs.railway.com/ai/mcp-server); [CLI releases](https://github.com/railwayapp/cli/releases)
- Community templates exist for Trigger.dev, Inngest and Better Auth, but none are verified and deployment counts are low (OBSERVED via MCP, 2026-10-12). — [Template marketplace](https://railway.com/deploy)

### Inferences
Requirement-by-requirement scorecard (my judgement):

| Requirement | Railway fit | Notes |
|---|---|---|
| Simple hosting/ops for a solo developer or small team | **Strong** | One canvas, Git deploys, PR environments, free builds |
| Transactional DB with backups | **Good, with homework** | You must enable PITR and scheduled backups yourself and add an offsite `pg_dump` cron |
| Durable jobs that wait ~15 min on webhooks | **Good (DIY)** | BullMQ + Postgres state machine + webhook-driven continuation. Set a drain time. No native workflow engine |
| Realtime progress over SSE or websockets | **Good** | SSE needs heartbeats and a reconnect every 15 min; WebSockets are unlimited; the CDN doesn't buffer SSE |
| Predictable cost | **Moderate** | Usage-metered, but low absolute dollars. Soft alerts help; hard limits take everything offline |
| Low lock-in | **Strong** | Docker, vanilla Postgres, S3 buckets |
| Production maturity | **Moderate / weak spot** | 2026 incident cadence; no SLA below Enterprise; DB features under 8 months old |
| AI coding-agent workflow | **Strong** | Remote MCP with 68 live tools, CLI, Railway Agent. Needs guardrails after PocketOS |

Suggested Railway topology for RankSEO:
- `web` (Next.js standalone, 1→2 replicas)
- `worker` (BullMQ, same repo, drain time set to the longest job step)
- `postgres` (PITR on, daily and weekly backups, nightly offsite `pg_dump` to an external bucket)
- `redis` (queue + pub/sub)
- `bucket` (exports)
- a cron service for scheduled visibility re-checks
- Pro plan with a soft spend alert

Keep the Claude calls (AI gateway) and Bright Data external.

**Hybrid option:** keep Trigger.dev Cloud or Inngest Cloud for durable waits and run only web, Postgres and Redis on Railway. That trades extra vendor lock-in for less custom job code. This option was not researched here.

### Gaps
- No hands-on load test was done, so the cost and performance numbers are estimates.
- InsForge itself was outside this note's scope; the comparison above is structural only.
- Railway's roadmap for native queues or workflows, if any, was not found.
