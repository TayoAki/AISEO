# AI keyword and prompt research tools: segment map (as of 2026-10-13)

Scope: products that help marketers find what people ask AI assistants, estimate prompt demand, and see which sources and brands AI answers cite for a keyword or topic, as opposed to classic search-volume tools. Brand-visibility trackers are included only for their prompt/keyword research features.

How to read these notes:
- **"accessed 2026-10-13"** means I fetched that vendor page on that date.
- **[snippet]** marks a finding that came from a search-engine result summary, not a page I fetched. These are plausible but deserve a second check before publication.
- **Possibly outdated** marks data dated before 2026.
- Reddit was not reachable with my tools (the search tool rejects reddit.com), so practitioner sentiment comes from newsletters, agency blogs and trade press.
- The AISEO reference point comes from the assignment brief. AISEO's keyword report collects live Perplexity answers for a keyword (3 prompts per keyword, 20 markets). Claude then analyzes most-cited domains, source mix, competing brands, prompts to target, keyword clusters and an opportunity score. Pro is $29/month for 100 reports plus 25 visibility scans.

## 1. Which products offer prompt research or AI keyword research as of October 2026?

### Takeaway
By October 2026, prompt research is a standard module in two places:
- **The big SEO suites:** Semrush Prompt Research and Ahrefs Brand Radar's AI index.
- **The leading AI-visibility platforms:** Profound Prompt Volumes and Prompt Research Reports, Peec AI "Discover", Similarweb Prompt Analysis, Writesonic Prompt Explorer, AthenaHQ, Scrunch, DemandSphere and Promptwatch.

DataForSEO sells the raw inputs by API: AI search volume, LLM mentions and citations, and answer scraping. The classic question tools have mostly not added AI demand data. AlsoAsked and Keywords Everywhere have not; AnswerThePublic is the exception with an "AI Prompts" view. Google and Bing now give site owners first-party AI data, but only Bing exposes query-like data ("grounding queries"). Google shows impressions only.

### Cited Findings

#### SEO suites
- **Semrush Prompt Research** sits inside the AI Visibility Toolkit.
  - A seed phrase returns "Related Topics AI Volume", topics and prompts per topic, an intent breakdown (informational, navigational, commercial, transactional, task-based), and the number of unique brands mentioned and source domains, with the top three of each shown.
  - The Prompts tab shows each prompt with its AI response, relevance, number of brands mentioned and sources cited.
  - Source: [Semrush KB 1597](https://www.semrush.com/kb/1597-prompt-research-report), accessed 2026-10-13.
- **Semrush coverage figures conflict:**
  - KB 1597 lists platforms as Google AI Overviews, AI Mode, Gemini and ChatGPT, "with more platforms coming soon". It describes a "prompt database of 317M+ AI queries" "refreshed daily on a rolling basis" ([Semrush KB 1597](https://www.semrush.com/kb/1597-prompt-research-report)).
  - The marketing page adds Perplexity and claims "more than 40 global markets" and 42 geographic AI prompt databases ([Semrush Prompt Research page](https://www.semrush.com/features/prompt-research/), accessed 2026-10-13).
  - KB 1607 says 117 regional databases ([Semrush KB 1607](https://www.semrush.com/kb/1607-semrush-ai-visibility-data)).
  - These sources conflict, so platform and market counts are unsettled.
- **Semrush AI Visibility Index:** Semrush published an expanded 2026 index analyzing 126 million US AI search prompts (January to April 2026) across four platforms, up from an initial 2,500 prompts ([BusinessWire, 2026-06-26](https://www.businesswire.com/news/home/20260626995770/en/Semrush-Releases-Expanded-2026-AI-Visibility-Index-Analyzing-126-Million-AI-Search-Prompts)).
- **Ahrefs Brand Radar:**
  - Index prompts are "modeled from real user searches in Ahrefs' keyword database". Users can also add custom prompts or "Use AI to generate relevant prompts from competitor comparisons, pricing data, and other signals Ahrefs collects" ([Ahrefs Brand Radar](https://ahrefs.com/brand-radar), accessed 2026-10-13).
  - The page claims "475M+ Total monthly prompts": AI Overviews 269,066,840; AI Mode 91,002,465; Copilot 29,198,545; Gemini 29,091,378; Perplexity 29,064,822; ChatGPT 28,522,328 ([Ahrefs Brand Radar](https://ahrefs.com/brand-radar)).
  - Third-party 2026 reviews quote other totals (476M, 414M, 405M, 271M, 260M), so the figure changes over time ([Analyze AI review](https://www.tryanalyze.ai/blog/ahrefs-brand-radar-review), [AEO Labs review](https://www.aeolabs.ai/blog/ahrefs-brand-radar-review)) [snippet].
- **Ahrefs Brand Radar research features** include "Cited pages", "AI Sources" (offsite sources across YouTube, TikTok and Reddit), competitor benchmarking, and "Fanout queries" to "find content gaps" ([Ahrefs Brand Radar](https://ahrefs.com/brand-radar)).

#### AI-visibility platforms with prompt research modules
- **Profound Prompt Volumes:**
  - It is "built by licensing AI answer engine conversations, cleaning the data, applying probabilistic modeling". Engines are ChatGPT, Gemini, Claude and Perplexity.
  - Coverage is "strongest in the US, UK, and select European markets". Norway has ChatGPT only.
  - US history starts January 2025; other regions start July 2025.
  - Source: [Profound help center](https://help.tryprofound.com/articles/4288109168-prompt-volumes), accessed 2026-10-13. The page itself says it "may be outdated" and points to docs.tryprofound.com.
- **Profound marketing claims** include 400M+ conversations growing by 150M per month and a weekly refresh ([Profound Prompt Volumes feature page](https://www.tryprofound.com/features/prompt-volumes)) [snippet].
- **Engine lists conflict:** a third-party guide names ChatGPT, Perplexity and Copilot ([Capconvert](https://www.capconvert.com/learn/blog/prompt-volumes-how-to-discover-what-your-customers-are-actually-asking-llms)) [snippet].
- **Profound Prompt Research Reports** launched 2026-06-25 ([Profound blog](https://www.tryprofound.com/blog/introducing-prompt-research-reports-in-profound)):
  - They use "Profound's proprietary dataset of 1.5+ billion real user prompts". They pull "real user conversations about that topic over the last 6 months" from ChatGPT, Gemini, Perplexity and Claude.
  - Output: inputs, an intent split (informational, commercial, transactional), and topics ranked by share of volume, each with tracking recommendations and "a coverage score".
  - Availability: "currently available for all Enterprise customers". The post does not mention cited-source or competitor analysis.
- **"Conversation Explorer":** a blog by a Profound employee describes a way to search the full conversations behind the volume numbers ([Nick Lafferty](https://nicklafferty.com/blog/prompt-volume-aeo-explained/)) [snippet]. The name does not appear in the Profound help-center article I fetched.
- **Peec AI "Discover"** lists "Prompt suggestions" ("Prompts worth adding, drawn from your brand context and coverage gaps") and "Prompt volume" as a "relative demand" score from 1 to 5 ([Peec pricing page](https://peec.ai/pricing), accessed 2026-10-13).
- **Similarweb Prompt Analysis** is part of AI Brand Visibility ([Similarweb prompt research guide](https://www.similarweb.com/blog/marketing/geo/prompt-research/), [Similarweb prompt tracking](https://aisearch.similarweb.com/blog/prompt-tracking/), [Similarweb Prompt Analysis page](https://similarweb.com/corp/search/gen-ai-intelligence/ai-brand-visibility/prompt-analysis)) [snippet]:
  - It covers ChatGPT, Perplexity, Gemini and Google AI Mode.
  - Similarweb says it uses "real user prompts rather than synthetic keyword templates".
  - Results are grouped by topic and show brand mention, competitor order, sentiment and cited domains.
  - Plan tiers list 150 tracked prompts and 3 or 6 months of history.
- **Writesonic AI Search Volume & Prompt Explorer** was published 2025-08-07 and updated 2026-07-28 ([Writesonic blog](https://writesonic.com/blog/ai-search-volume-prompt-explorer)).
  - It shows monthly volume, a 12-month trend, region-wise demand, top brands in AI answers, related prompts in the same intent cluster, and a confidence indicator.
  - It covers ChatGPT, Claude and Perplexity, plus "other major AI platforms".
- **AthenaHQ** sells a "Prompt Volume" product built on its Query Volume Estimation Model (QVEM) ([AthenaHQ QVEM](https://athenahq.ai/articles/generative-ai-search-query-volume-estimation-model), [AthenaHQ Prompt Volume](https://athenahq.ai/prompt-volume)) [snippet].
- **Scrunch "AI Search Trends"** estimates volume at the topic level only, by design ([Scrunch FAQ](https://scrunch.com/faqs/how-does-scrunch-estimate-ai-search-volume-metrics), accessed 2026-10-13).
- **DemandSphere Prompt Volume** (DemandMetrics GenAI) estimates volume across nine AI engines plus Google, weighted by engine market share ([DemandSphere](https://www.demandsphere.com/platform/demandmetrics-genai/prompt-volume/)) [snippet].
- **Promptwatch** reports "Prompt Volume Estimation" as a modeled figure, kept separate from measured AI answers ([Promptwatch glossary](https://promptwatch.com/glossary/prompt-volume)) [snippet].

#### Classic question and keyword tools
- **AnswerThePublic** relaunched in 2026 as an "AI content engine". Its AI Prompts table adds Intent, Sentiment and Brands signals per prompt ([Neil Patel guide, about Aug 2026](https://neilpatel.com/blog/how-to-use-new-answerthepublic-guide/)) [snippet]. Neil Patel's company owns AnswerThePublic, and the page returned 403 to my fetch.
  - A 2026 review says paid tiers meter searches, AI prompts, AI responses, Content Studio credits, projects and users separately ([DIY AI review](https://diyai.io/ai-tools/seo/reviews/answerthepublic-review/)) [snippet].
- **AlsoAsked** (People Also Ask data): the pricing page's only AI-related feature is an "MCP server" to "connect AlsoAsked to my AI assistant". It offers no LLM prompt or AI Mode data ([AlsoAsked pricing](https://alsoasked.com/pricing), accessed 2026-10-13).
- **Keywords Everywhere:** the pricing page lists "Premium ChatGPT Prompts" (prompt templates) on Silver and above.
  - Navigation links to "AI Overview Metrics", "AI Brand Tracker" and "AI SEO Tool" are not described on the page.
  - No AI search volume or prompt research is listed as a plan feature ([Keywords Everywhere pricing](https://keywordseverywhere.com/pricing.html), accessed 2026-10-13).

#### Data APIs
- **DataForSEO AI Optimization API** has four parts ([DataForSEO AI Optimization API](https://dataforseo.com/apis/ai-optimization-api), accessed 2026-10-13):
  - **AI Keyword Data:** AI search volume, last month plus a 12-month trend.
  - **LLM Mentions:** brand and domain mentions and citations; the FAQ says citation data comes from ChatGPT responses and Google AIO.
  - **LLM Responses:** answers "through official LLM APIs".
  - **LLM Scraper:** scraped ChatGPT and Gemini interface answers.
- DataForSEO also publishes a guide to "Finding and Analyzing the Sources LLMs Cite" ([DataForSEO help center](https://dataforseo.com/help-center/finding-analyzing-sources-llms-cite-with-ai-optimization-api)).

#### First-party engine data
- **Google Search Console generative AI reports** ([Search Engine Journal, 2026-08-31](https://www.searchenginejournal.com/google-search-console-ai-reports-rolled-out-worldwide/587836/), accessed 2026-10-13):
  - Announced 2026-06-03 with a UK test. Google says: "As of August 31, 2026, we've rolled out these insights to all websites worldwide."
  - The reports show impressions from AI Overviews, AI Mode and Discover generative AI features by page, country and date, plus device in the Search report. They have no click data.
  - The same launch added a "Search generative AI control" that lets a site opt out of these surfaces.
- **Google gaps per third-party coverage:** there are no query, click or CTR details, and AI Mode cannot be separated from AI Overviews ([Crawlraven](https://crawlraven.com/blog/gsc-ai-performance-reports), [CMSWire](https://www.cmswire.com/digital-experience/google-adds-ai-visibility-reports-to-search-console/)) [snippet].
- **Bing Webmaster Tools "AI Performance":**
  - Public preview on 2026-02-10, showing citations across Copilot, Bing AI summaries and select partners ([Search Engine Journal](https://www.searchenginejournal.com/bing-webmaster-tools-adds-ai-citation-performance-data/566874/)) [snippet].
  - March 2026: grounding queries mapped to cited pages. Grounding queries are the phrases the AI used to retrieve content ([Otterly](https://otterly.ai/blog/bing-webmaster-tools-ai-performance-report/), [Edward Sturm](https://edwardsturm.com/articles/bing-webmaster-tools-ai-performance-report-grounding-queries-get-more-llm-citations/)) [snippet].
  - 2026-06-16: Microsoft added Intents, Topics, Citation Share and Compare. It describes Citation Share as "an observational metric – not a ranking system or a competitive scoreboard" ([Bing blog](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/), accessed 2026-10-13).

#### Free fan-out simulators
- **Qforia** (iPullRank, Mike King) is free but needs a paid Gemini API key. It predicts the 20 to 30 sub-queries Google AI Mode may "fan out" to, with a query-type label. These are model predictions, not Google data ([iPullRank](https://ipullrank.com/query-fanout-how-to), [Search Engine Land fan-out tools guide](https://searchengineland.com/guide/query-fan-out-tools-software)) [snippet; sources 3 to 16 months old, possibly outdated].
- DEJAN offers a free fan-out tool at dejan.ai/tools/fanout/ [snippet, same sources].

### Inferences
- Prompt research is now a checkbox feature in every major suite and AI-visibility platform. "Shows prompts to target" alone will not differentiate AISEO.
- Incumbent datasets lean toward Google surfaces (AI Overviews, AI Mode, Gemini) plus ChatGPT. Perplexity is about 6% of Ahrefs' claimed index (29M of 475M) and is absent from Semrush's own KB platform list. A Perplexity-first, live-answer report is therefore a niche, not the mainstream offer.
- AlsoAsked and Keywords Everywhere have not moved into AI demand data. Below about $95/month there is little AI prompt research with citation analysis, and that is where AISEO's $29 plan sits. AnswerThePublic's $20 Starter is the closest low-price, AI-flavored question tool; its AI-prompt limits are unverified.
- Bing's grounding queries are the first first-party "AI keyword" data, though only for the user's own site.

### Gaps
- I could not resolve whether Semrush Prompt Research includes Perplexity (KB versus marketing page) or its market count (42 versus 117 databases).
- I found no primary description of AnswerThePublic's AI Prompts data source or per-plan AI-prompt limits.
- I could not confirm "Conversation Explorer" as Profound's current product name.
- I found no Perplexity-dedicated prompt research tool. One blog notes Perplexity offers no search volume, keyword difficulty or backlink data ([Ranking by SEO](https://www.rankingbyseo.com/blog/perplexity-keyword-research/)) [snippet].
- I did not research whether Google Keyword Planner or Google Ads expose AI Mode query data. I found no evidence that Google publishes AI Mode query volumes.

## 2. How do tools estimate prompt or AI search volume, and how reliable do independent experts consider these estimates?

### Takeaway
No AI provider publishes query counts, so every prompt-volume figure is modeled. The modeling starts from one of four inputs:
- **Licensed consumer panels of AI conversations:** Profound, Similarweb, Scrunch, and part of Writesonic.
- **Clickstream panels:** Semrush.
- **Search-keyword or People Also Ask data:** Ahrefs, DataForSEO, and the other part of Writesonic.
- **Undisclosed ML models:** AthenaHQ.

Several vendors avoid prompt-level numbers. Scrunch and Semrush report topic-level volume only, and Peec uses a 1 to 5 relative score. Independent commentary and even vendor documentation call the figures directional. Skeptics call them "pseudo-accuracy". I found no independent validation of any vendor's numbers. SparkToro's January 2026 study shows the AI answers themselves vary too much for single-run measurement.

### Cited Findings

#### Vendor methods
- **Profound** licenses AI-engine conversations, then cleans them and applies "probabilistic modeling" ([Profound help center](https://help.tryprofound.com/articles/4288109168-prompt-volumes)).
  - A Profound employee says the source is "a double opt-in consumer panel" with "millions of active users" contributing "hundreds of millions of prompts per month", and that skew is corrected with "statistical modeling" ([Nick Lafferty, updated 2026-08-20](https://nicklafferty.com/blog/prompt-volume-aeo-explained/)).
  - The post gives no accuracy metrics and discloses "I work at Profound".
- **Semrush:**
  - Prompt sourcing: "We source billions of real prompts from AI search clickstream data and Google's keyword dataset for AI Overviews."
  - Volume is estimated per topic, because individual prompts are too specific, by combining "third-party data on real AI interactions with Semrush's machine learning models".
  - Responses are "captured from real requests and not via any APIs of LLMs".
  - Semrush's own caveats: "no platform can provide exact numbers on visibility", and its metrics are "reliable directional signals".
  - Source: [Semrush KB 1607](https://www.semrush.com/kb/1607-semrush-ai-visibility-data), accessed 2026-10-13.
- **Semrush's general traffic panel** is described as "over 200 million real, anonymized internet users" ([Semrush data KB](https://www.semrush.com/kb/997-semrush-data)) [snippet].
- **Ahrefs** index prompts are "modeled from real user searches in Ahrefs' keyword database" ([Ahrefs Brand Radar](https://ahrefs.com/brand-radar)).
  - A competitor's view: Ahrefs and Semrush model search volume from "ads data and clickstream panels", and "Search volume misses AI demand entirely". The same source says clickstream "see[s] that someone visited chatgpt.com but never see[s] what they asked" ([Nick Lafferty, Profound employee](https://nicklafferty.com/blog/prompt-volume-aeo-explained/)).
- **DataForSEO** AI search volume is "calculated based on our proprietary algorithm that considers multiple signals, including data on the PAA section of Google search results from our extensive SERP index" ([DataForSEO help center](https://dataforseo.com/help-center/what-is-ai-search-volume-in-dataforseo), accessed 2026-10-13; page "Updated 05.09.2025", so possibly outdated).
  - Grammatical variants count as one word, and multi-word keywords match only questions that contain every word.
  - For ChatGPT volume in LLM Mentions, DataForSEO counts PAA questions that contain the keyword ([DataForSEO help center](https://dataforseo.com/help-center/how-the-ai-search-volume-metric-works-in-llm-mentions)) [snippet].
  - A third party calls this the "PAA Proxy Method" and says the ChatGPT value can be 125x lower than Google search volume ([NextGrowth](https://nextgrowth.ai/dataforseo-ai-search-volume/)) [snippet].
- **Writesonic** ([Writesonic blog](https://writesonic.com/blog/ai-search-volume-prompt-explorer), accessed 2026-10-13):
  - Candidate prompts are "sourced from Google Keyword Planner, Reddit threads, People Also Ask results".
  - Volume is "Powered by our dataset of 2B+ real AI conversations", which mixes proprietary data and "contracted third-party datasets".
  - It uses "a two-part ensemble": a keyword-based estimate plus the chat data, aggregated by intent cluster.
  - Each estimate gets four quality checks, and prompts below a confidence threshold show "Low volume".
- **AthenaHQ QVEM** is described as an ensemble of deep learning models that outputs monthly absolute volumes with confidence intervals. AthenaHQ claims "95%+ Accuracy Rate" validated against unnamed "real-world data", which cannot be verified ([AthenaHQ QVEM](https://athenahq.ai/articles/generative-ai-search-query-volume-estimation-model)) [snippet].
- **Scrunch:** "Current estimates are at the topic level (not prompt-level), by design for data quality". It uses "a large-scale panel dataset and proprietary modeling" from unnamed third-party providers ([Scrunch FAQ](https://scrunch.com/faqs/how-does-scrunch-estimate-ai-search-volume-metrics), accessed 2026-10-13; undated). The FAQ also states:
  - "There isn't yet enough reliable, prompt-level data across AI platforms for accurate measurement."
  - "Volume estimates are directional, not exact."
- **Peec AI** shows volume as a 1 to 5 "relative demand" score ([Peec pricing page](https://peec.ai/pricing)). Reviewers note it is relative, not an absolute count ([Mavek review, Oct 2026](https://mavek.ai/blog/peec-ai-review/)) [snippet].
- **DemandSphere** weights volume estimates by engine market share ([DemandSphere](https://www.demandsphere.com/platform/demandmetrics-genai/prompt-volume/)) [snippet].

#### Independent and critical assessments
- **SparkToro / Gumshoe** ([SparkToro, 2026-01-27](https://sparktoro.com/blog/new-research-ais-are-highly-inconsistent-when-recommending-brands-or-products-marketers-should-take-care-when-tracking-ai-visibility/); coverage in [Search Engine Journal](https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/566242/)) [snippet]:
  - Rand Fishkin and Patrick O'Donnell had hundreds of volunteers run prompts in ChatGPT, Claude and Google AI during November and December 2025.
  - There was less than a 1 in 100 chance of getting the same brand list twice, and less than 1 in 1,000 of the same order.
  - The top headphone brands still appeared in 55% to 77% of 994 responses.
  - The study is not peer reviewed.
- **Jaeckert & O'Daniel** (German agency, updated 2026-01-06; [article](https://www.jaeckert-odaniel.com/en/prompt-search-volume-real-data-or-all-guessed/), accessed 2026-10-13):
  - "Prompt search volume is based on clickstream data from browser plugins": desktop, mostly Chrome, no apps or mobile.
  - "Those who install browser plugins are not a cross-section of society."
  - "Large numbers are extrapolated from small panels."
  - "Prompt volumes also usually start with keywords as anchors."
  - Verdict: "an interesting approach, but currently not a reliable control variable", and the figures "convey a pseudo-accuracy".
- **Promptwatch:** no AI provider publishes query counts, tools "will disagree, sometimes substantially", and volume should be used as a relative ranking signal. Query fan-out sub-queries never show up in volume estimates ([Promptwatch glossary](https://promptwatch.com/glossary/prompt-volume)) [snippet].
- **Getcito:** the true figure "could plausibly be half that or twice that". Do not compare numbers across tools that define a "prompt" differently ([Getcito guide](https://getcito.com/complete-guide-to-ai-prompt-volume)) [snippet].
- **Search Engine Land** ([SEL study](https://searchengineland.com/ai-assistants-global-search-engine-volume-study-471118), [SEL prompt tracking guide](https://searchengineland.com/guide/ai-prompt-tracking-how-to-monitor-llm-queries-better)) [snippet; the guide returned 403 to my fetch]:
  - A study says comparisons underestimate AI activity 4 to 5 times, because most usage happens in mobile apps that desktop panels miss.
  - A guide calls prompt volume useful for prioritization and expects accuracy to improve.
- **SparkToro search-share research:** AI tools made up 3.2% of desktop searches across 41 sites in Q4 2025 ([SparkToro](https://sparktoro.com/blog/new-research-search-happens-everywhere-an-analysis-of-41-websites-with-significant-search-activity/)) [snippet; 2025 data, possibly outdated].
- **Kevin Indig, Growth Memo:**
  - Brief #17: 65% to 85% of ChatGPT prompts have no matching keyword in Semrush's database ([Growth Intelligence Brief #17](https://www.growth-memo.com/p/growth-intelligence-brief-17)) [snippet].
  - Brief #16, citing AirOps research: 95% of ChatGPT fan-out queries had zero monthly search volume, and 32.9% of cited pages appeared only in SERPs for a fan-out query ([Growth Intelligence Brief #16](https://www.growth-memo.com/p/growth-intelligence-brief-16)) [snippet].

### Inferences
- Methods differ (panel, clickstream, PAA proxy, keyword modeling), so the same prompt will get very different numbers in different tools.
  - If AISEO adds a volume figure, it inherits this weakness. Leaving volume out is defensible but loses a sales checkbox.
  - A cheap middle path is DataForSEO AI search volume at $0.0001 per keyword, shown as directional and sourced, or topic-level only, as Scrunch and Semrush do.
- Keyword-derived methods (Ahrefs, DataForSEO, Writesonic's keyword half) structurally miss the 65% to 85% of ChatGPT prompts with no keyword match.
- Panel methods (Profound, Similarweb, Scrunch) see real prompt text but skew toward desktop extension users. They are mostly enterprise-priced.
- SparkToro's variance finding means 3 prompts per keyword, run once, is a small sample. Reporting how often a domain or brand appears across repeated runs is more defensible than single-run rank-like claims.

### Gaps
- I found no independent validation of any vendor's prompt volume against ground truth.
- I found no Seer Interactive or Ahrefs/Semrush research-blog study on prompt-volume accuracy. The only Seer item that surfaced was an AI Overviews CTR statistic.
- The panel providers behind Profound, Scrunch and Semrush's "third-party data" are not named.

## 3. Which tools analyze the sources and domains cited in AI answers for a keyword or topic, and what do they cost and limit?

### Takeaway
The closest analogs to AISEO's keyword report:
- **Semrush Prompt Research:** topic AI volume, intent, brands, cited source domains, and per-prompt answers. The standalone toolkit is about $99/month per third-party 2026 reviews.
- **Peec AI:** source analytics, citation share, source classification, gap analysis and relative prompt demand. About $95 to $495/month per third-party 2026 reviews.
- **Ahrefs Brand Radar:** cited pages, AI Sources and fan-out gaps. $199/month per AI index or $699/month for all.
- **Similarweb Prompt Analysis:** cited domains, competitor order and sentiment. Price not found.
- **Profound:** citations, with topic research reports for Enterprise only.

Most incumbents charge for prompts tracked daily (monitoring), not for one-off per-keyword research reports. Entry prices cluster at $95 to $199/month, against AISEO's $29.

### Cited Findings

#### Feature notes
- **Semrush:**
  - Prompt Research lists brands mentioned and "the domains AI platforms cite", and each prompt shows its AI response and sources ([Semrush KB 1597](https://www.semrush.com/kb/1597-prompt-research-report)).
  - Limit: "up to 1,000 prompts per day", where each unique prompt, country and LLM combination counts as one ([Semrush KB 1597](https://www.semrush.com/kb/1597-prompt-research-report)).
  - KB 1607 says "Reports can run up to 300 times per day" ([Semrush KB 1607](https://www.semrush.com/kb/1607-semrush-ai-visibility-data)). The two limits conflict.
- **Ahrefs:**
  - "Each prompt is checked daily on every selected platform". For example, "5 prompts on 1 platform = 150 checks/mo".
  - Claude uses 8 checks per update.
  - Plan prompt allowances: Lite 5, Standard 10, Advanced 20, Enterprise from 83.
  - Source: [Ahrefs Brand Radar](https://ahrefs.com/brand-radar).
- **Peec AI** groups its features in three modules ([Peec pricing page](https://peec.ai/pricing), accessed 2026-10-13):
  - **Measure:** "Source analytics", "Domain & URL detail view", "Citation share", "Source classification".
  - **Act:** "Gap analysis".
  - **Discover:** prompt suggestions and relative volume.
- **Profound:**
  - The official page (accessed 2026-10-13) shows a free Trial (50 unique prompts run daily for 7 days on ChatGPT, Gemini and Google AI Overviews, with Prompt Volumes "limited to 5 searches") and Enterprise ("Custom").
  - Enterprise covers up to 9 engines: ChatGPT, Perplexity, Google AI Mode, Gemini, Copilot, DeepSeek, Claude, Google AI Overviews and Exa Search. It includes Prompt Volumes "custom search volume" with CSV/JSON export and API.
  - The FAQ mentions "Agency Growth" with 400 credits per month per client workspace.
  - Source: [Profound pricing](https://www.tryprofound.com/pricing).
- **Similarweb Prompt Analysis** shows brand mentions, competitor order, sentiment and cited domains by topic ([Similarweb prompt tracking](https://aisearch.similarweb.com/blog/prompt-tracking/)) [snippet].
  - Similarweb data puts citation presence in US ChatGPT prompts at about 6.8% by May 2026, up from about 1.6% in June 2025 ([Similarweb AI search stats](https://aisearch.similarweb.com/blog/gen-ai-stats/)) [snippet].
- **Writesonic Prompt Explorer** shows top brands and related prompts per intent. Its blog page does not describe a cited-sources list ([Writesonic blog](https://writesonic.com/blog/ai-search-volume-prompt-explorer)).
- **Bing AI Performance** reports only the user's own site: citations, grounding queries, intents, topics and citation share. One third party says Citation Share "will not name the other domains sharing that pool" ([Launchcodex](https://launchcodex.com/blog/seo-geo-ai/bing-webmaster-tools-ai-citation-share-geo/)) [snippet].
- **Surfer AI Tracker** separates "Visibility Score" (what users see) from "Sources" (what the model relied on) ([Surfer docs](https://docs.surferseo.com/en/articles/11667466-ai-tracker)) [snippet].

#### Price and limit comparison (every price dated; "official" means the vendor page, accessed 2026-10-13)

| Product | Features comparable to AISEO's keyword report | Price and limits (date, source type) | Source |
|---|---|---|---|
| **AISEO (reference)** | Live Perplexity answers, 3 prompts × 20 markets; top domains, source mix, competitors, prompts, clusters, opportunity score | Pro $29/mo for 100 reports + 25 visibility scans | Assignment brief |
| Semrush AI Visibility Toolkit (Prompt Research) | Topic AI volume, intent, brands, cited domains, per-prompt answers | About $99/mo per domain, including 25 tracked prompts, 1 domain and 1 user; each extra domain or user +$99/mo; billed annually; 7-day trial (2026 third-party reviews) | [Behind Rankings](https://behindrankings.com/semrush-ai-seo-toolkit-review/), [Rankability](https://www.rankability.com/blog/semrush-ai-toolkit-review/) [snippet] |
| Semrush One (bundle) | Includes prompt research | Conflicting: ~$165, $199, $299, $399 or $549/mo across 2026 third-party reviews | [Style Factory](https://www.stylefactoryproductions.com/blog/semrush-pricing), [Prompt Insider](https://thepromptinsider.com/ai-tools/the-5-best-aeo-tools-in-2026/) [snippet] |
| Ahrefs Brand Radar | Cited pages, AI Sources (YouTube, TikTok, Reddit), competitor benchmarks, fan-out gaps | AI Visibility Index $199/mo (83 prompts/day, 2,500+ checks/mo, $0.020/check overage); "$699/MO FOR ALL MODELS"; custom prompts "Starts at $50/mo" and are free with any paid Ahrefs Lite plan and above (official) | [Ahrefs Brand Radar](https://ahrefs.com/brand-radar) |
| Ahrefs base plans | Required for full suite | Lite $129, Standard $249, Advanced $449, Enterprise from $1,499/mo; the "$828" figure in some reviews is Lite plus the $699 bundle (2026 third-party) | [Analyze AI](https://www.tryanalyze.ai/blog/ahrefs-brand-radar-review), [AEO Labs](https://www.aeolabs.ai/blog/ahrefs-brand-radar-review) [snippet] |
| Ahrefs custom prompt packs | Custom prompts | $50/mo (2,500 checks) to $250/mo (25,000 checks) (2026 third-party) | [AEO Labs](https://www.aeolabs.ai/blog/ahrefs-brand-radar-review) [snippet] |
| Profound | Prompt Volumes; Prompt Research Reports (Enterprise only); citations | Official: free 7-day trial, Enterprise custom. Third-party 2026: Starter $99/mo billed yearly (50 prompts, ChatGPT only), Growth $399/mo (100 prompts, adds Perplexity and AI Overviews); older reviews cite $499 entry. The official page did not show $99/$399 tiers when fetched | [Profound pricing](https://www.tryprofound.com/pricing); [Geotoolbox](https://geotoolbox.ai/blog/profound-pricing), [That Marketing Buddy](https://thatmarketingbuddy.com/pricing/profound), [Echowi](https://echowi.ai/blog/profound-review/) [snippet] |
| Peec AI | Prompt suggestions, relative volume 1 to 5, source analytics, citation share, source classification, gap analysis | Official page shows Starter, Pro, Advanced (monthly) and Enterprise (custom) but no visible prices. Third-party (read Aug to Oct 2026): Starter $95 (50 prompts), Pro $245 (150), Advanced $495 (350); about 15% off annually; EUR figures €85 and €205 billed yearly also reported | [Peec pricing](https://peec.ai/pricing); [Mavek](https://mavek.ai/blog/peec-ai-review/), [SE Ranking Visible](https://visible.seranking.com/blog/peec-ai-review/) [snippet] |
| Similarweb Prompt Analysis | Real-prompt topics, brands, competitor order, sentiment, cited domains | 150 tracked prompts, 3 or 6 months history; price not found (2026) | [Similarweb](https://similarweb.com/corp/search/gen-ai-intelligence/ai-brand-visibility/prompt-analysis) [snippet] |
| Writesonic Prompt Explorer | Volume, trend, regions, top brands, related prompts | No price on the feature page (updated 2026-07-28) | [Writesonic blog](https://writesonic.com/blog/ai-search-volume-prompt-explorer) |
| AnswerThePublic | AI Prompts with intent, sentiment, brands (2026 relaunch) | Starter $20/mo ($160/yr), Growth $99/mo ($792/yr), Business $199/mo ($1,592/yr); AI-prompt limits not shown (official). Free tier 3 searches/day (third-party) | [AnswerThePublic pricing](https://answerthepublic.com/pricing); [DIY AI](https://diyai.io/ai-tools/seo/reviews/answerthepublic-review/) [snippet] |
| DataForSEO (API) | AI search volume; LLM Mentions (citations from ChatGPT and AIO); LLM Scraper; LLM Responses | AI Keyword Data live $0.01/task + $0.0001/keyword ($110 per 1M keywords); LLM Mentions $0.1/request + $0.001/row; LLM Scraper $0.0012 to $0.004 per results page; LLM Responses $0.0006/task plus provider cost (official). The $100 monthly commitment for LLM Mentions and Backlinks was removed; one review dates this to 2026-07-01 | [DataForSEO AI Optimization](https://dataforseo.com/apis/ai-optimization-api), [pricing update](https://dataforseo.com/update/pricing-update-in-dataforseo-apis); [Meikuio review](https://meikuio.com/dataforseo-review/) [snippet] |
| Surfer AI Tracker | Prompt tracking with Sources list | $95/mo for 25 prompts up to $495/mo for 300 (date unclear) | [Surfer](https://surferseo.com/blog/how-to-track-llm-prompts) [snippet] |
| Bing Webmaster Tools AI Performance | Own-site citations, grounding queries, intents, topics, citation share | Free (preview) | [Otterly](https://otterly.ai/blog/bing-webmaster-tools-ai-performance-report/) [snippet], [Bing blog](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/) |
| Google Search Console | Own-site AI impressions by page, country, date | Free; no clicks or queries | [Search Engine Journal](https://www.searchenginejournal.com/google-search-console-ai-reports-rolled-out-worldwide/587836/) |
| AlsoAsked | People Also Ask trees only; no AI answers | Basic $12/mo (100 credits), Lite $23 (300), Pro $47 (1,000) (official) | [AlsoAsked pricing](https://alsoasked.com/pricing) |
| Keywords Everywhere | Classic volume; ChatGPT prompt templates | Bronze $84/yr (100K credits), Silver $168/yr (400K), Gold $480/yr (2M), Platinum $1,440/yr (8M) (official) | [Keywords Everywhere pricing](https://keywordseverywhere.com/pricing.html) |

### Inferences
- AISEO's keyword report is functionally closest to Semrush Prompt Research's output, but the two compete differently:
  - Semrush's edge is a precomputed 317M+ prompt database with volume.
  - AISEO's edge is live answers on demand, Perplexity coverage, and a price about 70% lower ($29 versus about $99).
  - Market count is not an edge here: Semrush claims 40+ markets (42 or 117 databases depending on the page).
- Incumbent pricing is per tracked prompt per day (monitoring). AISEO's per-report model suits one-off topic research by freelancers, small businesses and content teams, a use case the incumbents serve only as a side feature.
- The citation-presence figure (about 6.8% of US ChatGPT prompts) suggests ChatGPT is a thin source for citation analysis. Perplexity cites sources by design, which supports AISEO's choice of Perplexity for source-mix analysis. This needs confirming with a primary source.
- Free first-party data from Bing grounding queries and Search Console AI impressions complements, rather than competes with, keyword-level research on topics a site does not yet rank for.

### Gaps
- Semrush toolkit and Semrush One prices were not confirmed on Semrush's own pricing page; only third-party reviews.
- I found no prices for Similarweb Prompt Analysis, Writesonic Prompt Explorer, AthenaHQ, Scrunch or DemandSphere.
- Profound's current self-serve price list conflicts between its official page and 2026 reviews.
- Peec's official page did not render prices in my fetch.

## 4. What do open-source and tutorial apps that generate "AI SEO keyword reports" from Perplexity or ChatGPT answers show about the barrier to entry?

### Takeaway
The exact pattern behind AISEO's keyword report is available as tutorial source code: Bright Data's Perplexity scraper, then structured LLM analysis, then domains, source mix, competitors, prompt ideas, keyword clusters and a 0 to 100 score. Two examples:
- **Sonny Sangha's app (September 2025):** Next.js 15, Perplexity via Bright Data, GPT-4o.
- **TechWithEmma's "RankSEO" (first commit 2026-08-02):** Next.js 16, Perplexity via Bright Data, Claude Sonnet 4.6, plus ChatGPT and Gemini visibility scans.

RankSEO's Pro quota (100 keyword searches plus 25 visibility scans) is identical to AISEO Pro's. The core research task is a single file of about 700 lines, and scraping costs about $1.50 per 1,000 records at Bright Data list price. The barrier to entry is very low.

### Cited Findings

#### RankSEO (TechWithEmmaYT/AI-SEO-Marketing-SaaS-App)
I cloned this repo on 2026-10-13.
- **What it claims:** "An AI-powered SaaS for keyword research and brand visibility tracking across ChatGPT and Gemini". Listed features include AI Keyword Research, Citation & Mention Tracking, Competitor Analysis, Content Opportunities, Realtime Report Progress, "Usage Limits & Feature Locks" and Stripe subscriptions ([GitHub repo](https://github.com/TechWithEmmaYT/AI-SEO-Marketing-SaaS-App)).
- **License:** "free for personal use". A commercial license is required for "SaaS products, client work, or production applications" and is sold on Gumroad ([README](https://github.com/TechWithEmmaYT/AI-SEO-Marketing-SaaS-App), [Gumroad](https://techwithemma.gumroad.com/l/atlmby)).
  - The README's "Watch the Full Tutorial" link points to the youtube.com homepage, not a specific video.
- **Activity:** 4 commits, 2026-08-02 to 2026-08-03 (git log of the clone). The GitHub page showed 8 stars and 1 fork ([GitHub repo](https://github.com/TechWithEmmaYT/AI-SEO-Marketing-SaaS-App)).
- **Stack** (package.json): Next.js 16.2.12, React 19.2.4, Better Auth 1.6 with @better-auth/stripe, Stripe, Prisma 6.19, Trigger.dev 4.5.9, Vercel AI SDK (`ai` 7.x), Zod 4 ([package.json](https://github.com/TechWithEmmaYT/AI-SEO-Marketing-SaaS-App/blob/main/package.json)).
  - The repo also ships AGENTS.md and `.agents/skills/bright-data-best-practices`, suggesting it was built with AI coding agents.
- **Keyword pipeline** (`trigger/keyword-research.ts`, 692 lines; [file](https://github.com/TechWithEmmaYT/AI-SEO-Marketing-SaaS-App/blob/main/trigger/keyword-research.ts)):
  - It POSTs to `https://api.brightdata.com/datasets/v3/trigger` with `dataset_id=gd_m7dhdot1vw9a7gc1n` and the body `{url: "https://www.perplexity.ai", prompt: keyword, country}`. That is one Perplexity answer, for the raw keyword, in one country per report.
  - The country picker offers all 249 ISO 3166 codes and passes the chosen one straight to Bright Data, with no curated market list ([components/ai-keyword/keyword-search-row.tsx](https://github.com/TechWithEmmaYT/AI-SEO-Marketing-SaaS-App/blob/main/components/ai-keyword/keyword-search-row.tsx)).
  - It then calls `generateText({ model: "anthropic/claude-sonnet-4.6", output: Output.object({schema: keywordReportSchema}) })`.
- **Report schema** (same file):
  - `overallScore` 0 to 100 with `scoreLabel`.
  - `overview` with citationsAnalyzed, uniqueDomains, competitorsFound and promptOpportunities.
  - Top domains (domain, type, share).
  - `sourceMix` (type, count, share).
  - `competitors` (name, domain, citations, share, strength: High, Medium, Emerging or Not mentioned).
  - `contentOpportunity` (patternsThatEarnCitations, evidenceGaps, fastestOpportunities).
  - `promptIdeas` (prompt, evidence, opportunity).
  - Content keywords (keyword, cluster, evidence, relevance 0 to 100).
- **Prompt guardrails** (same file):
  - "Never invent search volume, traffic, rankings, sources, facts, competitors, or any other metric that the supplied research does not support."
  - Scoring rule: "Score the keyword's directional organic content potential out of 100: audience breadth 25 points, question diversity 20, content depth 20, competitive opportunity 20, and source confidence 15."
- **Visibility scans** (`trigger/search-visibility.ts`) use Bright Data datasets `gd_m7aof0k82r803d5bjm` (url chatgpt.com) and `gd_mbz66arm2mf9cu856y` (url gemini.google.com) ([file](https://github.com/TechWithEmmaYT/AI-SEO-Marketing-SaaS-App/blob/main/trigger/search-visibility.ts)).
- **Quotas** (`lib/plans.ts`): free is 2 keyword searches plus 2 visibility scans; `pro` is 100 plus 25 per month; `plus` is 500 plus 100. Prices come from Stripe environment variables ([lib/plans.ts](https://github.com/TechWithEmmaYT/AI-SEO-Marketing-SaaS-App/blob/main/lib/plans.ts)).

#### Sonny Sangha (PAPAFAM) SEO Reports Generator
- **What it is:** "SEO Reports Generator SaaS — Powered by Bright Data & AI (Next.js 15 + Clerk + Convex + OpenAI)", "powered by Bright Data's Perplexity Scraper with OpenAI GPT powered analysis".
- **Implementation:** it uses the same Perplexity dataset id `gd_m7dhdot1vw9a7gc1n` and `openai("gpt-4o")`.
- **Report fields:** keyword_clusters, content_gaps, recommendations, confidence_score and overall_score. The README lists "Source inventory, competitor analysis, keyword research, backlink analysis" and "AI Chat Integration" on a Pro plan.
- **Promotion:** the README pushes a Bright Data referral with "$20 Free Credit" and gives the full source free via a form.
- **Activity:** commits from 2025-09-18 to 2025-09-25 (pre-2026, possibly outdated as a product, but it is the earliest instance of the pattern I found).
- Sources: [GitHub repo](https://github.com/sonnysangha/seo-AI-saas-brightdata-clerk-billing-nextjs-15), and a YouTube livestream titled "Let's build an AI Marketing SaaS w/ Next.js 15! (SEO Reports, BrightData, OpenAI, Clerk Billing)" ([YouTube](https://www.youtube.com/watch?v=gYR3e_YxLj8)).

#### Other open-source tools and costs
- **All-In-One-Free-SEO-Tool** (MIT): a self-hosted app with "99 tools", including AI search visibility across ChatGPT, Perplexity, Gemini and AI Overviews, with "No paid APIs required" ([GitHub](https://github.com/IamRamgarhia/All-In-One-Free-SEO-Tool)) [snippet].
- **Other repos:** a "searchstack-aeo" CLI and "seo-geo-claude-skills" agent skills appear under GitHub's ai-seo topic ([GitHub ai-seo topic](https://github.com/topics/ai-seo)) [snippet]. Qforia forks also exist ([Nazarts14/qforia](https://github.com/Nazarts14/qforia), [simonthbt/qforia](https://github.com/simonthbt/qforia)).
- **Bright Data marketing:** Bright Data promotes this use case with a webinar and guide on sending user-like queries to ChatGPT and Perplexity and parsing citations ([Bright Data webinar](https://brightdata.com/webinar/track-and-optimize-ai-search-preformance)) [snippet].
- **Scraping cost:** Bright Data Web Scraper API is $1.5 per 1K records pay-as-you-go, charged only for successful deliveries. There is a free tier of 5K records/month and a $499/month plan with 384K records ($1.3 per 1K beyond) (2026, [Bright Data pricing](https://brightdata.com/pricing/web-scraper-api)) [snippet]. I did not confirm Perplexity-specific pricing.
  - An alternative is DataForSEO LLM Scraper at $0.0012 to $0.004 per results page ([DataForSEO](https://dataforseo.com/apis/ai-optimization-api)).

### Inferences
- **Features are not a moat:**
  - RankSEO's report schema maps nearly one-to-one onto AISEO's report sections (most-cited domains, source mix, competing brands, prompts, keyword clusters, opportunity score).
  - Its quotas equal AISEO Pro's.
  - Anyone can stand up a comparable product in days from public code. A commercial license is required to ship RankSEO's code itself.
- **Possible differentiators:** sampling depth (AISEO's 3 prompts per keyword versus RankSEO's single raw-keyword prompt), repeated sampling and history, accuracy guardrails, distribution and brand, and price.
  - Market breadth is not a differentiator against RankSEO, which accepts any of 249 country codes. AISEO's 20 markets only help if they are curated and validated, for example markets where Bright Data's Perplexity scraper reliably returns localized answers. That is unverified.
- **Unit costs:**
  - At Bright Data's list price, the scraping cost of a 3-prompt report in one market is about $0.0045 (3 records × $1.5/1K). That is negligible against $29 for 100 reports. LLM analysis is likely the larger variable cost; I did not compute it.
  - The pay-as-you-go APIs (Bright Data, DataForSEO) make the marginal cost of a competitor near zero, which invites price competition at the low end.

### Gaps
- I could not identify the specific RankSEO YouTube video or its view count, or how many commercial clones are deployed.
- I could not confirm Bright Data's Perplexity-dataset price or AISEO's LLM cost per report.
- Reddit and Product Hunt launches of clones were not checked.

## 5. What do users and SEO practitioners say they want from AI keyword research, and what needs are unmet?

### Takeaway
Practitioners want:
- Real prompts grouped into topics and used for prioritization, not precise counts.
- Visibility measured across repeated samples (how often a brand is in the consideration set), not single-run rank.
- Coverage of fan-out sub-queries.
- Citation and source insight that shows which sites to earn mentions on.
- First-party AI data that includes queries and clicks.

Unmet needs: trustworthy volume, especially for mobile apps and non-US markets; comparability across tools; Perplexity-specific demand data; AI clicks and query data in Google's reports; and affordable entry-level tools. Most products start at about $95 to $199/month or are enterprise-gated. Reddit opinion could not be gathered.

### Cited Findings
- **Prompt panels:** Kevin Indig's H1 2026 report argues vendors should track how often a brand shows up in a panel of prompts, in which context, with what sentiment, and whether it is recommended ahead of competitors ([Growth Memo AI Halftime Report H1 2026](https://www.growth-memo.com/p/ai-halftime-report-h1-2026)) [snippet].
- **Topics over keywords:** a Semrush study with Growth Memo's team covered 1,094 US categories in ChatGPT. It frames the question as whether a brand "keeps appearing across the topics that matter to the business", not whether it ranks for a keyword or prompt ([Semrush study](https://www.semrush.com/blog/chatgpt-topic-authority-study/)) [snippet].
  - Scrunch and Semrush both chose topic-level volume for the same reason ([Scrunch FAQ](https://scrunch.com/faqs/how-does-scrunch-estimate-ai-search-volume-metrics), [Semrush KB 1607](https://www.semrush.com/kb/1607-semrush-ai-visibility-data)).
- **Relevance over volume:** "We do not prioritize according to prompt search volume, but according to relevance." The authors focus on visibility in real AI responses ([Jaeckert & O'Daniel](https://www.jaeckert-odaniel.com/en/prompt-search-volume-real-data-or-all-guessed/)).
- **Repeated sampling:** SparkToro titles its findings "marketers should take care when tracking AI visibility". Brands in the consideration set recur even though order is close to random ([SparkToro](https://sparktoro.com/blog/new-research-ais-are-highly-inconsistent-when-recommending-brands-or-products-marketers-should-take-care-when-tracking-ai-visibility/)) [snippet].
- **Fan-out coverage:** 95% of ChatGPT fan-out queries have zero search volume, and 32.9% of cited pages appear only for fan-out queries ([Growth Memo #16](https://www.growth-memo.com/p/growth-intelligence-brief-16)) [snippet]. Tools are emerging for this (Qforia, DEJAN, Ahrefs "Fanout queries") ([Search Engine Land](https://searchengineland.com/guide/query-fan-out-tools-software), [Ahrefs](https://ahrefs.com/brand-radar)).
- **First-party data:** practitioners welcomed Bing's grounding-query data ([Search Engine Watch, "7 things we love"](https://searchenginewatch.com/bing-webmaster-tools-ai-performance/); [Launchcodex, "Bing Webmaster Tools is now tracking how often AI cites your content, and Google is not"](https://launchcodex.com/blog/seo-geo-ai/bing-webmaster-tools-ai-citation-share-geo/)) [snippet].
  - Google's AI report lacks clicks, which one outlet calls "the clicks problem" ([Crawlraven](https://crawlraven.com/blog/gsc-ai-performance-reports)) [snippet]. Search Engine Journal confirms no click data as of 2026-08-31 ([SEJ](https://www.searchenginejournal.com/google-search-console-ai-reports-rolled-out-worldwide/587836/)).
- **Prompt validity and volatility:** a search result attributed to Ahrefs' blog says AI platforms don't share which queries users enter or how often, so you "may be tracking visibility for phrases no one actually searches". It also says answer "position" is "highly volatile" and should be paired with traffic, server logs and search performance ([Ahrefs blog](https://ahrefs.com/blog/?p=194563)) [snippet; attribution unverified].
- **Traffic attribution:** a Similarweb study (US desktop panel, July to December 2025) found brands recommended in ChatGPT were about 2.5x more likely to get a site visit within 7 days, mostly via branded Google search ([Gromerce summary](https://gromerce.com/en/blog/chatgpt-brand-recommendations-similarweb-traffic-2026)) [snippet; secondary summary, 2025 data].
- **Demand without keyword data:** a guide tells buyers to build research around 20 to 50 real buyer prompts rather than single keywords. It notes Perplexity provides no search volume or keyword difficulty, so it must be paired with Semrush or Ahrefs ([Otterly Perplexity SEO](https://otterly.ai/blog/perplexity-seo/), [Ranking by SEO](https://www.rankingbyseo.com/blog/perplexity-keyword-research/)) [snippet].
- **Cost pressure:** agencies pay $99/month per additional domain in Semrush's toolkit. One review frames ten clients as ten times $99 ([Rankability](https://www.rankability.com/blog/semrush-ai-toolkit-review/)) [snippet].
- **Panel coverage:** desktop browser-plugin panels miss apps and mobile ([Jaeckert & O'Daniel](https://www.jaeckert-odaniel.com/en/prompt-search-volume-real-data-or-all-guessed/)). Search Engine Land says this undercounts AI activity 4 to 5 times ([SEL](https://searchengineland.com/ai-assistants-global-search-engine-volume-study-471118)) [snippet].
- **Regional coverage:** Profound's own coverage is "strongest in the US, UK, and select European markets" ([Profound help center](https://help.tryprofound.com/articles/4288109168-prompt-volumes)). Non-core markets are thin.

### Inferences
- Several stated needs map directly onto AISEO's keyword report:
  - Cluster prompts into topics.
  - Run several samples per prompt and report citation frequency and consistency rather than a single snapshot.
  - Label any volume as directional, with its source.
  - Surface likely fan-out sub-queries.
  - List the specific source domains and pages to earn mentions on.
- Live-answer tools such as AISEO can cover markets that panel-based tools serve weakly outside the US, UK and select European markets. Tutorial clones get that breadth for free (RankSEO accepts any of 249 country codes), so the value lies in validated local answers, not the market count.
- A low price ($29) with per-report pricing addresses the cost pressure that agencies and freelancers report with per-domain or per-prompt tracking pricing.
- Importing a site's Bing grounding queries could become a free, first-party "AI keyword" input that most competitors don't use yet. This needs product validation.

### Gaps
- Reddit (r/SEO, r/bigseo) could not be searched or fetched; the search tool rejects the domain. Direct community sentiment, complaints about specific tools, and willingness-to-pay signals are missing.
- LinkedIn posts were not retrievable. I found no survey data quantifying what features buyers rank highest in AI keyword research.
- I found no evidence on demand for Perplexity-specific research, versus ChatGPT or Google AI Mode, among SMB buyers.
