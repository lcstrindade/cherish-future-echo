import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  getArticleBySlug,
  listPublishedArticles,
  type ArticleListItem,
} from "@/lib/articles.functions";
import { ArticleRenderer } from "@/components/ArticleRenderer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ArticleToc } from "@/components/ArticleToc";

export const Route = createFileRoute("/docs/$slug")({
  loader: async ({ params, context }) => {
    const article = await context.queryClient.ensureQueryData({
      queryKey: ["article", params.slug],
      queryFn: () => getArticleBySlug({ data: { slug: params.slug } }),
    });
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.article
      ? [
          { title: `${loaderData.article.title} — Documentação` },
          {
            name: "description",
            content: loaderData.article.excerpt ?? loaderData.article.title,
          },
          { property: "og:title", content: loaderData.article.title },
          { property: "og:description", content: loaderData.article.excerpt ?? "" },
          { property: "og:type", content: "article" },
          ...(loaderData.article.cover_image_url
            ? [{ property: "og:image", content: loaderData.article.cover_image_url }]
            : []),
        ]
      : [],
    scripts: loaderData?.article
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "TechArticle",
              headline: loaderData.article.title,
              description: loaderData.article.excerpt ?? undefined,
              image: loaderData.article.cover_image_url ?? undefined,
              datePublished: loaderData.article.published_at ?? undefined,
              dateModified:
                loaderData.article.updated_at ??
                loaderData.article.published_at ??
                undefined,
              author: { "@type": "Organization", name: "Bivvo" },
              publisher: { "@type": "Organization", name: "Bivvo" },
            }),
          },
        ]
      : [],
  }),
  component: ArticlePage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="max-w-3xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold mb-2">Artigo não encontrado</h1>
      <Link to="/docs" className="text-primary underline">
        Voltar para a documentação
      </Link>
    </div>
  ),
});

function ArticlePage() {
  const { article } = Route.useLoaderData();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const readingMinutes = useMemo(() => {
    const words = extractText(article.content).trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }, [article.content]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const attach = () => {
      container.querySelectorAll<HTMLHeadingElement>("h2, h3").forEach((h) => {
        if (!h.id) return;
        if (h.querySelector(".heading-anchor")) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "heading-anchor opacity-0 group-hover:opacity-100 ml-2 text-muted-foreground hover:text-foreground transition-opacity text-sm align-middle";
        btn.setAttribute("aria-label", "Copiar link da seção");
        btn.textContent = "#";
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const url = `${window.location.origin}${window.location.pathname}#${h.id}`;
          navigator.clipboard.writeText(url).then(() => toast.success("Link copiado"));
        });
        h.classList.add("group");
        h.style.scrollMarginTop = "6rem";
        h.appendChild(btn);
      });
    };
    attach();
    const mo = new MutationObserver(attach);
    mo.observe(container, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [article.slug]);

  const { data: all = [] } = useSuspenseQuery({
    queryKey: ["docs-sidebar"],
    queryFn: () => listPublishedArticles(),
  });
  const ordered = orderArticles(all);
  const idx = ordered.findIndex((a) => a.slug === article.slug);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const crumbs = [
    { label: "Docs", to: "/docs" },
    ...(article.category ? [{ label: article.category }] : []),
    ...(article.subcategory ? [{ label: article.subcategory }] : []),
    { label: article.title },
  ];
  return (
    <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 py-10 sm:py-12 flex gap-10">
      <main className="min-w-0 flex-1 max-w-3xl">
        <Breadcrumbs items={crumbs} />
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{article.title}</h1>
        {article.excerpt && (
          <p className="text-lg text-muted-foreground mb-8">{article.excerpt}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-8">
          <span>
            Atualizado em{" "}
            {new Date(article.updated_at ?? article.published_at ?? Date.now()).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {readingMinutes} min de leitura
          </span>
        </div>
        {article.cover_image_url && (
          <img
            src={article.cover_image_url}
            alt=""
            className="rounded-lg mb-8 w-full border"
          />
        )}
        <div ref={contentRef} key={article.slug}>
          <ArticleRenderer content={article.content} />
        </div>
        {(prev || next) && (
        <nav className="mt-16 pt-8 border-t grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link
              to="/docs/$slug"
              params={{ slug: prev.slug }}
              className="group border rounded-lg p-4 hover:bg-accent/50 hover:border-foreground/20 transition-colors sm:text-left"
            >
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <ChevronLeft className="h-3 w-3" /> Anterior
              </div>
              {prev.category && (
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">
                  {prev.category}
                </div>
              )}
              <div className="font-medium group-hover:text-foreground line-clamp-2">
                {prev.title}
              </div>
            </Link>
          ) : <div className="hidden sm:block" />}
          {next ? (
            <Link
              to="/docs/$slug"
              params={{ slug: next.slug }}
              className="group border rounded-lg p-4 hover:bg-accent/50 hover:border-foreground/20 transition-colors sm:text-right"
            >
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 sm:justify-end">
                Próximo <ChevronRight className="h-3 w-3" />
              </div>
              {next.category && (
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">
                  {next.category}
                </div>
              )}
              <div className="font-medium group-hover:text-foreground line-clamp-2">
                {next.title}
              </div>
            </Link>
          ) : <div className="hidden sm:block" />}
        </nav>
        )}
      </main>
      <aside className="hidden xl:block w-56 shrink-0">
        <div className="sticky top-20">
          <ArticleToc containerRef={contentRef} />
        </div>
      </aside>
    </div>
  );
}

function orderArticles(all: ArticleListItem[]): ArticleListItem[] {
  const map = new Map<string, Map<string, ArticleListItem[]>>();
  for (const a of all) {
    const topic = a.category?.trim() || "Geral";
    const sub = a.subcategory?.trim() || "";
    if (!map.has(topic)) map.set(topic, new Map());
    const subs = map.get(topic)!;
    if (!subs.has(sub)) subs.set(sub, []);
    subs.get(sub)!.push(a);
  }
  const out: ArticleListItem[] = [];
  for (const [, subs] of map) for (const [, items] of subs) for (const a of items) out.push(a);
  return out;
}

function extractText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (typeof node === "object") {
    const n = node as Record<string, unknown>;
    let s = "";
    if (typeof n.text === "string") s += n.text + " ";
    if (Array.isArray(n.content)) s += extractText(n.content);
    return s;
  }
  return "";
}
