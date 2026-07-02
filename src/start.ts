import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Polyfill WebSocket for Node.js < 22 (Supabase Realtime requirement).
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  // Dynamic require so it only loads on the server runtime.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ws = require("ws");
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws.WebSocket ?? ws;
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
