import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getArticleBySlug } from "@/lib/articles.functions";
import { ArticleRenderer } from "@/components/ArticleRenderer";

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
          ...(loaderData.article.cover_image_url
            ? [{ property: "og:image", content: loaderData.article.cover_image_url }]
            : []),
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
  return (
    <main className="max-w-3xl mx-auto px-8 py-12">
      {article.category && (
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          {article.category}
        </div>
      )}
      <h1 className="text-4xl font-bold tracking-tight mb-3">{article.title}</h1>
      {article.excerpt && (
        <p className="text-lg text-muted-foreground mb-8">{article.excerpt}</p>
      )}
      {article.cover_image_url && (
        <img
          src={article.cover_image_url}
          alt=""
          className="rounded-lg mb-8 w-full border"
        />
      )}
      <ArticleRenderer content={article.content} />
    </main>
  );
}
