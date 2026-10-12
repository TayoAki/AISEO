/**
 * Pipeline failures carry a stable code and a message that is safe to show
 * users. Internal detail (provider responses, stack traces) is stored
 * separately in report.failure_detail and logs, never sent to the browser.
 */
export const FAILURE_MESSAGES = {
  COLLECTION_FAILED: "We couldn't collect AI answers for this report. Your credit has been refunded.",
  NO_USABLE_ANSWERS: "The AI platforms returned no usable answers for this request. Your credit has been refunded.",
  TIMED_OUT: "Collecting AI answers took too long. Your credit has been refunded.",
  ANALYSIS_FAILED: "We couldn't analyze the collected answers. Your credit has been refunded.",
  ANALYSIS_DECLINED: "The analysis model declined this request. Try rephrasing it. Your credit has been refunded.",
  PROMPTS_FAILED: "We couldn't prepare neutral test prompts for this topic. Try a broader topic. Your credit has been refunded.",
  CONFIGURATION: "Report generation is temporarily unavailable. Your credit has been refunded.",
  INTERNAL: "Something went wrong while generating this report. Your credit has been refunded.",
  CANCELED: "This report was canceled. Your credit has been refunded.",
} as const;

export type FailureCode = keyof typeof FAILURE_MESSAGES;

/**
 * Failures a user's own input can cause after money was already spent on
 * the report (collection or model calls). They're refunded like any other
 * failure, so they count toward a daily cap to stop deliberate repetition.
 */
export const INPUT_FAILURE_CODES = ["NO_USABLE_ANSWERS", "ANALYSIS_DECLINED", "PROMPTS_FAILED"] as const satisfies readonly FailureCode[];

/**
 * Thrown for failures that retrying cannot fix (bad config, refusals, empty
 * collections). Job handlers fail the report immediately instead of retrying.
 */
export class NonRetryableError extends Error {
  readonly code: FailureCode;
  readonly detail: string;

  constructor(code: FailureCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "NonRetryableError";
    this.code = code;
    this.detail = detail;
  }
}

/** Internal error description (with stack) for logs and report.failure_detail. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return (error.stack ?? `${error.name}: ${error.message}`).slice(0, 4000);
  return String(error).slice(0, 4000);
}
