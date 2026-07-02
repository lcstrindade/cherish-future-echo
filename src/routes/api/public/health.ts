import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          service: "bivvo-docs",
          timestamp: new Date().toISOString(),
        }),
    },
  },
});