"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Turnstile } from "@/components/turnstile";
import { Alert, Button, Card, Field, Input, Select, Spinner } from "@/components/ui";
import { COUNTRIES, keywordInputSchema, visibilityInputSchema, type ReportType } from "@/lib/report-input";
import { newIdempotencyKey } from "@/lib/utils";

type FieldErrors = Partial<Record<string, string>>;
type ApiError = { error?: { code?: string; message?: string; fields?: Record<string, string[] | undefined> } };

const COPY: Record<ReportType, { title: string; submit: string; running: string }> = {
  keyword: {
    title: "New keyword report",
    submit: "Run keyword report",
    running: "Takes about 2 to 5 minutes. You can leave the page while it runs.",
  },
  visibility: {
    title: "New visibility scan",
    submit: "Run visibility scan",
    running: "Takes about 3 to 8 minutes. You can leave the page while it runs.",
  },
};

/**
 * Creates a report through POST /api/reports. Free users pass a Turnstile
 * check on every report; paid users don't see one (`siteKey` is null).
 */
export function NewReportForm({
  type,
  siteKey,
  remaining,
  defaults = {},
}: {
  type: ReportType;
  siteKey: string | null;
  remaining: number;
  /** Prefill, e.g. when retrying a failed report. */
  defaults?: Partial<Record<"keyword" | "country" | "website" | "brand" | "topic", string>>;
}) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  // One key per submission attempt: retries and double-clicks reuse it, edits reset it.
  const idempotencyKey = useRef<string | null>(null);

  const copy = COPY[type];
  const outOfCredits = remaining <= 0;

  function resetCaptcha() {
    setToken(null);
    setWidgetKey((k) => k + 1);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const raw =
      type === "keyword"
        ? { type, keyword: form.get("keyword"), country: form.get("country") }
        : { type, website: form.get("website"), brand: form.get("brand"), topic: form.get("topic") };

    const parsed = (type === "keyword" ? keywordInputSchema : visibilityInputSchema).safeParse(raw);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        errors[key] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    if (siteKey && !token) {
      setError({ message: "Please complete the security check." });
      return;
    }

    setFieldErrors({});
    setError(null);
    setPending(true);
    idempotencyKey.current ??= newIdempotencyKey();

    let response: Response;
    try {
      response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: parsed.data,
          idempotencyKey: idempotencyKey.current,
          turnstileToken: token ?? undefined,
        }),
      });
    } catch {
      setPending(false);
      setError({ message: "We couldn't reach the server. Check your connection and try again." });
      return;
    }

    if (response.ok) {
      const body = (await response.json()) as { data: { report: { id: string } } };
      router.push(`/reports/${body.data.report.id}`);
      return;
    }

    const body = (await response.json().catch(() => ({}))) as ApiError;
    setPending(false);
    resetCaptcha();
    const code = body.error?.code;
    const message = body.error?.message ?? "Something went wrong. Please try again.";
    if (response.status === 401) {
      router.push(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (code === "INVALID_INPUT" && body.error?.fields) {
      const errors: FieldErrors = {};
      for (const [key, messages] of Object.entries(body.error.fields)) errors[key] = messages?.[0];
      setFieldErrors(errors);
      return;
    }
    setError({ message, upgrade: code === "LIMIT_REACHED" });
  }

  return (
    <Card>
      <h2 className="text-base font-semibold">{copy.title}</h2>
      <form
        onSubmit={onSubmit}
        onChange={() => {
          idempotencyKey.current = null;
        }}
        className="mt-5 flex flex-col gap-4"
        noValidate
      >
        {type === "keyword" ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
            <Field id="keyword" label="Keyword or topic" error={fieldErrors.keyword} hint="For example: crm for startups">
              <Input
                id="keyword"
                name="keyword"
                defaultValue={defaults.keyword}
                required
                maxLength={100}
                aria-invalid={Boolean(fieldErrors.keyword)}
                aria-describedby={fieldErrors.keyword ? "keyword-error" : "keyword-hint"}
              />
            </Field>
            <Field id="country" label="Market" error={fieldErrors.country}>
              <Select
                id="country"
                name="country"
                defaultValue={COUNTRIES.some(([code]) => code === defaults.country) ? defaults.country : "US"}
              >
                {COUNTRIES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="website" label="Website" error={fieldErrors.website} hint="For example: acme.com">
                <Input
                  id="website"
                  name="website"
                  defaultValue={defaults.website}
                  inputMode="url"
                  autoComplete="url"
                  required
                  aria-invalid={Boolean(fieldErrors.website)}
                  aria-describedby={fieldErrors.website ? "website-error" : "website-hint"}
                />
              </Field>
              <Field id="brand" label="Brand name" error={fieldErrors.brand} hint="As customers would write it">
                <Input
                  id="brand"
                  name="brand"
                  defaultValue={defaults.brand}
                  required
                  maxLength={80}
                  aria-invalid={Boolean(fieldErrors.brand)}
                  aria-describedby={fieldErrors.brand ? "brand-error" : "brand-hint"}
                />
              </Field>
            </div>
            <Field
              id="topic"
              label="Category"
              error={fieldErrors.topic}
              hint="What you sell, in a few words. For example: project management software for agencies"
            >
              <Input
                id="topic"
                name="topic"
                defaultValue={defaults.topic}
                required
                maxLength={160}
                aria-invalid={Boolean(fieldErrors.topic)}
                aria-describedby={fieldErrors.topic ? "topic-error" : "topic-hint"}
              />
            </Field>
          </>
        )}

        {siteKey && !outOfCredits ? (
          <Turnstile key={widgetKey} siteKey={siteKey} action={`report-${type}`} onToken={setToken} />
        ) : null}

        {error ? (
          <Alert tone="danger">
            {error.message}{" "}
            {error.upgrade ? (
              <Link href="/billing" className="font-medium underline">
                See plans
              </Link>
            ) : null}
          </Alert>
        ) : null}

        {outOfCredits ? (
          <Alert tone="warning" title="You're out of credits for this report type">
            <Link href="/billing" className="font-medium underline">
              Upgrade your plan
            </Link>{" "}
            to keep going.
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Uses 1 credit ({remaining} left). {copy.running} Failed reports are refunded.
          </p>
          <Button type="submit" disabled={pending || outOfCredits}>
            {pending ? <Spinner /> : null}
            {copy.submit}
          </Button>
        </div>
      </form>
    </Card>
  );
}
