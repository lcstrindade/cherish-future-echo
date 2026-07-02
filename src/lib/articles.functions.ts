import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAdminSession } from "./admin-auth.functions";

function publicClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type ArticleListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  subcategory: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  parent_id: string | null;
  position: number;
};

export const listPublishedArticles = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArticleListItem[]> => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("articles")
      .select("id, slug, title, excerpt, category, subcategory, cover_image_url, published_at, parent_id, position")
      .eq("status", "published")
      .order("position", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as ArticleListItem[];
  },
);

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb
      .from("articles")
      .select("id, slug, title, excerpt, content, cover_image_url, category, subcategory, published_at, updated_at, parent_id, position")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const searchArticles = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ query: z.string().max(500).default("") }).parse(d),
  )
  .handler(async ({ data }): Promise<ArticleListItem[]> => {
    const sb = publicClient();
    const q = data.query.trim();
    if (!q) {
      const { data: list, error } = await sb
        .from("articles")
      .select("id, slug, title, excerpt, category, subcategory, cover_image_url, published_at, parent_id, position")
        .eq("status", "published")
      .order("position", { ascending: true })
        .limit(20);
      if (error) throw new Error(error.message);
      return (list ?? []) as ArticleListItem[];
    }

    let embedding: number[] | null = null;
    if (q.length >= 3) {
      try {
        const { embedText } = await import("./ai-gateway.server");
        embedding = await embedText(q);
      } catch (e) {
        console.error("embed query failed", e);
      }
    }

    const { data: rows, error } = await sb.rpc("search_articles", {
      query_text: q,
      query_embedding: embedding as unknown as string,
      match_count: 20,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ArticleListItem[];
  });

// --- Admin server functions ---

const ArticleInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "slug inválido"),
  excerpt: z.string().max(500).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  subcategory: z.string().max(80).nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  content: z.any(),
  content_text: z.string().default(""),
  status: z.enum(["draft", "published"]),
  parent_id: z.string().uuid().nullable().optional(),
});

export const listAllArticlesAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminSession])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("articles")
      .select("id, slug, title, status, updated_at, published_at, category, subcategory, parent_id, position")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getArticleByIdAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminSession])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("articles")
      .select("id, slug, title, excerpt, content, content_text, cover_image_url, category, subcategory, status, published_at, updated_at, parent_id, position")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertArticle = createServerFn({ method: "POST" })
  .middleware([requireAdminSession])
  .inputValidator((d: unknown) => ArticleInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let embedding: number[] | null = null;
    const textForEmbedding = `${data.title}\n\n${data.excerpt ?? ""}\n\n${data.content_text}`.trim();
    try {
      const { embedText } = await import("./ai-gateway.server");
      embedding = await embedText(textForEmbedding);
    } catch (e) {
      console.error("embed article failed", e);
    }

    const payload = {
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt ?? null,
      category: data.category ?? null,
      subcategory: data.subcategory ?? null,
      cover_image_url: data.cover_image_url ?? null,
      content: data.content ?? {},
      content_text: data.content_text,
      status: data.status,
      author_id: null,
      parent_id: data.parent_id ?? null,
      embedding: embedding && embedding.length ? (embedding as unknown as string) : null,
      published_at:
        data.status === "published" ? new Date().toISOString() : null,
    } as never;

    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("articles")
        .update(payload)
        .eq("id", data.id)
        .select("id, slug")
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    // New article — append at the end of its sibling group
    const sibQ = supabaseAdmin
      .from("articles")
      .select("position")
      .order("position", { ascending: false })
      .limit(1);
    const { data: siblings } = data.parent_id
      ? await sibQ.eq("parent_id", data.parent_id)
      : await sibQ.is("parent_id", null);
    const nextPos = (siblings?.[0]?.position ?? -1) + 1;
    const { data: row, error } = await supabaseAdmin
      .from("articles")
      .insert({ ...(payload as object), position: nextPos } as never)
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const reorderArticles = createServerFn({ method: "POST" })
  .middleware([requireAdminSession])
  .inputValidator((d: unknown) =>
    z.object({
      updates: z.array(
        z.object({
          id: z.string().uuid(),
          parent_id: z.string().uuid().nullable(),
          position: z.number().int().min(0),
        }),
      ).max(500),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const u of data.updates) {
      const { error } = await supabaseAdmin
        .from("articles")
        .update({ parent_id: u.parent_id, position: u.position })
        .eq("id", u.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteArticle = createServerFn({ method: "POST" })
  .middleware([requireAdminSession])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("articles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const backfillEmbeddings = createServerFn({ method: "POST" })
  .middleware([requireAdminSession])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { embedText } = await import("./ai-gateway.server");
    const { data: rows, error } = await supabaseAdmin
      .from("articles")
      .select("id, title, excerpt, content_text, embedding")
      .is("embedding", null);
    if (error) throw new Error(error.message);
    let updated = 0;
    for (const r of (rows ?? []) as {
      id: string; title: string; excerpt: string | null; content_text: string;
    }[]) {
      const text = `${r.title}\n\n${r.excerpt ?? ""}\n\n${r.content_text ?? ""}`.trim();
      if (!text) continue;
      try {
        const emb = await embedText(text);
        if (!emb?.length) continue;
        const { error: upErr } = await supabaseAdmin
          .from("articles")
          .update({ embedding: emb as unknown as string } as never)
          .eq("id", r.id);
        if (upErr) throw upErr;
        updated += 1;
      } catch (e) {
        console.error("backfill embed failed", r.id, e);
      }
    }
    return { updated, total: rows?.length ?? 0 };
  });

export const createMediaSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireAdminSession])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("article-media")
      .createSignedUrl(data.path, 60 * 60 * 24 * 365);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const uploadArticleMedia = createServerFn({ method: "POST" })
  .middleware([requireAdminSession])
  .inputValidator((d: unknown) =>
    z.object({
      filename: z.string().min(1).max(200),
      contentType: z.string().min(1).max(100),
      dataBase64: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = (data.filename.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${crypto.randomUUID()}.${ext || "bin"}`;
    const bytes = Buffer.from(data.dataBase64, "base64");
    const { error } = await supabaseAdmin.storage
      .from("article-media")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (error) throw new Error(error.message);
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("article-media")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signErr) throw new Error(signErr.message);
    return { url: signed.signedUrl, path };
  });