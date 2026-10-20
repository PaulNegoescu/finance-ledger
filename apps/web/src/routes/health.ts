import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getLedger } = await import("../server/ledger.server");
          await getLedger().health();
          return Response.json({ ok: true });
        } catch {
          return Response.json({ ok: false }, { status: 503 });
        }
      },
    },
  },
});
