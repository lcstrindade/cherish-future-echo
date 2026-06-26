import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, FileText } from "lucide-react";
import { searchArticles, type ArticleListItem } from "@/lib/articles.functions";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Documentação" },
      { name: "description", content: "Pesquise nossa documentação completa." },
    ],
  }),
  component: DocsIndex,
});

function DocsIndex() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const search = useServerFn(searchArticles);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(id);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["articles-search", debounced],
    queryFn: () => search({ data: { query: debounced } }),
  });

  const items = (data ?? []) as ArticleListItem[];

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Documentação</h1>
      <p className="text-muted-foreground mb-6">
        Pesquise em linguagem natural — entendemos o contexto.
      </p>
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Como faço para..."
          className="pl-9 h-12"
        />
      </div>
      {isFetching && (
        <div className="text-sm text-muted-foreground mb-4">Buscando...</div>
      )}
      {items.length === 0 && !isFetching ? (
        <div className="text-center py-16 border rounded-lg">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum artigo encontrado.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                to="/docs/$slug"
                params={{ slug: a.slug }}
                className="block p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                {a.category && (
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    {a.category}
                  </div>
                )}
                <div className="font-semibold">{a.title}</div>
                {a.excerpt && (
                  <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {a.excerpt}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}