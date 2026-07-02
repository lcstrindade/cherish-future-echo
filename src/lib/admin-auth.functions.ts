import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type AdminSession = { isAdmin?: boolean };

// In-memory rate-limit per session cookie (worker instance scoped).
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function sessionConfig() {
  return {
    password: process.env.SESSION_SECRET!,
    name: "admin-session",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export const requireAdminSession = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const session = await useSession<AdminSession>(sessionConfig());
    if (!session.data.isAdmin) {
      throw new Error("Unauthorized");
    }
    return next();
  },
);

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ username: z.string().min(1), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const u = process.env.ADMIN_USERNAME;
    const p = process.env.ADMIN_PASSWORD;
    if (!u || !p) throw new Error("Admin credentials not configured");
    const key = data.username;
    const now = Date.now();
    const rec = attempts.get(key);
    if (rec && rec.until > now && rec.count >= MAX_ATTEMPTS) {
      const wait = Math.ceil((rec.until - now) / 1000);
      return { ok: false as const, blocked: true, retryAfter: wait };
    }
    if (data.username !== u || data.password !== p) {
      const next = rec && rec.until > now ? rec : { count: 0, until: now + WINDOW_MS };
      next.count += 1;
      attempts.set(key, next);
      return { ok: false as const };
    }
    const session = await useSession<AdminSession>(sessionConfig());
    attempts.delete(key);
    await session.update({ isAdmin: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AdminSession>(sessionConfig());
  return { isAdmin: !!session.data.isAdmin };
});
