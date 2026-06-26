import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  searchArticles,
  type ArticleListItem,
} from "@/lib/articles.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fallback?: ArticleListItem[];
};

export function SearchCommand({ open, onOpenChange, fallback = [] }: Props) {
  const navigate = useNavigate();
  const search = useServerFn(searchArticles);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
    }
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["docs-search-cmd", debounced],
    queryFn: () => search({ data: { query: debounced } }),
    enabled: open && debounced.length > 0,
  });

  const items: ArticleListItem[] = debounced ? (data ?? []) : fallback;

  const grouped = useMemo(() => {
    const map = new Map<string, ArticleListItem[]>();
    for (const a of items) {
      const key = a.category?.trim() || "Outros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [items]);

  function go(slug: string) {
    onOpenChange(false);
    navigate({ to: "/docs/$slug", params: { slug } });
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Buscar artigos, tutoriais e guias..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60vh]">
        {isFetching && debounced && (
          <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
            <Search className="h-4 w-4 animate-pulse" /> Buscando...
          </div>
        )}
        {!isFetching && items.length === 0 && (
          <CommandEmpty>
            {debounced
              ? `Nenhum resultado para "${debounced}".`
              : "Nenhum artigo disponível."}
          </CommandEmpty>
        )}
        {grouped.map(([topic, list]) => (
          <CommandGroup key={topic} heading={topic}>
            {list.map((a) => (
              <CommandItem
                key={a.id}
                value={`${a.title} ${a.excerpt ?? ""}`}
                onSelect={() => go(a.slug)}
                className="flex items-start gap-3"
              >
                <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  {a.excerpt && (
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {a.excerpt}
                    </div>
                  )}
                </div>
                {a.subcategory && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                    {a.subcategory}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      <div className="border-t px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>Navegue com ↑ ↓ · Enter abre · Esc fecha</span>
        <span className="hidden sm:inline">Bivvo Docs</span>
      </div>
    </CommandDialog>
  );
}