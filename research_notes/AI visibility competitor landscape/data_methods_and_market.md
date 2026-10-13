# AI visibility tools: data collection methods, data costs, and market structure (as of October 13, 2026)

Scope note: research done 2026-10-13. Every price below is dated: "fetched 2026-10-13" means I read the live page that day, and the page showed no effective date unless one is quoted. Anything older than 2026 is flagged **[pre-2026, possibly outdated]**. Almost every API-vs-UI study comes from a vendor that sells one method or the other, so each one is labeled with who funded it.

AISEO context used in the inferences below: Bright Data consumer-UI scrapers (Perplexity for keyword reports; ChatGPT and Gemini for visibility scans) at about $1.50 per 1,000 records pay-as-you-go, with Claude Sonnet doing the analysis. Estimated cost is about $0.06 per keyword report (3 answers) and $0.09 per visibility scan (10 answers).

---

## 1. API-based vs consumer-UI collection: how far apart are the answers, how do vendors handle variance, and how volatile are answers?

### Takeaway
Every 2026 study that compared the two methods found that official API answers and consumer-UI answers differ a lot. ChatGPT diverges most: brand overlap is about 11–24% and source/domain overlap about 4–6%. Perplexity, Gemini and AI Mode diverge less but still substantially. Answers are also very unstable inside a single method: the same prompt almost never returns the same brand list twice, and 40–60% of cited domains change month to month. The defensible metric is therefore "mention rate across many runs", not rank. Nearly all of this evidence comes from vendors with a commercial interest, and no peer-reviewed API-vs-UI study exists.

### Cited Findings

**API vs UI: quantified comparisons (all vendor-run; method sold by the author in brackets)**
- **Surfer [sells scraped/UI tracking]**: 1,000 prompts across five products (ChatGPT, Perplexity, Gemini, AI Mode, AI Overviews), collected via the consumer UI and via official APIs. Data was collected Aug 4, 2026 with cloro; the page was last updated Oct 4, 2026. Brand overlap between the methods was 15.5–23.8% raw, or 21.3–31.6% after canonicalizing brand names; Gemini was the most similar. — [Surfer](https://surferseo.com/blog/llm-scraped-ai-answers-vs-api-results)
- Surfer, same study, sources per answer (API vs scraped UI): ChatGPT 3.1 vs 12.1; Perplexity 19.5 vs 10.27; Gemini 6.5 vs 3.4; AI Mode 14.6 vs 22.2. Web search fired in 88% of ChatGPT UI prompts and 100% for the other four UIs. Over the API it fired for Perplexity 100%, AI Mode/AIO 94%, Gemini 85% and ChatGPT 83%. Domain-level source overlap ranged from Perplexity 26.7% (highest) to ChatGPT 4.8% (lowest). ChatGPT API answers named 13.8 brands vs 7.9 in the UI and were about 2.05x longer. Limitation: one sample per prompt. — [Surfer](https://surferseo.com/blog/llm-scraped-ai-answers-vs-api-results)
- An earlier version of the Surfer study, cited in January 2026, reported 24% brand overlap over 1,000 ChatGPT prompts. API answers averaged 406 words vs 743 in the UI, API answers included sources only 75% of the time, and the API missed brands 8% of the time. — [Gumshoe blog citing Surfer, Jan 20, 2026](https://gumshoe.ai/blog/how-apis-unlock-better-insights-into-ai-search-visibility/); also quoted as "24% brand overlap, 4% source overlap" by [ThriveStack, Aug 2026](https://www.thrivestack.ai/research/ai-visibility-tracking-non-determinism)
- **Brandlight [sells UI monitoring]**, June 2026: 2,565 matched prompt pairs (ChatGPT 834, Gemini 895, Perplexity 836). The API side used GPT-5.5, Gemini with Search grounding, and Perplexity Sonar Pro, all with search on; the UI side was scraped from chatgpt.com, gemini.google.com and perplexity.ai. UI-vs-API brand overlap was ChatGPT 11%, Gemini 12%, Perplexity 6%, and the same top brand appeared in only 9–16% of pairs. Citations per answer (UI vs API) were ChatGPT 15.2 vs 4.4, Gemini 5.1 vs 13.2, Perplexity 10.0 vs 7.8. Top-25 domain overlap was ChatGPT 9%, Gemini 52%, Perplexity 22%. Reddit was a top-3 cited domain in the UI channel for all three. Caveat: the UI and API runs were one day apart. — [Brandlight research](https://research.brandlight.ai/ui-vs-api.html)
- **Genezio [argues for UI-based scoring]**, Feb 4, 2026: 3,645 conversations over 27 days in UK banking, GPT-5.2 API vs ChatGPT.com. Of 3,856 unique query fan-outs, none were shared between the two paths. Only 12.3% of 5,701 unique source URLs were shared. Bank/issuer domains made up 36.0% of API source-uses vs 6.1% in the UI, and comparison/aggregator sites 11.0% vs 32.2%. — [Genezio](https://genezio.com/research/zero-query-overlaps/)
- **Paprik AI [recommends UI tracking]**, Apr 25, 2026: 35 prompts × 10 days, five brands, three setups: ChatGPT UI, GPT-5.4 API with no search, and GPT-5.3 Chat API with search. Unique brands were 845 in the UI, 135 for the API without search and 580 for the API with search. One brand (Myles) held 29% share of voice in the no-search API, 18% in the API with search and 6% in the UI. The author concludes that API tracking cannot approximate the UI and cannot reflect new web content until the models retrain. — [Paprik](https://paprik.ai/blog/accurate-api-based-ai-visibility-tracking-chatgpt-ui)
- **Promptwatch [sells UI tracking]**, Aug 2026 test with the API's web search off: 84% of UI prompts returned sources vs 26% over the API. There were 392 UI citations vs 170 API citations and 149 vs 67 unique domains, with 25.6% source overlap. 87% of API citations pointed to a homepage. The API ranked a non-existent company ("HomeRule Europe") first. The article also says ChatGPT's use of the `site:` operator in fan-out queries jumped from ~0.4% to ~17% on Aug 8, 2026, a change only UI tracking would catch. — [Promptwatch, published Aug 17, 2026, updated Oct 12, 2026](https://promptwatch.com/blog/ui-vs-api-for-ai-search-visibility)
- **Counter-position, Conductor [uses API-based monitoring]**: Conductor argues that grounded official APIs beat scraping. Its reasons: scraping "likely" violates platform terms and breaks on UI changes, CAPTCHAs and geo-blocks; scrapers mostly capture logged-out sessions, which it says "often use older models without live search"; and APIs expose whether search fired and which sources were cited. It gives no figures for these claims. — [Conductor Academy, updated Jan 12, 2026](https://conductor.com/academy/scraping-vs-api)
- **Counter-position, Gumshoe [API with personas]**: Gumshoe simulates personalization (memory, custom instructions, seeded history) through API system messages and says it "validate[s] against native interface queries", but publishes no validation results. It calls sock-puppet logged-in accounts "resource-intensive, ethically questionable, and fragile." — [Gumshoe, Jan 20, 2026](https://gumshoe.ai/blog/how-apis-unlock-better-insights-into-ai-search-visibility/)
- Vendors give these mechanisms for the gap: the consumer app adds a system prompt the user can't see, memory and personalization, different rules for when to search, routing between model variants, and interface experiments on subsets of users. — [TofuBofu, Jul 31, 2026](https://tofubofu.com/blog/ai-engine-api-vs-chat-interface); [Promptwatch](https://promptwatch.com/blog/ui-vs-api-for-ai-search-visibility)
- Google AI Overviews and AI Mode have no official API. Surfer had to stand in an AI Mode–style API (Gemini with grounding) for AI Overviews. Gemini, AI Mode and AIO APIs return redirect tokens rather than destination URLs, so page-level overlap could not be measured for them. — [Surfer](https://surferseo.com/blog/llm-scraped-ai-answers-vs-api-results). Superlines: "A Gemini API report can answer a different question, but it cannot substitute for observing AI Mode itself." — [Superlines, updated Oct 12, 2026](https://www.superlines.io/articles/api-vs-ui-data-ai-visibility-tools)
- Superlines' own published methodology collects ChatGPT, Perplexity, Gemini, AI Overviews/AI Mode and Copilot from the interface, but Claude through "API + Web Search". — [Superlines](https://www.superlines.io/articles/api-vs-ui-data-ai-visibility-tools)

**Personalization, location, model versions**
- "The Personalization Gap" (press release Sept 23, 2026; publisher not identified; full text not accessible, 403) analyzed 8,609 responses in the UK across 6 personas, 3 categories and 30 prompts. It compared history-free API calls, temporary logged-in sessions and accounts primed with user history. Brand-set divergence associated with history was ChatGPT 16.0 points, Gemini 33.3 points and Perplexity 7.2 points. Claude showed no detectable change in its recurring brand set. — [EIN Presswire (search snippet; unverified)](https://www.einnews.com/pr_news/944542004/new-study-finds-ai-personalization-can-change-which-brands-chatgpt-and-gemini-recommend)
- Bright Data's ChatGPT scraper starts a fresh session per request with no memory. It offers per-engine country targeting, but Gemini lists "European countries not available" and Grok is "Currently unavailable". ChatGPT and Grok take a `web_search` toggle; Gemini decides internally whether to search. The ChatGPT output includes `model` and `web_search_triggered` fields. — [Bright Data docs](https://docs.brightdata.com/datasets/scrapers/scrapers-library/ai-scrapers)
- Promptwatch routes location-targeted monitors through residential proxies in that location and matches browser locale and timezone; its monitors run daily. — [Promptwatch](https://promptwatch.com/blog/ui-vs-api-for-ai-search-visibility)
- ThriveStack lists brand mention rates of "roughly 18% to 50%" by country, but attributes the figure to no clear source. — [ThriveStack](https://www.thrivestack.ai/research/ai-visibility-tracking-non-determinism)

**Run-to-run and over-time volatility**
- **SparkToro/Gumshoe** (Rand Fishkin and Patrick O'Donnell): data Nov–Dec 2025, published late January 2026. Volunteers made 2,961 runs of 12 prompts, 60–100 runs per prompt per platform, across ChatGPT, Claude and Google AI Overviews/AI Mode. ChatGPT and Google AI returned the same brand list less than 1 time in 100, and the same list in the same order less than 0.1% of the time. Visibility (appearance rate) was more stable: Bose, Sony, Sennheiser and Apple appeared in 55–77% of 994 headphone responses. Real human prompts for one intent had a semantic similarity of 0.081. The study is not peer reviewed, and Gumshoe sells tracking. — [Search Engine Journal, Jan 30, 2026](https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/566242)
- **University of St. Gallen, "Don't Measure Once: Measuring Visibility in AI Search (GEO)"** (Schulte, Bleeker, Kaufmann; arXiv 2604.07585, Apr 8, 2026). The abstract argues that visibility should be treated "as a distribution rather than a single-point outcome." — [arXiv](https://arxiv.org/abs/2604.07585). The detailed figures below are as summarized by ThriveStack (secondary; I could not open the full paper): 45 days, 4 engines, 4 verticals. Day-to-day Jaccard overlap was 0.34–0.42 for sources and 0.45–0.59 for brands, with about two-thirds of cited sources changing daily. Same-day back-to-back overlap was 0.32–0.43 for sources and 0.33–0.48 for brands. Single-run standard error on per-brand detection was 0.370; it fell below 0.10 at about 7 runs and below 0.05 after about 24 days. — [ThriveStack, Aug 2026](https://www.thrivestack.ai/research/ai-visibility-tracking-non-determinism)
- ThriveStack's sampling math (a vendor's own calculations): zero mentions in 20 runs is still consistent with a true rate up to about 16%, and about 60 runs are needed before "no visibility" can be claimed. At 95% confidence and 80% power, telling 1% from 2% takes about 2,318 runs per condition, and 10% from 15% about 686. It recommends at least 7 runs per prompt per engine per day, aggregated over 2–4 weeks. — [ThriveStack](https://www.thrivestack.ai/research/ai-visibility-tracking-non-determinism)
- TofuBofu sent 10 identical API calls ("best managed IT services providers… Canada"). ChatGPT named 61 distinct firms with mean Jaccard 0.20, Claude 122 (0.09) and Gemini 47 (0.23). No firm appeared in all 10 runs for ChatGPT or Claude. — [TofuBofu, Jul 31, 2026](https://tofubofu.com/blog/ai-engine-api-vs-chat-interface)
- Even at temperature 0, 1,000 completions of one prompt on Qwen3-235B produced 80 unique outputs (Thinking Machines Lab, Sep 10, 2025) **[pre-2026]**. — [via ThriveStack](https://www.thrivestack.ai/research/ai-visibility-tracking-non-determinism)
- **Profound "citation drift"** (June vs July 2025, about 80,000 prompts per platform) **[pre-2026, possibly outdated]**: the share of July cited domains missing from June answers was Google AI Overviews 59.3%, ChatGPT 54.1%, Copilot 53.4% and Perplexity 40.5%. January-to-July drift was about 70–90%. Profound concludes that "sporadic monitoring" is "essentially meaningless". — [Profound blog, Jul 17, 2025](https://tryprofound.com/blog/ai-search-volatility)
- BrightEdge reports that 96.8% of cited domains saw zero week-over-week change, and that 87% of the movers declined (date not confirmed; from a search snippet). — [BrightEdge](https://brightedge.com/resources/weekly-ai-search-insights/ai-search-citations-week-to-week-changes)
- Google's own surfaces disagree with each other. AI Mode and AI Overviews cited the same URLs only 13.7% of the time across 540,000 query pairs (Ahrefs, Dec 2025) **[pre-2026]**, and three AI Mode runs on one day shared only 9.2% of exact URLs (SE Ranking, Aug 2025) **[pre-2026]**. Separately, 88% of AI Mode citations were not in the organic top results (Moz, Feb 2026). — [ThriveStack compilation](https://www.thrivestack.ai/research/ai-visibility-tracking-non-determinism); the Ahrefs figure is also in [SEJ](https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/566242)
- Cross-engine overlap is low too. Only 11.0% of cited domains appeared in both ChatGPT and Perplexity (Profound, 100,000 prompts; date not stated). — [via ThriveStack](https://www.thrivestack.ai/research/ai-visibility-tracking-non-determinism)

**How vendors handle variance (observed practice)**
- Most tools refresh daily: Otterly, Peec, Semrush and SE Ranking. AgencyAnalytics refreshes weekly, Ahrefs Brand Radar's index monthly (custom prompts daily to monthly), and Fenn runs on demand (prices checked Oct 4, 2026). — [Fenn pricing comparison, Oct 9, 2026](https://fenn.sh/blog/ai-visibility-tool-pricing)
- Profound's Enterprise plan refreshes prompts daily across up to 9 engines (ChatGPT, Perplexity, AI Mode, Gemini, Copilot, DeepSeek, Claude, AI Overviews, Exa) with custom languages and regions. The free trial covers 50 prompts × 3 engines for 7 days. — [Profound pricing, fetched 2026-10-13](https://www.tryprofound.com/pricing)
- Fishkin's advice to buyers: "make sure your provider answers the questions we've surfaced here and shows their math." — [SEJ](https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/566242)

### Inferences
- AISEO's choice of consumer-UI collection matches the 2026 consensus among UI-scraping vendors and puts it on the stronger side of the measurement debate. For ChatGPT especially, API data would measure a different answer, not a noisier copy of the UI one. The defensible caveat is that Bright Data's fresh, memory-free sessions are a non-personalized baseline. They are not what logged-in users with memory see; Gemini showed the largest personalization effect (33 points) in the one study found.
- AISEO's sample sizes are small by the standards of the volatility literature: 3 Perplexity answers per keyword report and 10 answers per visibility scan. Ten runs gives a single-brand mention-rate interval of roughly ±25 percentage points at mid-range rates (Wilson 95%, my calculation). Reports should present mention rates as ranges or "present/absent" flags, never as ranks. A "not mentioned in 10 runs" result is consistent with a true rate of up to about 30%, by the 3/n rule.
- Gemini via Bright Data cannot target European countries, and Grok is unavailable. Both matter if AISEO expands geographically or adds engines.

### Gaps
- No peer-reviewed or vendor-neutral API-vs-UI study was found. Every quantified comparison comes from a vendor that sells one method.
- I couldn't open the St. Gallen paper's full text, so its run counts, engines and collection method (API or UI) are unverified beyond the abstract.
- I found no independent study that isolates the effect of location (IP/country) on ChatGPT, Gemini or Perplexity brand recommendations. ThriveStack's 18–50% by-country figure has no clear source.
- No public evidence shows any vendor runs multiple samples per prompt per day by default. Cadence is published, but replicates are not.
- I couldn't open the "Personalization Gap" press release (403), so its publisher and methodology are unverified.

---

## 2. What does the underlying data cost? Scraping providers vs official APIs (per 1,000)

### Takeaway
Consumer-UI answers from scraping providers cost about **$1.20–$1.50 per 1,000** (Bright Data, DataForSEO LLM Scraper) as of October 2026. Grounded official APIs charge **$5–$35 per 1,000 requests before tokens**: OpenAI web search $10, Perplexity Sonar $5–$14, Gemini grounding $14–$35. UI scraping is therefore both cheaper per answer and, per vendor studies, closer to what (logged-out, non-personalized) users see. The trade-off is terms-of-service and breakage risk. SerpApi and Apify sit higher, at $2–$25 per 1,000 depending on plan or actor.

### Cited Findings

**Scraping / data providers**
- **Bright Data Web Scraper API** (fetched 2026-10-13): pay-as-you-go $1.50 per 1K records, billed only on success. A free tier gives 5K records per month. The Scale plan is $499/month for 384,000 records (about $1.30/1K, my calculation), with extra records at $1.30/1K. Enterprise is custom. A promotion gives 25% off the Scraper API for 3 months with code APIS25. Proxies, unblocking, parsing and storage are included. The pricing page does not price the AI scrapers separately. — [Bright Data pricing](https://brightdata.com/pricing/web-scraper)
- The Bright Data AI scrapers bill the ChatGPT scraper "per successful record". The 5,000 monthly free credits equal up to 5,000 ChatGPT records, which implies 1 credit per answer at the standard Web Scraper rate. Engines listed: ChatGPT (available), Perplexity, Gemini, Copilot, Google AI Mode, and Grok ("Currently unavailable"). Google AI Overview, Claude and Meta AI are not listed. — [Bright Data docs](https://docs.brightdata.com/datasets/scrapers/scrapers-library/ai-scrapers)
- A third party (UsagePricing, figures captured July 2026) confirms the $1.5/1K pay-as-you-go rate, the 5,000-result free tier and the $499 Scale tier. — [UsagePricing](https://usagepricing.com/blueprint/bright-data)
- AIMultiple's benchmark (dated June 2026 in search results; 1,000 tests per provider) found Bright Data near 100% success across models and the only provider above 90% on Gemini. Bright Data promotes this result. — [AIMultiple](https://aimultiple.com/es/llm-scrapers)
- **DataForSEO** (fetched 2026-10-13; pages show no dates):
  - LLM Scraper, which captures the ChatGPT and Gemini UI including sources: from $0.0012 per results page in the Standard queue, i.e. $1.20/1K. No Live price is listed. — [DataForSEO AI Optimization API](https://dataforseo.com/ai-optimization-api)
  - LLM Responses, which "queries the models directly", meaning it is API-based: from $0.0006 per task plus pass-through LLM charges. — [same](https://dataforseo.com/ai-optimization-api)
  - LLM Mentions, a database of AI-answer mentions updated on a 60-day cycle: $0.10 per request plus $0.001 per row, so $1.10 for one request returning 1,000 rows. — [DataForSEO LLM Mentions pricing](https://dataforseo.com/pricing/ai-optimization/llm-mentions). The help center lists different rates ($0.02 per request and $0.00003 per row) and a **$100 monthly minimum top-up**, which stays in the account as balance. The two sources conflict, and the help-center figures may be stale. — [DataForSEO help center](https://dataforseo.com/help-center/llm-mentions-api-subscription-explained). The product launched in November 2025 **[pre-2026]**. — [DataForSEO launch post](https://dataforseo.com/update/introducing-llm-mentions-api)
  - Google AI Mode SERP API: $0.0012 per SERP Standard ($1.20/1K), $0.0024 Priority ($2.40/1K), $0.004 Live ($4.00/1K). The optional `calculate_rectangles` parameter doubles the cost. — [DataForSEO AI Mode pricing](https://dataforseo.com/pricing/serp/google-ai-mode-serp-api)
  - AI Keyword Data: $0.0001 per keyword, about $0.10–$0.11 per 1K. — [DataForSEO](https://dataforseo.com/ai-optimization-api)
- **SerpApi** (fetched 2026-10-13; no date): Free 250 searches/month; Starter $25 for 1K ($25/1K); Developer $75 for 5K ($15/1K); Production $150 for 15K ($10/1K); Big Data $275 for 30K ($9.17/1K); Searcher $725 for 100K ($7.25/1K); Volume $1,475 for 250K ($5.90/1K). Cloud tiers run from $3,750 for 1M ($3.75/1K) down to $1.96/1K at 54M. The "Ludicrous Speed" option costs 2x and "Ludicrous Speed Max" 4x. The page does not say whether AI Mode or AI Overview requests cost extra. — [SerpApi pricing](https://serpapi.com/pricing)
- **Oxylabs** (date unknown, from a search summary of its ChatGPT product page): Web Scraper API plans are Micro $49, Starter $99 and Advanced $249/month. Non-Google targets cost about $1.15/1K on Micro, or about $1.35/1K with JS rendering. No ChatGPT-specific rate is published. — [Oxylabs ChatGPT scraper page](https://oxylabs.io/products/scraper-api/serp/chatgpt)
- **Apify** (store pages; date unknown, possibly changed): the "GPT Search" actor lists $2.00 per 1K answers, or $1.37/1K on higher tiers. — [Apify tri_angle/gpt-search](https://apify.com/tri_angle/gpt-search/pricing). The official Perplexity Search Scraper starts at $9.00 per 1K searches. — [Apify](https://apify.com/apify/perplexity-search-scraper). A community Perplexity actor charges from $3.72/1K plus a $0.005 run-start fee. — [Apify automation-lab](https://apify.com/automation-lab/perplexity-search-scraper)

**Official model APIs (grounded / web search)**
- **OpenAI** (fetched 2026-10-13; no effective date on the tool prices): the web search tool costs **$10.00 per 1K calls** on all models, with search content tokens billed at model rates. The legacy "web search preview" for non-reasoning models (gpt-4o, gpt-4.1) costs $25.00/1K with content tokens free. For gpt-4o-mini and gpt-4.1-mini, search content is billed as a fixed block of 8,000 input tokens per call. Example token rates per 1M (input/output): gpt-5-mini $0.25/$2.00; gpt-5.4-mini $0.75/$4.50; gpt-5.5 $5.00/$30.00; gpt-4o-mini $0.15/$0.60. — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- **Perplexity Sonar API** (fetched 2026-10-13; no date on page): request fees per 1K requests at low/medium/high search context:

  | Model | Request fee per 1K (low/med/high) | Tokens per 1M (in/out) |
  |---|---|---|
  | Sonar | $5 / $8 / $12 | $1 / $1 |
  | Sonar Pro | $6 / $10 / $14 | $3 / $15 |
  | Sonar Reasoning Pro | $6 / $10 / $14 | $2 / $8 |

  Sonar Deep Research is billed differently: $2/$8 per 1M tokens, plus citation tokens at $2 per 1M, reasoning tokens at $3 per 1M and search queries at $5 per 1K. The raw Search API costs $5/1K, or $1/1K in "fast" mode. — [Perplexity pricing](https://docs.perplexity.ai/getting-started/pricing)
- **Google Gemini, grounding with Google Search** (page footer "Last updated 2026-10-13"):
  - Gemini 3 and newer: 5,000 free search requests per month, shared across models, then **$14 per 1,000**. The footnote says "A customer-submitted request to Gemini may result in one or more queries to Google Search. You will be charged for each individual search query performed."
  - Gemini 2.5 Pro, Flash and Flash-Lite: 1,500 free requests per day on paid tiers (Flash and Flash-Lite share the allowance), then **$35 per 1,000 grounded prompts**, billed per prompt.
  - Token rates per 1M: Gemini 3 Flash Preview $0.50 in / $3.00 out; Gemini 2.5 Flash $0.30 / $2.50.
  - Grounding with Google Maps costs $14/1K for Gemini 3 and $25/1K for Gemini 2.5.

  — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Google offers no official API for AI Overviews or AI Mode, so tools rely on SERP providers or scrapers (DataForSEO, SerpApi, Bright Data's AI Mode scraper). — [Surfer](https://surferseo.com/blog/llm-scraped-ai-answers-vs-api-results); [Superlines](https://www.superlines.io/articles/api-vs-ui-data-ai-visibility-tools)

### Inferences
- Unit economics for AISEO, using the user's own figures. Bright Data data costs $0.0015 per answer, so a keyword report (3 answers) has about $0.0045 of data cost and a visibility scan (10 answers) about $0.015. That is roughly 7.5% and 17% of the estimated $0.06 and $0.09 totals, so the **Claude analysis step is the dominant cost**: about $0.055 and $0.075. Cutting LLM cost (smaller model for extraction, prompt caching, batching) matters far more than the data price.
- At current list prices, the same answers through official grounded APIs would cost about 3–25x more in request fees alone, before tokens: OpenAI $0.01 per answer plus search tokens; Perplexity Sonar $0.005–$0.012 per answer plus tokens; Gemini 3 $0.014 or more per answer (more if a prompt triggers several searches); Gemini 2.5 $0.035 per answer after the free tier. One caveat: Gemini 2.5's 1,500 free grounded requests per day (about 45,000 per month) could cover a small SaaS's whole volume if API-based Gemini data were acceptable. But it is API-based, not the Gemini app.
- DataForSEO's LLM Scraper ($1.20/1K Standard) is a viable second source for ChatGPT and Gemini UI answers, about 20% cheaper than Bright Data pay-as-you-go. Its Standard queue can take up to 45 minutes, so it suits batch work rather than live reports.
- The 25% Bright Data promotion and the Scale plan (about $1.30/1K) would lower data cost only marginally, since data is not the main cost driver.

### Gaps
- Bright Data publishes no per-engine price list. That the AI scrapers cost the same $1.50/1K as other scrapers is inferred from the docs' "1 credit ≈ 1 ChatGPT record" statement and the general pricing page.
- I could not verify DataForSEO's Google Organic SERP price for AI Overview data, or any extra charge for asynchronous AI Overview loading.
- SerpApi's pricing page does not say whether AI Mode or AI Overview calls count as one search or several.
- No ChatGPT-specific Oxylabs rate was found, and the Apify actor prices may have changed since they were indexed.
- Pricing for cloro, the provider behind Surfer's study, was not checked.
- No official API exists for Microsoft Copilot or for the consumer Gemini app, so I could not compare those.

---

## 3. Market: funding, valuations, consolidation, analyst market sizing, and AI search traffic trends

### Takeaway
Capital in the category is heavily concentrated. Profound raised $96M at $1B (Feb 2026) and then $180M at $1.8B (Sept 2026). Consolidation started in 2025–2026: HubSpot bought XFunnel, Adobe bought Semrush for about $1.9B, and Sitecore bought Scrunch for a reported ~$225M. Gartner published its first Market Guide for "Answer Engine Visibility Tools" in March 2026. Yet AI chatbots still send only about 0.25% of tracked referrals worldwide (Statcounter, Aug 2026), while Google AI Overviews are associated with 35–58% lower position-1 CTR (Ahrefs, correlational). The category's value story is brand influence in zero-click answers, not referral traffic.

### Cited Findings

**Funding rounds and valuations**
- **Profound**:
  - Series A: $20M led by Kleiner Perkins, June 2025 **[pre-2026]**. — [Profound blog](https://www.tryprofound.com/blog/series-a)
  - Series C: $96M at a $1B valuation led by Lightspeed, Feb 24, 2026, bringing total funding to $155M. At the time it had "more than 700 enterprises" and more than 10% of the Fortune 500 as customers. — [SiliconANGLE](https://siliconangle.com/2026/02/24/profound-raises-96m-1b-valuation-ai-discovery-monitoring-platform/)
  - Series D: **$180M at a $1.8B valuation**, co-led by Sequoia and Kleiner Perkins, Sept 15, 2026. Profound claims "over 1,000 enterprise brands", "over one third of the Fortune 100", "16% of the Fortune 500" and a product "built on 2B+ real user prompts". It disclosed no ARR. — [Profound newsroom](https://www.tryprofound.com/newsroom/profound-raises-usd180m-series-d-at-usd1-8b-valuation-to-build-the-ai-platform-for-marketing-teams); [SiliconANGLE](https://siliconangle.com/2026/09/15/profound-raises-180m-to-boost-brands-visibility-in-ai-services/)
  - Total funding was $155M after the Series C ([SiliconANGLE](https://siliconangle.com/2026/02/24/profound-raises-96m-1b-valuation-ai-discovery-monitoring-platform/)). Adding the $180M Series D implies about $335M in total, which matches one blog's "more than $335M" (my arithmetic, not an official figure).
- **Bluefish**: $43M Series B co-led by Threshold Ventures and NEA, announced Apr 14, 2026, for $68M in total. Amex Ventures, TIAA Ventures, Salesforce Ventures and Bloomberg Beta also participated. The company claims about 10% of the Fortune 500 and declined to give a valuation. — [Gunderson](https://www.gunder.com/en/news-insights/client-news/bluefish-raises-43-million-usd-series-b); [Pulse 2.0](https://pulse2.com/bluefish-43-million-series-b-fuels-expansion-of-agentic-marketing-platform/)
- **Peec AI** (Berlin): €18M (about $21M) Series A led by Singular, Nov 18, 2025, for about $29M in total, including a July 2025 seed led by 20VC **[pre-2026]**. — [Tech.eu](https://tech.eu/2025/11/18/peec-ai-raises-21m-series-a-to-help-brands-win-in-ai-search/); [Sifted](https://sifted.eu/articles/peec-ai-raises-21m-series-a). It was reported at $4M ARR within ten months at the time. — [Everything-PR](https://everything-pr.com/berlins-peec-ai-rockets-to-4m-arr-in-ten-months-raises-21m-series-a-to-open-new-york-office/amp). A later claim of about $10M ARR by May 2026 comes from a single source and is unverified. — [yespress](https://yespress.io/peec-ai.md). I found no 2026 round.
- **Scrunch**: $4M seed (Mar 2025) and $15M Series A led by Decibel (July 2025) **[pre-2026]**. — [Axios](https://www.axios.com/pro/retail-deals/2025/07/22/scrunch-15-million-brands-ai-search); [Pulse 2.0](https://pulse2.com/scrunch-ai-15-million-raised-for-improving-ai-search/). Later reports put prior funding at about $26M. — [search summary of Sitecore coverage](https://www.shopifreaks.com/sitecore-buys-ai-visibility-startup-scrunch-in-a-deal-reportedly-worth-up-to-225m-to-help-brands-get-found-and-cited-by-ai-agents/)
- **Evertune**: $15M Series A led by Felicis, Aug 12, 2025 per the company (Tracxn says Jul 18, 2025) **[pre-2026]**. — [Evertune](https://www.evertune.ai/resources/insights-on-ai/evertune-raises-15-million-series-a-to-scale-its-ai-marketing-and-discovery-platform)
- **AthenaHQ**: about $2.2M seed in June 2025 (YC and others), with totals reported between $2.2M and $2.7M **[pre-2026]**. — [Seedtable](https://seedtable.com/companies/athenahq/funding-rounds/seed-2025-06); [Signalbase](https://www.trysignalbase.com/news/funding/athenahq-secures-22m-seed-round-to-pioneer-the-future-of-ai-search-and-generative-marketing-revolution)
- **Gumshoe**: $2M pre-seed led by Pioneer Square Labs (date not confirmed). — [Techleap](https://finder.techleap.nl/news/feed/gumshoe-ai-raises-2m-for-seo-revolution)
- **geoSurge**: $12M seed, reported Jul 3, 2026 by PYMNTS and dated Aug 21, 2026 by SaaSRise. — [PYMNTS](https://www.pymnts.com/news/investment-tracker/2026/geosurge-raises-12-million-to-help-brands-secure-ai-visibility/); [SaaSRise](https://www.saasrise.com/deals/geosurge-raises-12-million-7854e762-a2d2-4d1b-837a-39e257e3563d)
- **Unveilr AI**: pre-seed from AJVC, reported as $1.74M (another source says $2.27M). — [Dealroom](https://dealroom.co/news/158152-unveilr-ai-raises-1-74m-pre-seed-from-ajvc-to-chase-ai-search-visibility/)
- **Goodie**: aggregators list no disclosed external funding as of mid-2026 (unverified). **Otterly.AI**: no funding information found.

**Acquisitions and consolidation**
- **HubSpot → XFunnel** (AEO platform), announced Oct 31, 2025, terms undisclosed **[pre-2026]**. HubSpot has since shipped AEO tools built on it. — [HubSpot](https://www.hubspot.com/company-news/hubspot-to-acquire-xfunnel?BBPage=2); [PPC Land](https://ppc.land/hubspot-acquires-xfunnel-to-strengthen-answer-engine-optimization/)
- **Adobe → Semrush**: announced November 2025 at $12 per share, completed **Apr 28, 2026**. Adobe's 10-Q puts the price at about $1.87B, mostly cash. Adobe positions the deal as expanding its SEO, GEO and "agentic search optimization" offerings. — [Adobe newsroom](https://news.adobe.com/news/2026/04/adobe-completes-semrush-acquisition); [Adobe 10-Q](https://www.sec.gov/Archives/edgar/data/0000796343/000079634326000112/adbe-20260529.htm). Adobe then announced "Adobe Brand Visibility" on Jun 17, 2026; it was previewed, not yet purchasable. — [Digital Applied](https://www.digitalapplied.com/blog/adobe-answer-engine-optimization-agentic-creative-2026)
- **Sitecore → Scrunch**, announced **Jun 3, 2026**. Terms were undisclosed; Bloomberg reportedly valued it at about $225M (secondary report). Scrunch's customers include Lenovo, Skims and Headspace. — [Sitecore press release](https://www.sitecore.com/de-de/company/newsroom/press-releases/2026/06/sitecore-acquires-scrunch-to-help-brands-influence-discovery--and-buying-decisions); [TechTarget](https://www.techtarget.com/enterprise-software/news/366643973/Sitecore-acquires-Scrunch-for-answer-engine-optimization?amp=1); [ShopiFreaks ($225M via Bloomberg)](https://www.shopifreaks.com/sitecore-buys-ai-visibility-startup-scrunch-in-a-deal-reportedly-worth-up-to-225m-to-help-brands-get-found-and-cited-by-ai-agents/)
- Gartner published its first **Market Guide for Answer Engine Visibility Tools** on Mar 9, 2026 (paywalled). Vendors announcing their inclusion as representative vendors include Profound, Semrush, Siteimprove, Evertune and IQRush. — [Gartner abstract](https://www.gartner.com/en/documents/7559273); [Profound](https://tryprofound.com/blog/profound-gartner-market-guide-for-answer-engine-visibility-tools); [Evertune](https://www.evertune.ai/resources/insights-on-ai/evertune-named-a-representative-vendor-in-the-inaugural-2026-gartner-market-guide-for-answer-engine-visibility-tools)

**Analyst market-size estimates (paid research firms, mostly seen through secondary aggregators; directional only)**
- GEO market: about $1.09B in 2026, growing to $17.15B by 2034 at a 40.6% CAGR (Dimension Market Research). ReportCubes gives $1.10B (2026) to $16.33B (2034) at 40.1%. — [ReportCubes](https://www.thereportcubes.com/report-store/generative-engine-optimization-market-global-report); [Superlines compilation](https://www.superlines.io/articles/geo-market-size-statistics)
- GEO *platform* market: $2.70B (2026) to $26.85B (2033), with a stated 13.6% CAGR. GEO *services*: $1.25B (2026) to $13B (2033), with a stated 14% CAGR. **Both stated CAGRs are internally inconsistent**: the endpoints imply about 39–40% CAGR. Treat these figures with caution. — [GIIKorea platform report listing](https://www.giikorea.co.kr/report/coh2126752-generative-engine-optimization-platform-market-by.html); [GIIKorea services listing](https://www.giikorea.co.kr/report/coh2126765-generative-engine-optimization-services-market-by.html)
- GEO services: $1.23B (2025) to $22B (2034) at a 48.7% CAGR (Intel Market Research, via a repost). — [syg.ma](https://syg.ma/@shiv/generative-engine-optimization-geo-services-market-to-reach-22-usd-billion-by-2034)
- Older baseline: $886M (2024) to $7.318B (2031) at a 34% CAGR (Valuates/QYResearch) **[pre-2026, possibly outdated]**. — [Superlines compilation](https://www.superlines.io/articles/geo-market-size-statistics)

**AI search traffic trends**
- **Statcounter** (worldwide referrals tracked from search, social and AI chatbots):
  - AI chatbots were **0.25%** in August 2026, vs 0.23% in August 2025. They peaked at 0.43% in April–May 2026. Search engines were 91.66%.
  - AI referral shares, Aug 2025 → Aug 2026: ChatGPT 80.9% → 79.4%; **Gemini 2.2% → 10.9%**; **Perplexity 8.1% → 4.3%** (it was 12.1% in Apr 2025); Copilot 5.2% → 2.8%; Claude 0.9% → 2.6%.
  - US AI chatbot referral share was 0.16% in Aug 2026.

  — [upgrowth summary of Statcounter](https://upgrowth.in/ai-traffic-share-report-2026/)
- **Similarweb** (share of visits to gen-AI websites, not referrals): ChatGPT fell from 73.3% twelve months earlier to 56.7% six months earlier, while Gemini rose from 12.9% to 25.4% (August 2026 update). — [Similarweb on X](https://x.com/Similarweb/status/2096878021378466096). Gen-AI platforms got about 9.5B visits per month worldwide in 2026, up about 70% year over year. Fewer than 7 in 100 ChatGPT prompts included a source citation as of May 2026 (Similarweb, via a secondary source). — [upgrowth](https://upgrowth.in/ai-traffic-share-report-2026/)
- Earlier site-level data: AI was 0.17% of the average site's visitors across 3,000 sites, and 63% of sites got some AI traffic (Ahrefs, Feb 2025) **[pre-2026]**. — [upgrowth](https://upgrowth.in/ai-traffic-share-report-2026/). Conductor measured 1.08% of total traffic across 13,770 domains (May–Sep 2025), reaching 2.80% in IT **[pre-2026]**. — [Scalevise summary](https://scalevise.com/resources/ai-referral-traffic-1-08-percent-measurement/)
- In a B2B referral sample (Mar–Apr 2026), ChatGPT had 62.6%, Claude 18.5%, Gemini 10.6% and Perplexity 7.3%. — [Goodie](https://higoodie.com/blog/ai-search-traffic-report-2026/)

**Google AI Overviews / AI Mode impact on clicks**
- **Ahrefs**: AI Overviews correlated with a **34.5%** lower CTR for position 1 (March 2024 vs March 2025, 300K keywords) **[pre-2026]**. — [Ahrefs](https://ahrefs.com/blog/ai-overviews-reduce-clicks/). The 2026 re-run (December 2023 vs December 2025) found **58%** lower CTR, −50.8% at position 2 and −19.4% at position 10; it is a correlation. — [Business Wire, May 19, 2026](https://www.businesswire.com/news/home/20260518322756/en/); [SEO Worth](https://seoworth.it.com/news/ahrefs-ai-overviews-ctr-study/)
- **Seer Interactive** 2026 update (Apr 24, 2026; 53 brands, 5.47M queries, 2.43B organic impressions):
  - Organic CTR on queries with an AI Overview: 3.19% (Jan 2025) → 1.31% (Dec 2025) → 2.36% (Feb 2026).
  - Organic CTR on queries without one: 2.75% → 3.16% → 3.82%.
  - In December 2025, brands cited in the AIO got 0.95% organic CTR vs 0.55% for brands not cited.
  - Seer calls the data "directional" and correlational.

  — [Seer Interactive](https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update)
- **Pew Research** (900 US adults, March 2025 browsing, published Jul 22, 2025) **[pre-2026]**:
  - 18% of Google searches showed an AI summary.
  - Users clicked a traditional result on 8% of visits with a summary vs 15% without one.
  - Users clicked a link inside the summary on 1% of visits.
  - 26% of sessions ended on pages with a summary vs 16% without.

  — [Pew](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/)
- First-party measurement is emerging. Google launched Search Console "Search Generative AI performance reports" (covering AI Overviews and AI Mode) on Jun 3, 2026, rolling out gradually; they show impressions but no clicks, CTR or queries. — [Google Search Central blog](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports). Bing Webmaster Tools has an "AI Performance" report in public preview. — [Fenn](https://fenn.sh/blog/ai-visibility-tool-pricing)

### Inferences
- The market splits into enterprise platforms (Profound, Bluefish, Evertune, Adobe/Semrush, Sitecore/Scrunch, BrightEdge, Conductor), built on suites and incumbents, and self-serve tools (Otterly, Peec, Writesonic, SE Visible and others). The acquirers are content and DXP platforms (Adobe, Sitecore, HubSpot), which suggests AI visibility is becoming a feature of marketing suites. Standalone small players will increasingly compete on price and niche rather than breadth.
- Valuations are running far ahead of the measurable traffic opportunity: Profound at $1.8B against AI chatbots' 0.25% referral share. The demand driver is fear of losing zero-click visibility (AI Overviews are associated with 35–58% lower top-result CTR) rather than AI referral volume. For AISEO's positioning, that argues for leading with "are you mentioned and cited" (influence) rather than traffic.
- Perplexity's referral share has roughly halved year over year (8.1% → 4.3%) while Gemini's grew about 5x (2.2% → 10.9%). AISEO uses Perplexity as its only engine for keyword reports, which may be weighting a shrinking surface. Gemini or Google AI Mode is gaining relevance.
- Google's free Search Console AI reports (impressions for AIO and AI Mode) put pressure on paid tools for the Google surfaces. Tools that only report Google-AI presence may face substitution.

### Gaps
- I found no reliable ARR figures for any vendor except Peec (single-source, unverified). Profound disclosed none.
- I found no 2026 rounds for Peec, Evertune, AthenaHQ, Goodie or Otterly, and no confirmed Profound Series B details in this research.
- The original Bloomberg report on the Scrunch price was not accessed; the $225M figure is secondhand.
- The analyst market reports are paywalled; figures come from listings and aggregators, and the definitions (platform vs services) differ.
- I couldn't attribute some 2026 traffic-share figures (e.g., SE Ranking's 0.32% of traffic and Ahrefs' 0.35% for July 2026) to a primary URL, so I omitted them.
- I found no Google AI Mode–specific CTR study from 2026.

---

## 4. Pricing model trends and typical price per tracked prompt per month

### Takeaway
Self-serve pricing converged on **per-prompt bundles with daily refresh**, plus **per-engine add-ons**. Claude is often priced at a premium, and some vendors bill in credits per answer. Seats are increasingly unlimited, and enterprise plans are custom-quoted. Across published entry tiers checked Oct 4–9, 2026, the price per tracked prompt per month is about **$0.50 at the low end, a median of about $1.75–$1.90, and about $4 at the high end**. Per prompt per engine per month, that is about $0.26 / $0.50 / $0.99.

### Cited Findings
- **Fenn comparison** (vendor pages read Oct 4, 2026; article Oct 9, 2026), entry plans:

  | Tool | Plan | Price/month | Prompts | Engines | $/prompt/month |
  |---|---|---|---|---|---|
  | Otterly Lite | Lite | $29 ($25 annual) | 15 | ChatGPT, AIO, Perplexity, Copilot | $1.93 |
  | Peec AI | Starter | $95 ($80 annual) | 50 | 3 of 6 models | $1.90 |
  | Semrush AI Visibility Toolkit | Base | $99 per domain (annual) | 25 | 4 | $3.96 |
  | SE Ranking | Core, incl. full SEO suite | $129 | 100 | 5 | $1.29 |
  | Scrunch | Core | $250 | 125 | 4 | $2.00 |
  | AthenaHQ | Starter | $295 | credits | 11 | 3,600 credits, 1 per response |
  | Ahrefs Brand Radar | AI | from $199 | index plus custom packs ($50–$250/mo) | 6 | n/a |
  | Profound | Enterprise | custom | custom | up to 9 | n/a |

  Fenn's page gives no summary statistics. Computed from its figures for the five fixed-prompt plans: per prompt per month low $1.29, median $1.93, high $3.96; per prompt per assistant per month low $0.26, median $0.50, high $0.99. — [Fenn](https://fenn.sh/blog/ai-visibility-tool-pricing)
- **Agenzy comparison** (prices checked Sep 8, 2026). It gives tier ladders and a "cost per prompt-engine-day", which is effectively price per answer at one run per day:

  | Vendor | Plan | Price/month | Prompts × engines | Per prompt-engine-day | Notes |
  |---|---|---|---|---|---|
  | Profound | Starter | $99, billed yearly ($1,188) | 50 × 1 (ChatGPT only) | $0.0660 | |
  | Profound | Growth | $399, billed yearly ($4,788) | 100 × 3 (ChatGPT, Perplexity, AIO) | $0.0443 | |
  | Profound | Enterprise | unpublished | up to 9 engines | n/a | |
  | Peec AI | Starter | $95 | 50 × 3 | $0.0211 | 4th engine +$35/mo |
  | Peec AI | Pro | $245 | 150 × 3 | $0.0181 | |
  | Peec AI | Advanced | $495 | 350 × 3 | $0.0157 | |
  | Peec AI | Agency tiers | $245 / $495 / $795 | 10K / 25K / 65K shared credits | $0.0245 / $0.0198 / $0.0122 | |
  | Otterly | Lite | $29 | 15 × 4 | $0.0161 | daily, unlimited users |
  | Otterly | Standard | $189 | 100 × 4 | $0.0158 | |
  | Otterly | Premium | $489 | 400 × 4 | $0.0102 | |

  — [Agenzy](https://www.agenzy.lt/blog/best-ai-visibility-tools-2026)
- **Searcherries comparison** (prices as of Oct 9, 2026), per prompt per month:
  - Searcherries $1.30 ($13 for 10 units)
  - Writesonic $1.58 ($79 for 50)
  - Nightwatch €1.58 (€79 for 50 prompts and 1,500 AI answers)
  - Surfer €1.64 (€82 annual for 50 daily prompts)
  - Peec $1.90; Advanced plan $495 for 350 prompts
  - SE Visible **$0.50** ($99 for 200 prompts, unlimited seats)
  - Semrush $3.96; extra users from $45
  - Otterly $1.93
  - Custom quotes: Profound, BrightEdge and Adobe Brand Visibility
  - Per-location pricing: BrightLocal at $39 per location

  — [Searcherries](https://searcherries.com/ai-visibility-tool-pricing)
- **Per-engine add-ons and premium engines**:
  - Otterly adds Gemini and AI Mode at $9 each and Claude at $29. — [Searcherries](https://searcherries.com/ai-visibility-tool-pricing)
  - Peec charges for an extra model on Starter: $35/month ([Agenzy, Sep 8, 2026](https://www.agenzy.lt/blog/best-ai-visibility-tools-2026)), or $30/month billed annually ([Fenn](https://fenn.sh/blog/ai-visibility-tool-pricing)). Grok, Qwen, Claude, DeepSeek and Mistral are paid upgrades ([Agenzy](https://www.agenzy.lt/blog/best-ai-visibility-tools-2026)).
  - Keyword.com charges 3 credits for a Claude prompt vs 0.25 for most engines, and Ahrefs Brand Radar charges 8 checks per Claude update. — [Fenn](https://fenn.sh/blog/ai-visibility-tool-pricing)
- **Credits per answer**: AthenaHQ (1 credit = 1 response; 3,600 for $295), Nightwatch (1,500 AI answers), Keyword.com (credits weighted by engine), AgencyAnalytics (250 credits for $25 on top of a core plan). — [Fenn](https://fenn.sh/blog/ai-visibility-tool-pricing); [Searcherries](https://searcherries.com/ai-visibility-tool-pricing)
- **Profound self-serve tiers are inconsistent across sources.** On Sep 8, 2026 they were Starter at $99/month and Growth at $399/month, both billed yearly. — [Agenzy](https://www.agenzy.lt/blog/best-ai-visibility-tools-2026). But Profound's pricing page on 2026-10-13 showed only a free 7-day Trial and custom Enterprise, plus a self-serve "Agency Growth" plan in the FAQ with 400 credits per month per client workspace and no price shown. — [Profound pricing](https://www.tryprofound.com/pricing). The self-serve tiers may have been withdrawn after the Series D, or the fetch may have missed them; this is unresolved.
- **Free tiers and alternatives**: AthenaHQ Essential (300 credits), Profound's 7-day trial, Google Search Console's generative AI report, and Bing's AI Performance report. — [Fenn](https://fenn.sh/blog/ai-visibility-tool-pricing). One guide notes that for under about 20 queries you can track manually in a spreadsheet. — [cloro](https://cloro.dev/blog/llm-visibility-tracking-tools/)

### Inferences
- Low, median and high price per tracked prompt per month, combining the October 2026 roundups (USD entry tiers with fixed prompt counts): SE Visible $0.50, SE Ranking $1.29, Searcherries $1.30, Writesonic $1.58, Peec $1.90, Otterly $1.93, Scrunch $2.00, Semrush $3.96. That gives **low $0.50, median ~$1.74, high $3.96**. Adding Profound's Starter ($1.98, as of September 2026) moves the median to $1.90. The euro-priced tools (Nightwatch €1.58, Surfer €1.64) sit near the median. Upper tiers bring the per-prompt price down: Otterly Premium is about $1.22 per prompt ($489 / 400), and Peec Advanced about $1.41 ($495 / 350).
- Across the published ladders, retail price per answer (per prompt-engine-day) runs from about **$0.010** (Otterly Premium) to **$0.066** (Profound Starter), with most self-serve plans at $0.015–$0.025 ([Agenzy](https://www.agenzy.lt/blog/best-ai-visibility-tools-2026)).
- Implied retail price per answer, assuming daily refresh across all included engines over 30 days (my calculation; vendors may sample differently):

  | Tool | Answers per month | Price | Per answer |
  |---|---|---|---|
  | Otterly Lite | 15 × 4 × 30 = 1,800 | $29 | ~$0.016 |
  | Peec Starter | 50 × 3 × 30 = 4,500 | $95 | ~$0.021 |
  | Semrush | 25 × 4 × 30 = 3,000 | $99 | ~$0.033 |
  | Nightwatch | 1,500 | €79 | ~€0.053 |
  | AthenaHQ | 3,600 | $295 | ~$0.082 |

  At $0.0013–$0.0015 per answer for UI data, the raw-data cost of goods is only about 5–10% of the cheapest tools' retail price per answer. Margins depend on how answers are analyzed: cheap brand extraction vs LLM analysis.
- AISEO's estimated fully loaded cost per answer is about $0.02 per answer for a keyword report ($0.06 / 3) and about $0.009 for a visibility scan ($0.09 / 10). That is in the same range as competitors' *retail* price per answer at the low end. Price-led subscription tracking (daily × engines × prompts) is therefore hard for AISEO without a cheaper analysis path. On-demand, per-report pricing with LLM-written analysis is a differentiated position.
- Claude carries roughly a 3–12x price or credit premium at several vendors: Otterly $29 vs $9 for other add-ons, Keyword.com 3 vs 0.25 credits, Ahrefs 8 checks per update. Bright Data has no Claude UI scraper. That is consistent with Claude being collected via API, which is costlier per answer. The available sources don't confirm this.

### Gaps
- No source surveyed enterprise contract values (Profound, Bluefish, Evertune, BrightEdge, Adobe), so the "high end" above covers self-serve plans only.
- I could not reconcile Profound's 2026 self-serve tiers.
- The roundups disagree on annual vs monthly display and on € vs $ pricing; I did no currency conversion.
- The comparisons are third-party and some are written by vendors (Fenn and Searcherries sell trackers themselves).

---

## 5. Critiques and skepticism of the category

### Takeaway
The main critiques are these. LLM answers are probabilistic, so ranks and single snapshots are close to meaningless; "any tool that gives a 'ranking position in AI' is full of baloney" (Fishkin). Share-of-voice numbers hide an arbitrary prompt denominator. Sample sizes are far too small for the precision dashboards imply. Most tools measure logged-out or API answers that differ from what real, personalized users see. And most of the evidence, including the critiques, comes from vendors. A competing critique questions the legality and stability of scraping.

### Cited Findings
- Rand Fishkin: "any tool that gives a 'ranking position in AI' is full of baloney". He also said: "If you ask an AI tool for brand/product recommendations a hundred times nearly every response will be unique." He advises measuring visibility percentage across many runs instead. The study is not peer reviewed, its co-author sells tracking, and it left open how many runs are needed and whether API results match manual prompts. — [SEJ, Jan 30, 2026](https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/566242); coverage also in [WARC](https://www.warc.com/content/feed/llms-produce-random-results-when-listing-brand-recommendations/en-GB/11352)
- Search Engine Land's "The problem with AI share of voice" argues AI share of voice is "equally flawed" as the metric it replaced. Vendors report a single percentage without disclosing the prompt base, and the prompt universe is effectively infinite, so many platforms "extrapolate from a small subset of prompts" (from a search summary; the page returned 403). — [Search Engine Land](https://searchengineland.com/ai-share-of-voice-metrics-that-matter-more-479611)
- Metric definitions vary. Some tools compute share of voice as mentions divided by competitor mentions; others use the share of answers that mention the brand. — [cloro](https://cloro.dev/blog/llm-visibility-tracking-tools/)
- ThriveStack (a vendor) says most dashboards report rank and skip confidence intervals, and that no vendor runs the roughly 2,318 runs per prompt needed to separate 1% from 2%. It proposes a reporting standard of estimate, interval, effective sample, design, engine and window. — [ThriveStack](https://www.thrivestack.ai/research/ai-visibility-tracking-non-determinism)
- St. Gallen researchers say one-off observations are unreliable and visibility should be measured repeatedly, as a distribution. — [arXiv 2604.07585](https://arxiv.org/abs/2604.07585)
- API-based tools can record hallucinations as data, such as a fabricated company ranked first, and they miss new entrants that appear only through retrieval. — [Promptwatch](https://promptwatch.com/blog/ui-vs-api-for-ai-search-visibility); [Paprik](https://paprik.ai/blog/accurate-api-based-ai-visibility-tracking-chatgpt-ui)
- Scraping is attacked from the other side. Conductor says it "likely violates" platform terms, breaks on UI changes, and captures logged-out sessions that may run older models; it offers no data for these claims. — [Conductor](https://conductor.com/academy/scraping-vs-api)
- Personalization undermines both methods. Logged-in history changed brand sets by 16 points on ChatGPT and 33 points on Gemini in one (unverified) study. — [EIN Presswire](https://www.einnews.com/pr_news/944542004/new-study-finds-ai-personalization-can-change-which-brands-chatgpt-and-gemini-recommend)
- Funding hype vs disclosure: Profound's Series D announcement disclosed no ARR, retention or gross margin, and its "16% of the Fortune 500" claim is unaudited. — [Lapaas Voice](https://lapaasvoice.com/profound-funding-ai-search-visibility)
- Outcome claims are vendor self-reports. Scrunch reports a "40% increase in referral traffic" and "up to 4x" visibility for customers. — [Pulse 2.0](https://pulse2.com/scrunch-ai-15-million-raised-for-improving-ai-search/)
- Correlation vs causation in the traffic studies: Ahrefs and Seer both describe their CTR findings as correlational, and Seer notes that higher-authority brands are also more likely to be cited. — [Seer](https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update); [Ahrefs via SEO Worth](https://seoworth.it.com/news/ahrefs-ai-overviews-ctr-study/)

### Inferences
- The critiques point AISEO toward a credible, defensible methodology and away from feature parity:
  - report mention rates with sample sizes and intervals, not ranks;
  - disclose engine, date, country and model per answer (Bright Data returns `model` and `web_search_triggered`);
  - label results as a non-personalized baseline;
  - avoid "zero visibility" verdicts from 3–10 runs.
  Few competitors appear to publish this kind of "show your math" detail, so it could differentiate AISEO.
- Since both camps (UI-scraping and API) publish self-serving studies, AISEO can cite the convergent finding: low overlap, especially for ChatGPT. It should not cite any single vendor's number as definitive.

### Gaps
- I found no independent academic audit of commercial AI visibility tools' accuracy, and no published validation of "prompt volume" datasets (e.g., Profound's "2B+ real user prompts"). Their provenance (panels, extensions, consent) is undisclosed in the sources reviewed.
- I couldn't fetch the Search Engine Land critique (403); its content comes from a search summary.
- I found no legal analysis or court decision specific to scraping ChatGPT, Gemini or Perplexity consumer UIs. The terms-of-service risk is asserted by vendors, not documented.
