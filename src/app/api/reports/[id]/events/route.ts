import { getDb } from "@/server/db/client";
import { getReportProgressForUser, type ReportProgressRow } from "@/server/reports/queries";
import { serializeProgress } from "@/server/reports/serialize";
import { isTerminal } from "@/server/reports/state";
import { fail, requireApiUser, UUID_PATTERN } from "@/server/web/api";
import { getReportListener } from "@/server/web/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 20_000;
// Railway caps a streamed HTTP response at 15 minutes; close first and let
// EventSource reconnect (it resumes from the current row, nothing is lost).
const MAX_STREAM_MS = 13 * 60_000;

/** Server-sent events with live progress for one report. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return fail(404, "NOT_FOUND", "Report not found.");

  const db = getDb();
  const initial = await getReportProgressForUser(db, auth.user.id, id);
  if (!initial) return fail(404, "NOT_FOUND", "Report not found.");

  const encoder = new TextEncoder();
  let cleanup: () => void = () => undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastPayload = "";
      const disposers: Array<() => void> = [];

      const close = () => {
        if (closed) return;
        closed = true;
        for (const dispose of disposers.splice(0)) dispose();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      cleanup = close;
      request.signal.addEventListener("abort", close, { once: true });

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      const sendProgress = (row: ReportProgressRow) => {
        const payload = JSON.stringify(serializeProgress(row));
        if (payload !== lastPayload) {
          lastPayload = payload;
          write(`event: progress\ndata: ${payload}\n\n`);
        }
        if (isTerminal(row.status)) {
          send("done", { status: row.status });
          close();
        }
      };

      // Notifications can arrive in bursts: re-read one at a time so events
      // are never sent out of order, coalescing whatever arrives meanwhile.
      let reading = false;
      let readAgain = false;
      const refresh = async () => {
        if (closed) return;
        if (reading) {
          readAgain = true;
          return;
        }
        reading = true;
        try {
          do {
            readAgain = false;
            const row = await getReportProgressForUser(db, auth.user.id, id).catch(() => null);
            // A failed read closes the stream; EventSource reconnects and resumes.
            if (!row) return close();
            sendProgress(row);
          } while (readAgain && !closed);
        } finally {
          reading = false;
        }
      };

      write("retry: 3000\n\n");
      sendProgress(initial);
      if (closed) return;

      const unsubscribe = await getReportListener().subscribe(id, () => void refresh());
      if (closed) return unsubscribe();
      disposers.push(unsubscribe);

      // Catch anything that changed between the first read and LISTEN starting.
      await refresh();
      if (closed) return;

      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      const maxLife = setTimeout(() => {
        send("reconnect", {});
        close();
      }, MAX_STREAM_MS);
      disposers.push(
        () => clearInterval(heartbeat),
        () => clearTimeout(maxLife),
      );
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
