# Better Auth: current-state profile for the RankSEO rebuild (as of 2026-10-12)

Research date: 2026-10-12. The docs pages carry no dates. Facts cited from them describe the v1.7 docs as fetched on that date. Code-level facts come from the published npm tarballs `better-auth@1.7.7` and `@better-auth/stripe@1.7.7`, both released 2026-09-30. Anything older than about Oct 2025 is marked **[possibly stale]**.

---

## 1. Current version and release cadence; governance, company and funding; adoption; security advisories and how they were handled

### Takeaway
Better Auth is at **1.7.7 (2026-09-30)**. It ships minor releases every 1–4 months and patch releases weekly or faster. **Vercel acquired it (announced 2026-07-07)**; the library stays MIT-licensed. Adoption is very high: about 11.8M npm downloads a week, more than next-auth and @clerk/nextjs combined.

The security record is busy. There are 37 GitHub advisories in total, 27 of them published in 2026, including 3 Critical. Fixes ship quickly, with patched versions and workarounds. However, the newest Critical (2026-09-30) is fixed **only in 1.7.7, with no 1.6.x backport listed**. The rebuild should therefore start on 1.7.7 or later and budget for frequent upgrades.

### Cited Findings
**Versions and cadence**
- npm dist-tags (fetched 2026-10-12): `latest` = **1.7.7**, `release-1.6` = **1.6.33**, `release-1.4` = 1.4.22, `rc` = 1.7.0-rc.6, `beta` = 1.7.0-beta.10. 935 versions have been published since 2024-04-22, 225 of them stable. — [npm registry: better-auth](https://registry.npmjs.org/better-auth)
- First release of each minor line: 1.0.0 on 2024-11-23; 1.1.0 on 2024-12-20; 1.2.0 on 2025-03-01; 1.3.0 on 2025-07-19; 1.4.0 on 2025-11-22; 1.5.0 on 2026-03-01; 1.6.0 on 2026-04-06; 1.7.0 on 2026-08-18 (UTC). — [npm registry: better-auth](https://registry.npmjs.org/better-auth)
- Patch volume:
  - 1.6.x: 34 stable releases (1.6.0–1.6.33, 2026-04-06 → 2026-09-14).
  - 1.7.x: 8 releases (1.7.0–1.7.7, 2026-08-18 → 2026-09-30).
  - Older lines kept getting backports for a while after the next minor: 1.4.22 on 2026-03-16, two weeks after 1.5.0; 1.6.31–1.6.33 in Sep 2026, after 1.7.0.
  - The 1.5 line had only 7 releases (1.5.0–1.5.6, 2026-03-01 → 2026-03-22). — [npm registry: better-auth](https://registry.npmjs.org/better-auth)
- 1.7 release post (2026-08-17, Gustavo Valverde) calls it "one of our largest releases".
  - Focus areas: OAuth/OIDC provider hardening (DPoP, back-channel logout, RFC 8707), MCP authorization moving to `@better-auth/mcp`, a device authorization grant, a SCIM rebuild, a new identity model, and `@better-auth/i18n`.
  - Breaking changes:
    - Upgrade all packages together with `npx auth upgrade`, then run `generate` or `migrate`.
    - Custom adapters, storage and rate-limit stores need new methods.
    - The deprecated `oidcProvider` plugin was removed. — [Better Auth blog: 1.7](https://better-auth.com/blog/1-7)
- 1.7.3 reverted a 1.7.0 schema change. Versions 1.7.0–1.7.2 required a new `account.issuer` column with a unique index; 1.7.3 restored 1.6-style matching on `(providerId, accountId)`. Databases that ran 1.7.0–1.7.2 need manual cleanup (Postgres: `ALTER TABLE account ALTER COLUMN issuer DROP NOT NULL;` and drop the index `account_issuer_accountId_uidx`). The `auth` CLI requires **Node.js 22.12+**. — [1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide.md)
- Neither the upgrade guide nor the security reference page states how long 1.6 will be supported, or any LTS policy. — [1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide.md); [Security reference](https://better-auth.com/docs/reference/security.md)

**Governance, company and funding**
- **[possibly stale, 2025]** $5M seed round led by Peak XV Partners, with Y Combinator, Chapter One and P1 Ventures. Founder: Bereket Engida. — [Better Auth blog: seed round](https://www.better-auth.com/blog/seed-round)
- **[about 12.5 months old]** Auth.js (formerly NextAuth.js) has been maintained by the Better Auth team since **2025-09-22**. Security patches continue, and new projects are steered to Better Auth. — [Better Auth blog: Auth.js joins Better Auth](https://www.better-auth.com/blog/authjs-joins-better-auth) (via search summary)
- **Vercel acquisition, announced 2026-07-07.**
  - Terms were not disclosed. The founder and core team joined Vercel.
  - Vercel's post says: "The library remains free and open source under MIT". It says the project keeps its name and "the same open contribution model and community governance". It describes Better Auth as "framework-agnostic, runs anywhere".
  - Stated focus: agent identity ("Agent Auth"), to be brought to "Vercel Connect" and "eve".
  - Figures cited at the time: 4.7M+ weekly npm downloads and 850+ contributors. — [Vercel blog](https://vercel.com/blog/vercel-acquires-better-auth); [Better Auth blog: joins Vercel](https://better-auth.com/blog/better-auth-joins-vercel); [Dealroom](https://dealroom.co/news/137900-vercel-acquires-better-auth-a-year-after-ethiopian-founders-5m-seed/)
- The Better Auth post says the team first tried a monetized "platform act one". That was **Better Auth Infrastructure** (dashboard, security, audit logs), launched "January 1" (the year is not stated; 2026 is inferred). The post says the move lets the team focus on the framework "without shaping strategy around monetization". It does not say what happens to Infrastructure. — [Better Auth blog: joins Vercel](https://better-auth.com/blog/better-auth-joins-vercel)
- Better Auth Infrastructure is still priced on the site (Oct 2026):
  - Starter: $0, with 1,000 security detections a month.
  - Pro: $20/month, with 10,000 detections then $0.001 each, email at $0.001 each, and SMS at $0.09 each.
  - Enterprise: custom pricing.
  - The site says: "The Better Auth framework is free and open source." — [Better Auth pricing](https://better-auth.com/pricing)
- Competitor commentary (WorkOS) argues the real change is governance, since the roadmap is now set by employees of a platform company. Treat this as biased; WorkOS sells a competing product. — [WorkOS blog](https://workos.com/blog/should-i-migrate-from-better-auth-vercel-acquisition) (via search summary)
- Telemetry is **opt-in, disabled by default** (`telemetry: { enabled: true }` or `BETTER_AUTH_TELEMETRY=1`). — [Telemetry docs](https://better-auth.com/docs/reference/telemetry.md)

**Adoption signals**
- npm weekly downloads for 2026-10-05 → 2026-10-11:
  - `better-auth`: **11,772,595**
  - `next-auth`: 6,805,080
  - `@clerk/nextjs`: 2,763,812
  - `@better-auth/stripe`: 264,662
  - Last 30 days for `better-auth` (2026-09-12 → 2026-10-11): 44,398,538. — [npm downloads API: better-auth](https://api.npmjs.org/downloads/point/last-week/better-auth); [next-auth](https://api.npmjs.org/downloads/point/last-week/next-auth); [@clerk/nextjs](https://api.npmjs.org/downloads/point/last-week/@clerk%2Fnextjs); [@better-auth/stripe](https://api.npmjs.org/downloads/point/last-week/@better-auth%2Fstripe)
- Monthly downloads of `better-auth` grew about 20× in a year: Oct 2025 1.81M → Jan 2026 3.80M → Apr 2026 9.94M → Jul 2026 25.6M → Sep 2026 36.2M. — [npm downloads range API](https://api.npmjs.org/downloads/range/2025-10-01:2026-10-11/better-auth)
- Caveat on download counts: `better-auth@1.7.7` lists all of `@better-auth/{drizzle,kysely,memory,mongo,prisma}-adapter` as hard dependencies. Each adapter shows about 10.9–11.0M weekly downloads, which mirrors core installs and says nothing about actual adapter usage. — [npm registry: better-auth](https://registry.npmjs.org/better-auth); [npm downloads API: prisma-adapter](https://api.npmjs.org/downloads/point/last-week/@better-auth%2Fprisma-adapter)
- GitHub (fetched 2026-10-12): **30.3k stars**, 3.0k forks, 391 open issues, 475 open PRs, MIT license. — [GitHub: better-auth/better-auth](https://github.com/better-auth/better-auth)

**Security advisories, 2025–2026**
- The GitHub Security Advisories list shows **37 published advisories** as of 2026-10-12.
  - By year: 1 in 2024, 9 in 2025, **27 in 2026**.
  - By severity: 3 Critical, 22 High, 9 Moderate, 3 Low.
  - Clusters: 13 published on 2026-05-31, 4 on 2026-06-26, and 5 between 2026-09-28 and 2026-09-30.
  - Many are in enterprise plugins (SSO, SCIM, OAuth provider) that RankSEO would not use. — [Advisories p.1](https://github.com/better-auth/better-auth/security/advisories); [p.2](https://github.com/better-auth/better-auth/security/advisories?page=2); [p.3](https://github.com/better-auth/better-auth/security/advisories?page=3); [p.4](https://github.com/better-auth/better-auth/security/advisories?page=4)
- **GHSA-965c-763c-88jm (Critical, CVSS 9.1, 2026-09-30).** "OAuth state can be used as a Magic Link to sign in as another user."
  - Affected: `better-auth >= 1.4.0-beta.18, < 1.7.7`. **Patched only in 1.7.7. No 1.6.x fix is listed**; the last 1.6 release, 1.6.33 (2026-09-14), predates the advisory.
  - Preconditions: Magic Link is enabled, at least one social or Generic OAuth provider is enabled, and `account.storeStateStrategy: "database"` is in effect (the default when a database is configured).
  - Workarounds: cookie state strategy, hashed magic-link tokens, or disabling one of the two sign-in methods. The advisory notes that `disableSignUp: true` on Magic Link is not sufficient. — [GHSA-965c-763c-88jm](https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm); [npm registry](https://registry.npmjs.org/better-auth)
- **GHSA-qq9h-g4jm-xgf3 (High, CVSS 8.3, 2026-06-26).** "Attacker's password keeps working after magic link or email OTP sign-in", a pre-account-hijacking attack.
  - Affected: `>= 1.1.3, < 1.6.22`. Patched in 1.6.22 and 1.7.0-beta.10. **1.6.22 was published the same day (2026-06-26 12:46 UTC).**
  - Preconditions: magic link or email OTP is enabled, and email/password sign-up is open.
  - The advisory says **requiring email verification does not stop it**. Credited to the Vercel security team. — [GHSA-qq9h-g4jm-xgf3](https://github.com/better-auth/better-auth/security/advisories/GHSA-qq9h-g4jm-xgf3)
- **GHSA-h3rm-78g3-j7cp (High, CVSS 7.1, 2026-06-26).** In `@better-auth/stripe`, organization billing actions (cancel, change plan, restore, billing portal) can run on the wrong organization.
  - Affected: `>= 1.4.11, < 1.6.21`. Patched in 1.6.21.
  - Preconditions: org subscriptions, an `authorizeReference` callback, and a user who belongs to more than one org.
  - The advisory includes a code workaround: reject when `referenceId !== session.activeOrganizationId`. No CVE was assigned. — [GHSA-h3rm-78g3-j7cp](https://github.com/better-auth/better-auth/security/advisories/GHSA-h3rm-78g3-j7cp)
- **GHSA-44jh-23m7-hpcf (Low, CVSS 3.7, 2026-09-30).** "Concurrent requests can exceed rate limits on PostgreSQL" when rate-limit records are stored in the database.
  - Affected: `better-auth` and `@better-auth/drizzle-adapter` `>= 1.6.17, < 1.7.7` (fixed in 1.7.7), and `@better-auth/kysely-adapter >= 1.6.17, < 1.7.0`.
  - Memory and secondary storage are not affected. — [GHSA-44jh-23m7-hpcf](https://github.com/better-auth/better-auth/security/advisories/GHSA-44jh-23m7-hpcf)
- Other advisories relevant to a SaaS like RankSEO:
  - GHSA-p6v2-xcpg-h6xw (High, 2026-05-11): rate limiter bypass by rotating IPv6 addresses.
  - GHSA-x732-6j76-qmhm (High, 2025-12-15): paths with repeated slashes bypass disabled paths and rate limits.
  - GHSA-xg6x-h9c9-2m83 (High, 2026-04-01): session cookie cache can let users skip 2FA.
  - GHSA-2vg6-77g8-24mp (Low, 2026-05-31): deleted users stay signed in when sessions live in secondary storage.
  - GHSA-fmh4-wcc4-5jm3 (High, 2026-05-31): organization invitations can be accepted by an unverified account.
  - GHSA-g38m-r43w-p2q7 (High, 2026-05-31): OAuth sign-in can link to an account an attacker registered in advance.
  - GHSA-4vcf-q4xf-f48m (High, 2025-11-24): any signed-in user can delete other users' passkeys.
  - GHSA-99h5-pjcv-gr6v (High, 2025-10-08): anyone can create or change API keys for another user. — [Advisories p.1–4](https://github.com/better-auth/better-auth/security/advisories)
- GHSA-99h5 corresponds to CVE-2025-61928 (GitLab rates it 8.6), fixed in 1.3.26. — [GitLab advisory DB](https://advisories.gitlab.com/pkg/npm/better-auth/CVE-2025-61928)
- 1.3.26 was published 2025-10-03, five days before the advisory. 1.4.5 (2025-12-03) also preceded advisory x732 (2025-12-15). In both cases the fix shipped before disclosure, which fits coordinated disclosure. — [npm registry](https://registry.npmjs.org/better-auth)
- **[possibly stale]** Earlier advisories, Dec 2024–Jul 2025, were mostly open-redirect and trusted-origin bugs: GHSA-8jhw-6pjj-8723 (2024-12-30), GHSA-9x4v-xfq5-m8x5 (2025-02-05), GHSA-hjpm-7mrm-26w8 and GHSA-vp58-j275-797x (2025-02-24), and GHSA-36rg-gfq2-3h56 (2025-07-06). — [Advisories p.4](https://github.com/better-auth/better-auth/security/advisories?page=4)
- Reporting runs through GitHub Security Advisories. — [Security reference](https://better-auth.com/docs/reference/security.md)
- CVE ID conflict: aggregators list CVE IDs such as "CVE-2026-67327" for the pre-account-takeover issue (versions 1.1.3–1.6.21). The matching GHSA pages say "No known CVE". — [CraftedSignal brief](https://feed.craftedsignal.io/briefs/2026-08-better-auth-takeover/) (via search summary) contradicted by [GHSA-qq9h-g4jm-xgf3](https://github.com/better-auth/better-auth/security/advisories/GHSA-qq9h-g4jm-xgf3)

### Inferences
- The current build runs Better Auth 1.6 with email verification off. If it also has magic link or email OTP plus open sign-up, it was exposed to GHSA-qq9h until 1.6.22. If it also has magic link plus any social login, it is exposed to GHSA-965c on every 1.6.x. The rebuild should pin `>= 1.7.7` and treat Better Auth upgrades as a recurring maintenance task, perhaps with Dependabot or Renovate plus GHSA alerts.
- There is no published support window. The previous minor line got backports for only about 2–8 weeks after the next minor. Plan to stay on the latest minor rather than an "LTS" line.
- The burst of 2026 advisories (a 13-advisory batch on 2026-05-31; a Vercel-credited finding on 2026-06-26) suggests much more security scrutiny around the acquisition. That is good for long-term hardening, but in the near term it means churn.
- Many advisories have no CVE ID. Scanners that only read CVEs may miss them; npm audit and Dependabot use GHSA IDs, so those should catch them.
- Download growth (about 20× in a year, now above next-auth) makes abandonment unlikely. Vercel ownership changes the incentive structure, but the MIT license limits lock-in risk.

### Gaps
- No primary statement of a security support policy (supported versions, backport window) was found.
- Exact contributor count and release-note detail per patch: the GitHub API was blocked in this session, so the contributor count comes only from the 2026-07-07 announcement.
- The Hacker News reaction to the acquisition could not be retrieved directly.
- Whether Better Auth Infrastructure (the paid product) will continue under Vercel is not stated anywhere I found.

---

## 2. Email verification, password reset, rate limiting, CAPTCHA, Have I Been Pwned, disposable-email blocking, and the session cookie cache

### Takeaway
All the building blocks against scripted sign-ups exist in the open-source core. **Disposable-email blocking is the exception**: it comes only from the paid hosted "Sentinel" service or community plugins. The building blocks are:
- `requireEmailVerification` with enumeration-safe sign-up
- a rate limiter that is on by default in production, with 3 requests per 10 s on sign-up and sign-in
- a CAPTCHA plugin (Turnstile, reCAPTCHA, hCaptcha, CaptchaFox, Vercel BotID)
- a Have I Been Pwned plugin

The key gotchas:
- Rate limiting and CAPTCHA run only on HTTP requests to the auth handler. **Server-side `auth.api.*` calls, such as from Next.js server actions, bypass both.**
- The default in-memory limiter is per instance.
- Database-backed limits on Postgres had a race until 1.7.7.

### Cited Findings
**Email verification and password reset**
- Email verification keys:
  - `emailVerification.sendVerificationEmail({ user, url, token }, request)`
  - `sendOnSignUp`, `sendOnSignIn`, `autoSignInAfterVerification`
  - hooks `beforeEmailVerification` and `afterEmailVerification`
  - `emailAndPassword.requireEmailVerification: true` blocks sign-in until the user verifies. The client sees status **403**. With `sendOnSignIn`, every sign-in attempt resends the email. — [Email docs](https://www.better-auth.com/docs/concepts/email)
- Enumeration protection: when `requireEmailVerification` is on or `autoSignIn` is false, sign-up returns the same `200` whether or not the email exists. `onExistingUserSignUp` notifies the real owner, and `customSyntheticUser` shapes the fake user returned. — [Email & password docs](https://better-auth.com/docs/authentication/email-password.md); [Security reference](https://better-auth.com/docs/reference/security.md)
- The docs warn: "Avoid awaiting the email sending to prevent timing attacks", and on serverless "use `waitUntil`". — [Email docs](https://www.better-auth.com/docs/concepts/email)
- Password reset:
  - `sendResetPassword({ user, url, token }, request)` and `onPasswordReset`.
  - `revokeSessionsOnPasswordReset` defaults to **not revoking** other sessions.
  - Hashing defaults to **scrypt**, and can be replaced, for example with Argon2.
  - Password length defaults to 8–128. — [Email & password docs](https://better-auth.com/docs/authentication/email-password.md)
- Email OTP plugin can replace links with codes (`overrideDefaultEmailVerification: true`). Defaults: `otpLength` 6, `expiresIn` 300 s, `allowedAttempts` 3; too many attempts returns `TOO_MANY_ATTEMPTS`. — [Email OTP docs](https://better-auth.com/docs/plugins/email-otp.md)
- The Stripe plugin also has `subscription.requireEmailVerification`, which gates subscription actions on a verified email. — [Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)

**Built-in rate limiting (code verified in 1.7.7)**
- Defaults from code: `enabled: options.rateLimit?.enabled ?? isProduction`, which means **off in development and on in production**. Global `window` is 10 s and `max` is 100. `storage` defaults to `"memory"`, or `"secondary-storage"` if `secondaryStorage` is configured. — [better-auth@1.7.7 tarball, dist/context/create-context.mjs](https://registry.npmjs.org/better-auth/-/better-auth-1.7.7.tgz)
- Built-in stricter rules from code, applied per IP and path:
  - Paths starting with `/sign-in`, `/sign-up`, `/change-password` or `/change-email`: **3 requests per 10 s**.
  - `/request-password-reset`, `/send-verification-email`, `/forget-password*`, `/email-otp/send-verification-otp` and `/email-otp/request-password-reset`: **3 requests per 60 s**. — [better-auth@1.7.7 tarball, dist/api/rate-limiter/index.mjs](https://registry.npmjs.org/better-auth/-/better-auth-1.7.7.tgz)
- **The docs lag the code.** The docs mention only `/sign-in/email` at 3 per 10 s, plus `/two-factor/*` from the 2FA plugin. — [Rate limit docs](https://www.better-auth.com/docs/concepts/rate-limit)
- Configuration:
  - `customRules` per path, with wildcards. A value can be static `{window, max}`, an async function of the request, or `false` to disable.
  - Over-limit requests get HTTP **429** with an `X-Retry-After` header.
  - Storage options: `"memory"` (the doc says it may not suit serverless), `"database"` (a `rateLimit` table), `"secondary-storage"`, or `customStorage`.
  - **`customStorage.consume(key, rule)` must check and increment in one operation.** Separate `get`/`set` methods are no longer accepted; this changed in 1.7 per the upgrade guide. — [Rate limit docs](https://www.better-auth.com/docs/concepts/rate-limit); [1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide.md)
- From code:
  - Secondary-storage rate limiting requires `SecondaryStorage.increment`.
  - The in-memory store is a process-local `Map` capped at 100,000 entries.
  - If no client IP can be resolved, the limiter logs a warning and **falls back to a single shared per-path bucket**. — [better-auth@1.7.7 tarball, dist/api/rate-limiter/index.mjs](https://registry.npmjs.org/better-auth/-/better-auth-1.7.7.tgz)
- **Server-side calls are exempt.** The docs say: "Requests made through `auth.api` on the server are exempt. Only client-initiated requests are limited." — [Rate limit docs](https://www.better-auth.com/docs/concepts/rate-limit)
- Code confirms the order of checks in the router's `onRequest`: disabled paths, then the rate limiter, then each plugin's `onRequest` hook. The CAPTCHA plugin is implemented as such a hook. — [better-auth@1.7.7 tarball, dist/api/index.mjs and dist/plugins/captcha/index.mjs](https://registry.npmjs.org/better-auth/-/better-auth-1.7.7.tgz)
- Client IP detection:
  - The default header is `x-forwarded-for`, but **comma-separated chains are not trusted by default**.
  - `advanced.ipAddress.ipAddressHeaders` selects which header to read (e.g. `["x-real-ip"]` or `["cf-connecting-ip"]`).
  - `trustedProxies` takes IPs or CIDRs and walks the chain right to left.
  - IPv6 addresses are grouped by `/64` by default (`ipv6Subnet`), which addresses the IPv6-rotation bypass advisory.
  - The docs warn that the origin must be reachable only through proxies that sanitize these headers. — [Rate limit docs](https://www.better-auth.com/docs/concepts/rate-limit)
- On multiple instances (from GHSA-44jh's workaround text): in-memory storage means "each instance then keeps its own counter, so a single shared limit may not hold across multiple instances or serverless deployments". Recommended alternatives are secondary storage (e.g. Redis), atomic custom storage, or an upstream gateway limit. — [GHSA-44jh-23m7-hpcf](https://github.com/better-auth/better-auth/security/advisories/GHSA-44jh-23m7-hpcf)
- Official Redis storage: `@better-auth/redis-storage` (ioredis); 37,583 weekly downloads. Secondary storage must implement `get`, `getAndDelete`, `increment(key, ttl)`, `set` and `delete`. `increment` and `getAndDelete` became **required in 1.7**. — [Database docs](https://better-auth.com/docs/concepts/database.md); [1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide.md); [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@better-auth%2Fredis-storage)
- Rate-limiter issue history on GitHub:
  - "rate limiting not working on magic links" (#3264, closed 2025-12-16)
  - "Rate Limit doesn't work for Email OTP" (#1891, closed 2025-11-10)
  - "Rate limits not applied when api-key sessions are enabled" (#2482, closed 2025-06-16, **[possibly stale]**)
  - "API Key rate limiting not behaving as expected" (#6035, **open** since 2025-11-17)
  - "secondaryStorage always gets default TTL" (#5452, closed 2026-01-29) — [GitHub issues: "rate limit"](https://github.com/better-auth/better-auth/issues?q=is%3Aissue%20%22rate%20limit%22%20sort%3Acomments-desc)

**CAPTCHA plugin (built in)**
- Providers: `cloudflare-turnstile`, `google-recaptcha` (v3 `minScore` defaults to 0.5), `hcaptcha`, `captchafox` and `vercel-botid`.
- Default protected endpoints: **`/sign-up/email`, `/sign-in/email` and `/request-password-reset`**. Other flows, such as magic link and email OTP, must be added to `endpoints`, and doing so replaces the defaults.
- The client sends its token in the `x-captcha-response` header. `x-captcha-user-remote-ip` is no longer needed.
- Vercel BotID works only on Vercel deployments. — [Captcha docs](https://www.better-auth.com/docs/plugins/captcha)
- From code: provider verification has a 10 s timeout and "fails closed". The default endpoint list matches the docs. — [better-auth@1.7.7 tarball, dist/plugins/captcha/constants.mjs](https://registry.npmjs.org/better-auth/-/better-auth-1.7.7.tgz)

**Have I Been Pwned plugin (built in)**
- It sends only the first 5 characters of the password's SHA-1 hash (k-anonymity). Rejected passwords get error `PASSWORD_COMPROMISED`. Options: `enabled` and `customPasswordCompromisedMessage`. — [HIBP docs](https://www.better-auth.com/docs/plugins/have-i-been-pwned)
- From code:
  - Default paths: `/sign-up/email`, `/change-password`, `/reset-password`, `/email-otp/reset-password` and `/phone-number/reset-password`.
  - If HIBP can't be reached, it throws `INTERNAL_SERVER_ERROR`, so it **fails closed**. — [better-auth@1.7.7 tarball, dist/plugins/haveibeenpwned/index.mjs](https://registry.npmjs.org/better-auth/-/better-auth-1.7.7.tgz)

**Disposable-email blocking and sign-up abuse**
- No disposable-email plugin exists in the open-source docs index. — [Better Auth docs llms.txt](https://better-auth.com/docs/llms.txt)
- The **paid, hosted** Sentinel plugin (`@better-auth/infra`, which needs `BETTER_AUTH_API_KEY` and calls `dash.better-auth.com` and `kv.better-auth.com`) provides:
  - `emailValidation`: blocks disposable addresses. `strictness` is `low`, `medium` or `high`; medium checks MX records.
  - `emailNormalization`: Gmail dots and plus-tags.
  - `freeTrialAbuse`: device fingerprinting, `maxAccountsPerVisitor`.
  - `velocity`: `maxSignupsPerVisitor`, `maxSignInsPerIp`.
  - Also `botBlocking`, `suspiciousIpBlocking`, `credentialStuffing` and proof-of-work challenges.
  - Without an API key, checks "may fall back to allow mode". — [Sentinel docs](https://better-auth.com/docs/infrastructure/plugins/sentinel.md)
- Sentinel pricing: Starter is free with 1,000 security detections a month; Pro is $20/month with 10,000 detections, then $0.001 per event. — [Better Auth pricing](https://better-auth.com/pricing)
- `@better-auth/infra` has 228,041 weekly downloads. Issues: "Can't connect Better Auth Infra to NextJS application" (#8901, closed 2026-04-15); "Sentinel native is using crypto for PoW" (#10771, closed 2026-08-19). — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@better-auth%2Finfra); [GitHub issues: "rate limit"](https://github.com/better-auth/better-auth/issues?q=is%3Aissue%20%22rate%20limit%22%20sort%3Acomments-desc)
- Community option: `better-auth-harmony` (GeKorm) does email and phone normalization and blocks "over 55,000 temporary email domains". It has 39,864 weekly downloads. The docs note that community plugins are "not official or verified by the Better Auth team". Another listed option is `@dymo-api/better-auth`. — [better-auth-harmony README](https://unpkg.com/better-auth-harmony@1.3.2/README.md) (via search summary); [npm downloads API](https://api.npmjs.org/downloads/point/last-week/better-auth-harmony); [Community plugins](https://better-auth.com/docs/plugins/community-plugins.md)

**Session defaults and cookie cache**
- Session defaults: `expiresIn` 7 days, `updateAge` 1 day, `freshAge` 1 day.
- Cookie cache:
  - Turned on with `session.cookieCache.enabled`. The docs example uses `maxAge: 5 * 60`; no default is stated.
  - `strategy` is `"compact"` by default, or `"jwt"` / `"jwe"`.
  - Trade-off: "revoked sessions may remain active on other devices until the cookie cache expires". Use `disableCookieCache: true` for sensitive operations.
  - Changing `cookieCache.version` invalidates all sessions. — [Session management docs](https://better-auth.com/docs/concepts/session-management.md)
- In Next.js, React Server Components can't set cookies, so the cookie cache isn't refreshed until a server action or route handler runs. A related bug, "auth.api.getSession() returns null in Next.js App Router server components with cookie cache enabled" (#7008), was closed 2026-08-09. — [Next.js integration docs](https://better-auth.com/docs/integrations/next.md); [GitHub issues: stripe search](https://github.com/better-auth/better-auth/issues?q=is%3Aissue%20stripe%20sort%3Acomments-desc)
- Security history: GHSA-xg6x-h9c9-2m83 (2026-04-01), "Session cookie cache can let users skip two-factor authentication". — [Advisories p.3](https://github.com/better-auth/better-auth/security/advisories?page=3)

### Inferences
- **Highest-impact gotcha for RankSEO:** if sign-up or sign-in is implemented as Next.js server actions calling `auth.api.signUpEmail`, neither the rate limiter nor the CAPTCHA plugin runs. To keep both protections, send these flows through the `/api/auth/*` route handler with `authClient`, or add your own limiter and CAPTCHA check inside the server action. This is inferred from the documented `auth.api` exemption plus the code showing both checks live only in the HTTP router's `onRequest`.
- Per-IP limits of 3 per 10 s on sign-up still allow about 18 sign-ups a minute per IP, so they won't stop scripted sign-ups that rotate IPs. Combine:
  1. `requireEmailVerification`
  2. Turnstile through the CAPTCHA plugin, extending `endpoints` to any magic-link or OTP send routes
  3. disposable-email blocking, via `better-auth-harmony`, Sentinel, or a custom `databaseHooks.user.create.before` check
  4. granting free-tier quota only after verification
- On any deployment with more than one replica, use `rateLimit.storage: "secondary-storage"` with Redis, or database storage on 1.7.7 or later. Otherwise each replica keeps its own counters.
- On Railway, set `advanced.ipAddress.ipAddressHeaders` explicitly (see Q8). If the limiter can't resolve a client IP, it falls back to one shared bucket, and then 3 sign-ins per 10 s applies globally, which amounts to a self-inflicted denial of service.

### Gaps
- No primary benchmark or documented behaviour for limiter accuracy under multi-instance load beyond the GHSA-44jh text.
- Whether the Prisma adapter, which RankSEO currently uses, had the same Postgres rate-limit race as Drizzle and Kysely. The advisory lists only Drizzle, Kysely and core.
- Pricing of Sentinel's disposable-email checks is folded into "security detections"; the cost per sign-up check is not itemized.

---

## 3. Stripe plugin (`@better-auth/stripe`): subscriptions, trials, annual prices, plan limits, portal, webhooks, `authorizeReference`, organization and seat billing; metered or quota support; known issues

### Takeaway
The Stripe plugin covers the subscription lifecycle well: checkout, upgrade or downgrade, scheduled changes, cancel and restore, billing portal, trials with anti-repeat, annual prices, org and seat billing, and 4 webhook events. **It does not meter usage or enforce quotas.**
- Plan `limits` is an opaque object that is stored and returned, never enforced.
- Since PR #8926 (Apr 2026), metered Stripe prices are accepted at checkout, but the plugin sends no usage records.
- Atomic per-period quotas and entitlements must be built in the app's own database, or delegated to a billing layer such as Autumn, Polar or Commet.

### Cited Findings
- Package and versions: `@better-auth/stripe` latest is 1.7.7 (2026-09-30), first published 2025-02-28. Peer dependencies are `stripe` `^18 || ^19 || ^20 || ^21 || ^22`, plus `better-auth ^1.7.7`. It has 264,662 weekly downloads. — [npm registry: @better-auth/stripe](https://registry.npmjs.org/@better-auth/stripe); [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@better-auth%2Fstripe)
- Configuration options:
  - Top level: `stripeClient`, `stripeWebhookSecret`, `createCustomerOnSignUp`, `onCustomerCreate`, `getCustomerCreateParams`, and `onEvent` (receives any webhook event).
  - `subscription`: `enabled`, `plans` (static or an async function), `requireEmailVerification`, `authorizeReference`, `getCheckoutSessionParams`, and lifecycle hooks `onSubscriptionComplete`, `onSubscriptionCreated`, `onSubscriptionUpdate`, `onSubscriptionCancel` and `onSubscriptionDeleted`.
  - `organization`: `enabled`. — [Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- Plan fields:
  - `name`, `priceId` or `lookupKey`
  - `annualDiscountPriceId` or `annualDiscountLookupKey`, for annual billing via `annual: true`
  - `limits`, e.g. `{ projects: 10, storage: 5 }`
  - `group`, `seatPriceId` (needs the organization plugin), `prorationBehavior`, `lineItems`
  - `freeTrial: { days, onTrialStart, onTrialEnd, onTrialExpired }` — [Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- Endpoints:
  - `POST /subscription/upgrade`: upgrade, switch, or schedule with `scheduleAtPeriodEnd`, which uses Stripe Subscription Schedules
  - `GET /subscription/list`
  - `POST /subscription/cancel`: redirects to the Billing Portal
  - `POST /subscription/restore`
  - `POST /subscription/billing-portal`
  - Upgrade parameters include `referenceId`, `subscriptionId`, `customerType` (`"user"` or `"organization"`), `seats`, `annual`, `disableRedirect` and `locale`. — [Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- **Webhooks handled (code verified):** only `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. Everything else goes to `onEvent`. — [@better-auth/stripe@1.7.7 tarball, dist/index.mjs](https://registry.npmjs.org/@better-auth/stripe/-/stripe-1.7.7.tgz); [Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- Trials: the plugin "blocks repeat trials across all plans for a user" automatically. There was a related bug, "[Stripe] Trial abuse: `hasEverTrialed` check uses wrong subscription set" (#6863, closed 2026-02-13). — [Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe); [GitHub issues: stripe](https://github.com/better-auth/better-auth/issues?q=is%3Aissue%20stripe%20sort%3Acomments-desc)
- `authorizeReference({ user, session, referenceId, action })` receives actions `"list-subscription"`, `"upgrade-subscription"`, `"cancel-subscription"` and `"restore-subscription"`. The docs recommend using it to verify ownership or admin role for org reference IDs. — [Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- Organization and seat billing:
  - `customerType: "organization"` bills the org. `seats` maps to the subscription item quantity, but enforcing the member limit is "left to your app".
  - **In 1.7, org subscriptions require `organization: { enabled: true }` inside `stripe()`**, and the `onSubscriptionCancel` `event` parameter became required. — [Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe); [1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide.md)
- **Plan limits are not enforced (code verified).**
  - `limits` is typed `Record<string, unknown>`. It is copied onto the subscription record on creation and attached to each item returned by `listActiveSubscriptions` (`limits: plan?.limits`).
  - There is no counter or enforcement logic. The docs leave enforcement to the app. — [@better-auth/stripe@1.7.7 tarball](https://registry.npmjs.org/@better-auth/stripe/-/stripe-1.7.7.tgz); [Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- **Metered prices:**
  - Issue #8920, "Stripe subscriptions can't be created using only metered usage" (opened 2026-04-02 on ^1.5.4), failed with a Stripe "Quantity should not be specified where usage_type is `metered`" error.
  - The maintainer replied on 2026-04-03: "If you want pure metered billing, set the base price to free for now… I'll also look into supporting pure metered billing directly."
  - The issue was closed via PR #8926 on 2026-04-10. — [Issue #8920](https://github.com/better-auth/better-auth/issues/8920)
- In 1.7.7 code, `isMeteredPrice()` checks `price.recurring.usage_type === "metered"` and leaves out `quantity` for metered line items. **I found no meter-event or usage-record reporting code in the bundle.** — [@better-auth/stripe@1.7.7 tarball, dist/index.mjs](https://registry.npmjs.org/@better-auth/stripe/-/stripe-1.7.7.tgz)
- Documented limitations:
  - Only one active or trialing subscription per `referenceId`. You must pass `subscriptionId` when upgrading, or risk duplicate billing.
  - All line items must share one billing interval.
  - The org billing email isn't synced.
  - Deleting an org with an active subscription isn't blocked automatically.
  - Restore doesn't work on subscriptions that have already ended.
  - `successUrl` is rewritten to add an intermediate redirect that handles webhook race conditions. — [Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- Known issues:
  - **#10434 (open, opened 2026-07-16, v1.6.23):** "Stripe plugin creates new customer without checking for existing customer". The suspected root cause is the ownership check on stale `userId` metadata on the Stripe customer, for example after a user is deleted and re-registers. A fix PR (#10568) is open, and no maintainer response appears in the thread. — [Issue #10434](https://github.com/better-auth/better-auth/issues/10434)
  - Others (titles and dates from the issue list):
    - #5780 "Stripe recurring subscription cancel doest make DB set cancelAtPeriodEnd = true" (closed 2025-12-26)
    - #9089 "Stripe checkout URL for upgradeSubscription broken when user manages subscriptions for multiple organizations" (closed 2026-04-10)
    - #6075 "Make Stripe Plugin More Generic to Support Connect and Other Use Cases" (closed 2026-07-11)
    - #4861 "Best way to auto-subscribe new users" (closed 2025-11-20)
    - **[possibly stale]** #2385 "change email does not update the customer's email in stripe" (closed 2025-09-30)
    - #2501 Stripe webhooks on Cloudflare/OpenNext (closed 2025-10-22) — [GitHub issues: stripe](https://github.com/better-auth/better-auth/issues?q=is%3Aissue%20stripe%20sort%3Acomments-desc)
  - Security: GHSA-h3rm-78g3-j7cp, wrong-organization billing actions, fixed in 1.6.21 (see Q1). — [GHSA-h3rm-78g3-j7cp](https://github.com/better-auth/better-auth/security/advisories/GHSA-h3rm-78g3-j7cp)

### Inferences
- For RankSEO, atomic per-period quotas such as "N keyword lookups a month" are not provided by any Better Auth component. A sound design keeps a `usage` table in Postgres keyed by `(referenceId, period_start, feature)`. It reads the limit from the plan's `limits` returned with the subscription, and enforces with a single conditional `UPDATE … SET used = used + n WHERE used + n <= limit RETURNING …`, or a transaction with row locking, before calling the LLM.
- Webhooks from Stripe (`customer.subscription.updated`) can drive period resets through `onSubscriptionUpdate` or `onEvent`, which handles `invoice.paid`.
- Free-tier users have no Stripe subscription row. The app must treat "no active subscription" as the free plan and apply free limits itself.
- When migrating data from MongoDB to Postgres, keep user IDs stable. The plugin's customer de-duplication relies on `userId` in Stripe customer metadata (#10434), so changed IDs could cause the plugin to discard existing customers and create duplicates.
- The plugin covers only the 4 subscription events. Dunning, `invoice.payment_failed` and refunds need `onEvent` handlers written by the team.

### Gaps
- The exact contents of PR #8926 and whether pure metered plans work end to end without workarounds; the issue thread does not describe the change.
- Whether `limits` are persisted for all creation paths, or only for subscriptions created via the `customer.subscription.created` webhook. The code shows the latter path; other paths were not traced.
- No maintainer statement was found on future native usage-based or quota features in the Stripe plugin.

---

## 4. Other billing integrations (Autumn, Polar, Dodo Payments, Commet, and similar) and what they add

### Takeaway
The official docs list seven payment plugins: Stripe, Polar, Autumn, Dodo Payments, Creem, Chargebee and Commet. The ones that add **usage tracking and entitlement checks** are:
- **Autumn** (`check`/`track` over Stripe, no webhooks)
- **Polar** (usage ingestion, meters, customer state with benefits)
- **Commet** (usage tracking and feature checks; Merchant of Record)

All of them move quota state to an external service. None documents atomic check-and-increment semantics.

### Cited Findings
- The docs index lists payment plugins: Stripe, Polar, Autumn Billing, Dodo Payments, Creem, Chargebee and Commet. — [Better Auth docs llms.txt](https://better-auth.com/docs/llms.txt)
- **Autumn** (`autumn-js`, imported from `autumn-js/better-auth`):
  - It "sits between your app and Stripe" as the source of truth for subscriptions, usage metering and feature permissions, and "requires no webhooks".
  - Client: `attach`, `allowed`/`check`, `openBillingPortal` and `cancel`.
  - Server: `auth.api.check({ body: { featureId } })` and `auth.api.track({ body: { featureId, value } })`.
  - `customerScope` can be `"organization"` or `"user_and_organization"`.
  - The docs don't say whether `track` is atomic. — [Autumn plugin docs](https://better-auth.com/docs/plugins/autumn.md)
  - `autumn-js` has 300,597 weekly downloads (across all uses, not only Better Auth). — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/autumn-js)
- **Polar** (`@polar-sh/better-auth`, "maintained by Polar team"):
  - `checkout()`, `portal()` and `webhooks()` with signature verification.
  - `usage()` with `authClient.usage.ingest(...)` and `usage.meters.list`.
  - `authClient.customer.state()` returns active subscriptions, granted benefits and meter balances "to check if you should provision access".
  - The page does not state Merchant of Record status. — [Polar plugin docs](https://better-auth.com/docs/plugins/polar.md)
  - 39,604 weekly downloads. — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@polar-sh%2Fbetter-auth)
- **Dodo Payments** (`@dodopayments/better-auth`):
  - It describes itself as a "global Merchant-of-Record platform".
  - Plugins: checkout, portal and webhooks, plus `createCustomerOnSignUp`.
  - **No usage-based billing or entitlement functions are documented.** — [Dodo Payments plugin docs](https://better-auth.com/docs/plugins/dodopayments.md)
  - 4,647 weekly downloads. — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@dodopayments%2Fbetter-auth)
- **Commet** (`@commet/better-auth`):
  - A Merchant of Record with "usage-based billing", "seat management" and "feature access control (boolean, metered and seat-based)".
  - Client: `authClient.usage.track`, `authClient.features.check` and `features.canUse`, which returns `{ allowed, willBeCharged }`. — [Commet plugin docs](https://better-auth.com/docs/plugins/commet.md)
  - Only 123 weekly downloads, so very early adoption. — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@commet%2Fbetter-auth)
- Separately, the API Key plugin has per-key quota fields (`remaining`, `refillAmount`, `refillInterval`). The docs don't say whether decrementing is atomic. — [API Key docs](https://better-auth.com/docs/plugins/api-key.md)

### Inferences
- Autumn is the closest fit to "server-side entitlements and usage limits on top of Stripe" without building it yourself. The cost is an extra vendor in the hot path: a network round trip per `check`, with `track` called after the work completes, which is not obviously race-safe under concurrent requests.
- Polar, Commet and Dodo are Merchant-of-Record options (Polar's status is not confirmed on the page). They change who handles tax and VAT, and they mean leaving Stripe as the processor of record. That is a larger business decision than an auth-layer choice.
- For strict atomic quotas tied to expensive LLM calls, owning the counter in Postgres (see Q3) gives the strongest guarantees and the least lock-in. An external billing layer can still be used to bill overages.

### Gaps
- Atomicity and consistency guarantees of Autumn `track`, Polar ingest and Commet `usage.track` under concurrency: not documented on the Better Auth plugin pages, and the vendors' own docs were not reviewed.
- The Creem and Chargebee plugin pages were not reviewed.

---

## 5. Database adapters (Postgres via Drizzle, Prisma or Kysely; MongoDB), migration tooling, and implications of moving to Postgres

### Takeaway
Postgres is a first-class target through:
- the built-in Kysely adapter, the only one with direct `npx auth migrate`
- Drizzle or Prisma, where the CLI generates the schema and the ORM applies it

MongoDB is supported too. The CLI is now the `auth` npm package (`npx auth@latest …`). Moving RankSEO from Prisma+MongoDB to Prisma+Postgres is mainly a data-migration exercise (IDs, Stripe metadata, sessions). Better Auth ships no Mongo→Postgres migrator.

### Cited Findings
- Adapters:
  - The built-in Kysely adapter covers PostgreSQL, MySQL, SQLite/D1 and MSSQL.
  - Drizzle, Prisma and MongoDB adapters are documented.
  - Community adapters exist. — [Database docs](https://better-auth.com/docs/concepts/database.md); [Better Auth docs llms.txt](https://better-auth.com/docs/llms.txt)
- `better-auth@1.7.7` depends directly on `@better-auth/drizzle-adapter`, `kysely-adapter`, `memory-adapter`, `mongo-adapter` and `prisma-adapter`. Drivers such as `pg`, `mongodb`, `@prisma/client` and `drizzle-orm` are optional peer dependencies. — [npm registry: better-auth](https://registry.npmjs.org/better-auth)
- CLI (`npx auth@latest`; the `auth` package has 618,366 weekly downloads):
  - `generate`: writes a Prisma schema, a Drizzle `schema.ts`, or Kysely `schema.sql`.
  - `migrate`: "Only the built-in Kysely adapter supports this".
  - `check schema`
  - `create-admin`
  - `init`: limited to `--framework` Next.js and `--database` SQLite.
  - `upgrade`
  - `info --json`: secrets are redacted.
  - `secret` — [CLI docs](https://better-auth.com/docs/concepts/cli.md); [npm downloads API](https://api.npmjs.org/downloads/point/last-week/auth)
- Prisma adapter:
  - Peer dependencies allow Prisma 5, 6 or 7. The docs use "Prisma 7 and PostgreSQL" with `@prisma/adapter-pg`.
  - The CLI generates the schema; you apply it with `prisma migrate dev`.
  - Joins (`advanced.database.joins`) have existed **since 1.4.0** and claim "upwards of 2x to 3x" faster `/get-session`. — [Prisma adapter docs](https://better-auth.com/docs/adapters/prisma.md); [npm registry: @better-auth/prisma-adapter](https://registry.npmjs.org/@better-auth/prisma-adapter)
- Core tables are `user`, `session`, `account` and `verification`. Plugins add more: `subscription` (Stripe), `rateLimit` (database rate limiting), and organization, member and invitation tables. — [Database docs](https://better-auth.com/docs/concepts/database.md); [Rate limit docs](https://www.better-auth.com/docs/concepts/rate-limit)
- ID generation (`advanced.database.generateId`):
  - `false`: the database generates all IDs.
  - `"serial"`: numeric auto-increment IDs.
  - `"uuid"`: on PostgreSQL the database generates them.
  - A function can decide per model. — [Database docs](https://better-auth.com/docs/concepts/database.md)
- Postgres specifics: `database.schemaName` for a non-default schema. 1.7 added Drizzle Postgres schema namespaces and Drizzle Relations v2. — [CLI docs](https://better-auth.com/docs/concepts/cli.md); [Better Auth blog: 1.7](https://better-auth.com/blog/1-7)
- Transactions: database "after" hooks run after the transaction commits and are skipped on rollback. Per-adapter transaction support isn't listed. — [Database docs](https://better-auth.com/docs/concepts/database.md)
- 1.7 adapter contract changes:
  - Atomic `incrementOne` and `consumeOne` were required in 1.7.0–1.7.2 and became optional again later.
  - Adapters must provide "atomic conditional writes and accurate affected-row counts".
  - One-time codes, refresh tokens, invitations, counters and rate limits now use atomic adapter operations. — [1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide.md); [Better Auth blog: 1.7](https://better-auth.com/blog/1-7)
- Runtime schema validation (`advanced.database.validateSchema`) is on by default, including in production. — [Database docs](https://better-auth.com/docs/concepts/database.md)
- Official migration guides exist for Auth.js, Auth0, Clerk, Supabase Auth and WorkOS. **There is none for MongoDB→Postgres.** — [Better Auth docs llms.txt](https://better-auth.com/docs/llms.txt)
- Mongo adapter maintenance: "MongoDB Adapter: List all sortable fields to index" (#5454, closed 2026-07-03). — [GitHub issues: "rate limit"](https://github.com/better-auth/better-auth/issues?q=is%3Aissue%20%22rate%20limit%22%20sort%3Acomments-desc)

### Inferences
- The lowest-friction path for the rebuild:
  1. Keep the Prisma adapter, switch the provider to `postgresql`, and run `npx auth@latest generate --adapter prisma --dialect postgresql`.
  2. Apply with `prisma migrate`.
  3. Write a one-off ETL from MongoDB that preserves the string IDs of user, account and subscription rows. That keeps Stripe customer metadata and `referenceId` links valid.
  - Or use Drizzle or Kysely if the team prefers SQL-first tools; Kysely is the only path with `npx auth migrate`.
- Sessions can simply be dropped, forcing a re-login, which is what the Supabase guide does.
- Postgres plus the 1.7 atomic adapter operations is a better fit than MongoDB for transactional quota counters and database-backed rate limiting. Use 1.7.7 or later because of GHSA-44jh.

### Gaps
- How Prisma+MongoDB IDs (`@db.ObjectId` vs plain strings) are represented in the current RankSEO schema determines the ETL complexity. Not visible from public sources.
- Per-adapter transaction semantics (whether Prisma's adapter wraps multi-step auth writes in a transaction) are not documented.

---

## 6. Other relevant plugins: organizations/teams, API keys, admin, magic link, email OTP, passkeys, multi-session

### Takeaway
The plugin catalogue covers everything RankSEO plausibly needs:
- orgs and teams with RBAC
- API keys with per-key rate limits and quotas
- admin tools: ban, impersonate, revoke sessions
- passwordless methods: magic link, email OTP, passkeys
- multi-session

Several plugins are now **separate packages**: `@better-auth/api-key`, `@better-auth/passkey`, `@better-auth/sso` and `@better-auth/mcp`. Several had 2025–2026 advisories, so keep them patched.

### Cited Findings
- The docs index lists:
  - Authentication: 2FA, username, anonymous, phone number, magic link, email OTP, passkey, generic OAuth, one tap and SIWE.
  - Authorization: admin, Agent Auth, API key, MCP and organization.
  - Utility: bearer, device authorization, captcha, HIBP, i18n, last login method, multi session, OAuth proxy, one-time token, Open API, JWT and test utils. — [Better Auth docs llms.txt](https://better-auth.com/docs/llms.txt)
- **Organization**:
  - Default roles are owner, admin and member. Custom roles use `createAccessControl` and are checked with `hasPermission`.
  - Invitations expire after 48 h by default (`invitationExpiresIn`).
  - Teams are opt-in (`teams: { enabled: true }`). `activeOrganizationId` is stored on the session.
  - `dynamicAccessControl` allows runtime roles.
  - `membershipLimit` and `invitationLimit` both default to 100. `organizationHooks` are available.
  - `requireEmailVerificationOnInvitation` gives a stricter posture. — [Organization docs](https://better-auth.com/docs/plugins/organization.md)
- **API Key** (`@better-auth/api-key`, 1,493,278 weekly downloads):
  - Per-key `rateLimitEnabled`, `rateLimitTimeWindow` and `rateLimitMax`.
  - Quotas through `remaining`, `refillAmount` and `refillInterval`.
  - `permissions` and `metadata`.
  - Org-owned keys via `references: "organization"`.
  - Secondary storage support. — [API Key docs](https://better-auth.com/docs/plugins/api-key.md); [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@better-auth%2Fapi-key)
  - Issues: "API Key rate limiting returns 401 instead of 429" (#9504, closed 2026-05-09). "API Key rate limiting not behaving as expected" (#6035) is **open**. — [GitHub issues: metered/usage search](https://github.com/better-auth/better-auth/issues?q=is%3Aissue%20stripe%20metered%20OR%20usage-based)
- **Admin**:
  - Create, list and update users; set roles and passwords.
  - **Ban and unban** with a reason and expiry. `defaultBanExpiresIn` is unset, so bans never expire by default.
  - Revoke sessions.
  - Impersonate users, for 1 h by default; admins can't impersonate other admins by default.
  - `removeUser`.
  - `npx auth create-admin` creates the first admin. — [Admin docs](https://better-auth.com/docs/plugins/admin.md)
- **Email OTP**: see Q2 for defaults. Verifying a sign-in OTP on an unverified account "removes its password and revokes its sessions"; this is the post-GHSA-qq9h behaviour. — [Email OTP docs](https://better-auth.com/docs/plugins/email-otp.md)
- **Magic link**: this plugin was involved in the critical GHSA-965c (fixed in 1.7.7) and in GHSA-qq9h (fixed in 1.6.22). — [GHSA-965c-763c-88jm](https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm); [GHSA-qq9h-g4jm-xgf3](https://github.com/better-auth/better-auth/security/advisories/GHSA-qq9h-g4jm-xgf3)
- **Passkey** (`@better-auth/passkey`, 1,991,639 weekly downloads): 1.7 lets passkey registration create a session. Advisory GHSA-4vcf-q4xf-f48m (2025-11-24): any signed-in user could delete other users' passkeys. — [Better Auth blog: 1.7](https://better-auth.com/blog/1-7); [Advisories p.3](https://github.com/better-auth/better-auth/security/advisories?page=3); [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@better-auth%2Fpasskey)
- **Multi-session**: advisory GHSA-wmjr-v86c-m9jj (Low, 2025-11-26): forged multi-session cookies could make sign-out delete arbitrary sessions. — [Advisories p.3](https://github.com/better-auth/better-auth/security/advisories?page=3)

### Inferences
- For free-tier abuse, the admin plugin's ban with expiry, combined with `databaseHooks`, gives an in-house kill switch. Org and teams are only needed if RankSEO sells team plans.
- Using the API Key plugin's `remaining` field for product quotas would be a misuse: it is per key, not per user per period, and its atomicity is undocumented.
- Each optional plugin adds attack surface. Many 2026 advisories hit magic link, OAuth proxy, SSO and SCIM, so enable only what the product needs.

### Gaps
- The magic link and multi-session plugin pages were not fetched in detail; the defaults for magic-link token expiry are not captured here.

---

## 7. AI-coding-agent support: official MCP server, llms.txt and docs for LLMs, CLI scaffolding; reported experiences with coding agents

### Takeaway
Better Auth has invested in agent-facing docs:
- a hosted **docs MCP server** (`https://mcp.better-auth.com/mcp`), with a one-command installer for Claude Code, Cursor, Codex and OpenCode
- **versioned llms.txt** files for 1.7 and 1.6, plus per-page Markdown
- an official **skills pack** (`npx skills add better-auth/skills`)

The MCP server is docs-only; it does not provision or manage anything. I found no substantive first-hand reports, positive or negative, of coding agents building with Better Auth.

### Cited Findings
- AI resources page lists: in-docs AI chat (⌘I), `/llms.txt` ("A machine-readable index plus per-page Markdown"), a remote MCP server ("documentation search, examples, and setup") and Skills. — [AI resources docs](https://better-auth.com/docs/ai-resources.md)
- MCP server:
  - URL: `https://mcp.better-auth.com/mcp`, a remote HTTP server.
  - Installers: `npx auth@latest mcp --claude-code` (runs `claude mcp add`), `--cursor`, `--codex`, `--open-code` and `--manual`.
  - It is separate from the MCP *plugin*, which makes your app an MCP authorization server.
  - Individual tools are not listed. — [MCP docs](https://better-auth.com/docs/ai-resources/mcp.md)
- llms.txt is versioned: the v1.7 index is at `https://better-auth.com/docs/llms.txt` and v1.6 at `https://better-auth.com/docs/1.6/llms.txt`. The root file also points at the docs MCP server. — [Better Auth llms.txt](https://www.better-auth.com/llms.txt)
- Skills: install with `npx skills add better-auth/skills`. The repository `github.com/better-auth/skills` contains `better-auth/` and `security/` folders plus a `.claude-plugin/` folder, and has 222 stars as of Oct 2026. — [Skills docs](https://better-auth.com/docs/ai-resources/skills.md); [GitHub: better-auth/skills](https://github.com/better-auth/skills)
- CLI scaffolding is limited: `npx auth@latest init` supports only Next.js and SQLite. `npx auth@latest info --json` emits diagnostics with secrets redacted. — [CLI docs](https://better-auth.com/docs/concepts/cli.md)
- Agent identity in apps, a separate topic:
  - The Agent Auth plugin.
  - `@better-auth/mcp` in 1.7, which supports the MCP 2026-07-28 authorization profile and the v2 MCP TypeScript SDK; 583,989 weekly downloads.
  - Vercel cites agent identity as a main reason for the acquisition. — [Better Auth blog: 1.7](https://better-auth.com/blog/1-7); [Vercel blog](https://vercel.com/blog/vercel-acquires-better-auth); [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@better-auth%2Fmcp)
- Community experiences: a targeted search returned only generic "Claude Code vs Cursor" articles that use "refactor this auth layer to use better-auth" as an example prompt. There were no substantive Better Auth–specific reports. — [Cyrus: Claude Code vs Cursor 2026](https://www.atcyrus.com/stories/claude-code-vs-cursor-comparison-2026) (via search summary)

### Inferences
- The API changes fast (1.4 → 1.7 in about 9 months), with renamed packages and breaking contracts:
  - the CLI moved to `npx auth`
  - `oidcProvider` was removed
  - API key and passkey moved to separate packages
  - rate-limit stores require `consume`
  - secondary storage requires `increment`
- Coding agents relying on training data will likely produce outdated code. Wiring the docs MCP and skills into Claude Code, and pinning the version in `CLAUDE.md`, mitigates this.
- Better Auth's MCP helps agents *write code*. An agent-native BaaS such as InsForge offers MCP tools that *operate the backend*: database, migrations, auth configuration. That difference is the real "agent workflow" trade-off in the comparison.

### Gaps
- The list of tools exposed by the docs MCP server, and the individual skill names in the skills repo, are not documented on the pages fetched.
- No credible first-hand reports were found, on Reddit, Hacker News or X, about agent-generated Better Auth code quality or failure modes.

---

## 8. Deployment: long-lived Node server (e.g. Railway) vs serverless; BaaS integrations (Convex, Supabase, InsForge); running on top of a BaaS Postgres

### Takeaway
Better Auth is a library that runs inside your app process, so a long-lived Node server on Railway is a natural fit.
- In-memory rate limiting works on a single replica.
- Use Redis or database storage once scaled out.
- Configure `ipAddressHeaders` for Railway's proxy.

It can sit on top of a BaaS Postgres:
- Supabase: documented, with your own Postgres connection string.
- **InsForge: has an official integration.** Better Auth tables live in a `better_auth` schema, and a bridge route mints HS256 JWTs for InsForge's PostgREST and RLS.
- Convex: runs Better Auth inside Convex through a Convex-maintained component.

### Cited Findings
- Better Auth is framework-agnostic. The integrations index lists Next.js, Hono, Express, Fastify, NestJS, Elysia, Nitro, Encore, Effect, Convex, Expo and others. — [Better Auth docs llms.txt](https://better-auth.com/docs/llms.txt)
- Vercel says Better Auth "runs anywhere". The Better Auth post says Vercel "shares our commitment to keeping auth open source, framework and platform agnostic" (2026-07-07). — [Vercel blog](https://vercel.com/blog/vercel-acquires-better-auth); [Better Auth blog: joins Vercel](https://better-auth.com/blog/better-auth-joins-vercel)
- Next.js App Router:
  - Mount the route handler at `/api/auth/[...all]` with `toNextJsHandler(auth)`.
  - Add the `nextCookies()` plugin, last in the array, so server actions set cookies.
  - In Next.js 16, `proxy.ts` can do full validation with `auth.api.getSession` on the Node runtime.
  - `getSessionCookie` only checks that a cookie exists and is "NOT SECURE" for authorization. — [Next.js integration docs](https://better-auth.com/docs/integrations/next.md)
- Serverless caveats:
  - Memory rate-limit storage "may not suit serverless". — [Rate limit docs](https://www.better-auth.com/docs/concepts/rate-limit)
  - Email sends need `waitUntil`. — [Email docs](https://www.better-auth.com/docs/concepts/email)
  - Prisma client lifecycle needs care on serverless and hot-reload runtimes. — [Prisma adapter docs](https://better-auth.com/docs/adapters/prisma.md)
  - Open issue #10315 (opened 2026-07-05): "Lazily-cached init promises hang forever on Cloudflare Workers when the initializing request is aborted". — [GitHub issues: "rate limit"](https://github.com/better-auth/better-auth/issues?q=is%3Aissue%20%22rate%20limit%22%20sort%3Acomments-desc)
- **Railway client IP (for rate limiting).** A Railway employee (Brody) said on 2026-05-06 that `X-Real-IP` "is always set by our proxy", "We will always overwrite it", and "Apps behind our HTTP proxy cannot be accessed directly". In the same thread, Railway said its docs "do not currently specify the exact overwrite/append semantics or provide a formal anti-spoofing guarantee", and that it publishes no stable trusted-proxy CIDR range. — [Railway Station thread](https://station.railway.com/questions/need-authoritative-railway-client-ip-p-b7a7b4bd)
- Conflicting community reports say `X-Real-IP` sometimes shows a load-balancer or Fastly IP instead of the client's. — [Railway Station: X-Real-IP showing LB IP](https://station.railway.com/questions/x-real-ip-showing-our-google-lb-s-ip-ins-ac9e47d8) (via search summary); [Railway Station: Edge proxy headers can't be trusted](https://station.railway.com/questions/edge-proxy-x-forwarded-for-and-x-real-ip-c5a50049) (via search summary)
- Better Auth does not trust comma-separated `x-forwarded-for` chains by default, and supports `ipAddressHeaders` and `trustedProxies`. — [Rate limit docs](https://www.better-auth.com/docs/concepts/rate-limit)
- **Supabase:** the official Supabase Auth migration guide uses the Supabase Postgres as Better Auth's database (`new Pool({ connectionString: process.env.DATABASE_URL })`, "Copy your `DATABASE_URL` from your Supabase project").
  - Existing bcrypt hashes carry over if you configure bcrypt `hash` and `verify` functions.
  - Migration "will invalidate all active sessions".
  - RLS is "not currently" covered, so policies based on `auth.uid()` need separate work. — [Supabase migration guide](https://better-auth.com/docs/guides/supabase-migration-guide)
- **InsForge** (official InsForge doc):
  - Setup: `npx @insforge/cli link --project-id <id> --auth better-auth` scaffolds the Better Auth server and client, sign-in and sign-up pages, a bridge route `/api/insforge-token` that "signs an HS256 JWT with InsForge's secret" so PostgREST and RLS accept requests, a `requesting_user_id()` SQL function, and a bootstrap migration.
  - "Better Auth's tables live in a dedicated `better_auth` schema. PostgREST exposes only `public`, so user emails and sessions are hidden from the data API by construction."
  - "self-hosted InsForge shares the same Postgres for free; cloud needs a connection string to a Postgres you control."
  - InsForge's own Auth → Users list stays empty, because users live in `better_auth.user`.
  - The plugins named there are organization, twoFactor, magicLink, apiKey and passkey. — [InsForge docs: Better Auth integration](https://docs.insforge.dev/integrations/better-auth.md)
- A third-party skills directory says a one-time `REVOKE` is needed after migration to seal PostgREST exposure. This is not in the official doc. — [skillselion: insforge-integrations](https://skillselion.com/skills/insforge/agent-skills/insforge-integrations) (via search summary)
- **Convex:**
  - `@convex-dev/better-auth` is maintained by Convex (`get-convex` org) and has 296,457 weekly downloads.
  - Better Auth runs inside Convex functions, and its tables are a Convex component schema (`convex/betterAuth/schema.ts`) wired through `authComponent.adapter(ctx)`.
  - Environment variables are set in Convex.
  - The docs give no plugin compatibility list. — [Convex integration docs](https://better-auth.com/docs/integrations/convex.md); [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@convex-dev%2Fbetter-auth)
- Third-party comparisons (2026), mostly from starter-kit vendors or competitors, position Better Auth as the self-hosted, no per-MAU-fee option and Clerk as the managed, fastest-to-ship option. One claim that "SAML support is only a community plugin" is **contradicted** by the official SSO plugin and the "SAML SSO with Okta" guide. — [supastarter](https://supastarter.dev/blog/better-auth-vs-nextauth-vs-clerk) and [Makerkit](https://makerkit.dev/blog/tutorials/better-auth-vs-clerk) (via search summary) contradicted by [Better Auth docs llms.txt](https://better-auth.com/docs/llms.txt)

### Inferences
- **Railway, single replica:** the defaults (memory rate limiting) work. Set `advanced.ipAddress.ipAddressHeaders: ["x-real-ip"]`, per Railway staff, and watch for the "could not determine a client IP" warning in logs.
- **Railway, multiple replicas:** add Railway Redis as `secondaryStorage`, which by default holds rate limits and sessions. Watch GHSA-2vg6 (deleted users keep sessions in secondary storage), and consider `storeSessionInDatabase: true`. Alternatively use database rate-limit storage on 1.7.7 or later.
- Railway does not formally guarantee header semantics. Pairing the app limiter with Turnstile, and an upstream WAF if needed, is prudent.
- "Better Auth + InsForge" is a documented hybrid. Better Auth owns identity in the same Postgres, and InsForge's data API and RLS trust Better Auth through a minted JWT. The rebuild can therefore use InsForge's database and agent tooling without adopting InsForge Auth. Costs:
  - an extra bridge hop
  - HS256 shared-secret coupling
  - on InsForge Cloud, a separately hosted Postgres for the auth tables. The doc says cloud "needs a connection string to a Postgres you control", which suggests Better Auth's tables do not live in InsForge Cloud's database.
- Low lock-in: auth data stays in standard Postgres tables you own, under an MIT library. Migrating away later means moving users and accounts, and keeping password hashes compatible (scrypt by default) or configuring custom `hash` and `verify` functions.

### Gaps
- No official Better Auth deployment guide for Railway; no Railway template was verified.
- Whether InsForge Cloud can host Better Auth's tables in the project's own Postgres, as opposed to a separate external Postgres. The InsForge doc implies not, but does not state it outright.
- Whether InsForge's integration needs the post-migration `REVOKE` step, which only a third-party source mentions.
