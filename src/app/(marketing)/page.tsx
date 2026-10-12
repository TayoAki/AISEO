import { PLANS } from "@/server/billing/plans";
import { ButtonLink, Card } from "@/components/ui";

const steps = [
  {
    title: "Ask like a customer",
    body: "We send real questions to Perplexity, ChatGPT and Gemini, the way your buyers search today.",
  },
  {
    title: "Measure the answers",
    body: "Mentions, citations and source domains are counted directly from the collected answers.",
  },
  {
    title: "Act on the gaps",
    body: "Claude turns the evidence into a short, specific plan: what to publish and where to earn citations.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-20 sm:pt-28">
        <p className="text-sm font-semibold text-primary">AI search research for marketers</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Find out what AI assistants say about your market, and whether they mention you.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          AISEO collects live answers from Perplexity, ChatGPT and Gemini, then shows which sources and competitors
          they rely on and where your brand is missing.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/sign-up" size="lg">
            Start free: {PLANS.free.limits.keyword} keyword + {PLANS.free.limits.visibility} visibility reports
          </ButtonLink>
          <ButtonLink href="/pricing" variant="secondary" size="lg">
            See pricing
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="products" className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 md:grid-cols-2">
          <h2 id="products" className="sr-only">
            Products
          </h2>
          <Card className="bg-background">
            <p className="text-sm font-semibold text-primary">Keyword research</p>
            <h3 className="mt-2 text-xl font-semibold">Who wins a keyword in AI answers</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter a keyword and market. Get an opportunity score, the domains AI answers cite most, competing brands,
              prompts worth targeting and related keyword clusters.
            </p>
          </Card>
          <Card className="bg-background">
            <p className="text-sm font-semibold text-primary">AI search visibility</p>
            <h3 className="mt-2 text-xl font-semibold">Does ChatGPT or Gemini recommend you?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your website, brand and category. We ask five neutral buyer questions on both assistants and score
              how often you&apos;re mentioned and cited, prompt by prompt.
            </p>
          </Card>
        </div>
      </section>

      <section aria-labelledby="how" className="mx-auto max-w-6xl px-5 py-16">
        <h2 id="how" className="text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
          Scores are directional research from collected answers. AISEO does not report search volume, keyword
          difficulty or Google rankings.
        </p>
      </section>
    </>
  );
}
