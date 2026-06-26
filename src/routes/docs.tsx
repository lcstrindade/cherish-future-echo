import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, BookOpen, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  listPublishedArticles,
  searchArticles,
  type ArticleListItem,
} from "@/lib/articles.functions";

export const Route = createFileRoute("/docs")({
  loader: async ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["docs-sidebar"],
      queryFn: () => listPublishedArticles(),
    }),
  component: DocsLayout,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">{error.message}</div>
  ),
});

function DocsLayout() {
  const all = (Route.useLoaderData() ?? []) as ArticleListItem[];
  const params = useParams({ strict: false }) as { slug?: string };
  const activeSlug = params.slug;

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const search = useServerFn(searchArticles);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["docs-search", debounced],
    queryFn: () => search({ data: { query: debounced } }),
    enabled: debounced.length > 0,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, ArticleListItem[]>();
    for (const a of all) {
      const key = a.category?.trim() || "Geral";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [all]);

  const showingSearch = debounced.length > 0;
  const results = (searchResults ?? []) as ArticleListItem[];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="h-14 border-b sticky top-0 z-40 bg-background/90 backdrop-blur flex items-center px-4 gap-4">
        <Link to="/" className="font-semibold flex items-center gap-2 shrink-0">
          <BookOpen className="h-5 w-5 text-primary" /> Docs
        </Link>
        <div className="relative flex-1 max-w-xl ml-auto mr-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar na documentação..."
            className="pl-9 h-9 bg-muted/50 border-transparent focus-visible:bg-background"
          />
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-r min-h-[calc(100vh-3.5rem)] sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto px-3 py-6 hidden md:block">
          {showingSearch ? (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground px-2 mb-2">
                {isFetching ? "Buscando..." : `${results.length} resultados`}
              </div>
              <ul className="space-y-0.5">
                {results.map((a) => (
                  <SidebarLink
                    key={a.id}
                    slug={a.slug}
                    title={a.title}
                    active={a.slug === activeSlug}
                  />
                ))}
                {!isFetching && results.length === 0 && (
                  <li className="text-sm text-muted-foreground px-2 py-3">
                    Nada encontrado.
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <nav className="space-y-6">
              {grouped.map(([cat, items]) => (
                <div key={cat}>
                  <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground px-2 mb-2">
                    {cat}
                  </div>
                  <ul className="space-y-0.5">
                    {items.map((a) => (
                      <SidebarLink
                        key={a.id}
                        slug={a.slug}
                        title={a.title}
                        active={a.slug === activeSlug}
                      />
                    ))}
                  </ul>
                </div>
              ))}
              {grouped.length === 0 && (
                <div className="text-sm text-muted-foreground px-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Nenhum artigo publicado.
                </div>
              )}
            </nav>
          )}
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function SidebarLink({
  slug,
  title,
  active,
}: {
  slug: string;
  title: string;
  active: boolean;
}) {
  return (
    <li>
      <Link
        to="/docs/$slug"
        params={{ slug }}
        className={
          "block px-2 py-1.5 rounded-md text-sm transition-colors " +
          (active
            ? "bg-accent text-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/60")
        }
      >
        {title}
      </Link>
    </li>
  );
}
