import type { Metadata } from "next";

import { PricingTable } from "@/components/pricing-table";
import { PLANS } from "@/server/billing/plans";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Simple pricing</h1>
        <p className="mt-3 text-muted-foreground">
          Start free. Upgrade for monthly allowances and AI insights. Failed reports never use a credit.
        </p>
      </div>
      <div className="mt-10">
        <PricingTable plans={[PLANS.free, PLANS.pro, PLANS.plus]} ctaHref="/sign-up" />
      </div>
    </section>
  );
}
