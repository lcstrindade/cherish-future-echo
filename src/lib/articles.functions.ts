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
};

export const listPublishedArticles = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArticleListItem[]> => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("articles")
      .select("id, slug, title, excerpt, category, subcategory, cover_image_url, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb
      .from("articles")
      .select("id, slug, title, excerpt, content, cover_image_url, category, subcategory, published_at, updated_at")
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
        .select("id, slug, title, excerpt, category, subcategory, cover_image_url, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return list ?? [];
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
});

export const listAllArticlesAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminSession])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("articles")
      .select("id, slug, title, status, updated_at, published_at, category, subcategory")
      .order("updated_at", { ascending: false });
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
      .select("id, slug, title, excerpt, content, content_text, cover_image_url, category, subcategory, status, published_at, updated_at")
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
    const { data: row, error } = await supabaseAdmin
      .from("articles")
      .insert(payload)
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return row;
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