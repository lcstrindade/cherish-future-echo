import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, Menu, Search } from "lucide-react";
import { ArticleIcon } from "@/components/ArticleIcon";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { SearchCommand } from "@/components/SearchCommand";
import {
  listPublishedArticles,
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

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tree = useMemo(() => buildTree(all), [all]);
  const activePath = useMemo(
    () => (activeSlug ? findAncestorIds(all, activeSlug) : new Set<string>()),
    [all, activeSlug],
  );

  const sidebarNav = (
    <SidebarTree
      nodes={tree}
      activeSlug={activeSlug}
      activePath={activePath}
      onNavigate={() => setMobileNavOpen(false)}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="h-14 border-b sticky top-0 z-40 bg-background/80 backdrop-blur-md flex items-center px-3 sm:px-5 gap-3">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir navegação"
              className="md:hidden h-9 w-9"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0 overflow-y-auto">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle>Documentação</SheetTitle>
            </SheetHeader>
            <div className="p-3">{sidebarNav}</div>
          </SheetContent>
        </Sheet>

        <Link to="/" className="font-semibold flex items-center gap-2 shrink-0">
          <img
            src="https://adm.bivvo.com.br/publicLogo?t=1778778948975"
            alt="Bivvo"
            className="h-7 w-auto"
          />
        </Link>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex-1 max-w-xl ml-auto mr-auto h-9 px-3 rounded-md border bg-muted/40 hover:bg-muted/60 transition-colors flex items-center gap-2 text-sm text-muted-foreground"
          aria-label="Buscar na documentação"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        <a
          href="https://app.bivvo.com.br"
          className="shrink-0 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center hover:opacity-90"
        >
          Acessar Bivvo
        </a>

      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-r min-h-[calc(100vh-3.5rem)] sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto px-3 py-6 hidden md:block">
          {sidebarNav}
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>

      <SearchCommand
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        fallback={all}
      />
    </div>
  );
}

// --- Tree helpers ---

export type TreeNode = ArticleListItem & { children: TreeNode[] };

function buildTree(all: ArticleListItem[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  all.forEach((a) => byId.set(a.id, { ...a, children: [] }));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function findAncestorIds(all: ArticleListItem[], slug: string): Set<string> {
  const bySlug = new Map<string, ArticleListItem>();
  const byId = new Map<string, ArticleListItem>();
  all.forEach((a) => {
    bySlug.set(a.slug, a);
    byId.set(a.id, a);
  });
  const set = new Set<string>();
  let cur = bySlug.get(slug);
  while (cur) {
    set.add(cur.id);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return set;
}

function SidebarTree({
  nodes,
  activeSlug,
  activePath,
  onNavigate,
}: {
  nodes: TreeNode[];
  activeSlug: string | undefined;
  activePath: Set<string>;
  onNavigate: () => void;
}) {
  if (nodes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground px-2 flex items-center gap-2">
        <FileText className="h-4 w-4" /> Nenhum artigo publicado.
      </div>
    );
  }
  return (
    <ul className="space-y-0.5">
      {nodes.map((n) => (
        <TreeItem
          key={n.id}
          node={n}
          depth={0}
          activeSlug={activeSlug}
          activePath={activePath}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

function TreeItem({
  node,
  depth,
  activeSlug,
  activePath,
  onNavigate,
}: {
  node: TreeNode;
  depth: number;
  activeSlug: string | undefined;
  activePath: Set<string>;
  onNavigate: () => void;
}) {
  const active = node.slug === activeSlug;
  const hasChildren = node.children.length > 0;
  const inPath = activePath.has(node.id);
  const [open, setOpen] = useState<boolean>(hasChildren && (inPath || depth === 0));
  useEffect(() => {
    if (inPath) setOpen(true);
  }, [inPath]);

  return (
    <li>
      <div
        className={
          "group relative flex items-center gap-1 rounded-md pr-1 transition-colors " +
          (active
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/60")
        }
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary"
          />
        )}
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? "Recolher" : "Expandir"}
            onClick={() => setOpen((v) => !v)}
            className="h-6 w-6 flex items-center justify-center shrink-0 hover:text-foreground"
          >
            <ChevronRight
              className={"h-3.5 w-3.5 transition-transform " + (open ? "rotate-90" : "")}
            />
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}
        <Link
          to="/docs/$slug"
          params={{ slug: node.slug }}
          onClick={onNavigate}
          className={
            "flex-1 min-w-0 truncate py-1.5 pr-2 text-sm inline-flex items-center gap-2 " +
            (active ? "font-medium" : "")
          }
          title={node.title}
        >
          {node.icon && <ArticleIcon name={node.icon} className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{node.title}</span>
        </Link>
      </div>
      {hasChildren && open && (
        <ul className="mt-0.5 space-y-0.5 border-l border-border/60 ml-3">
          {node.children.map((c) => (
            <TreeItem
              key={c.id}
              node={c}
              depth={depth + 1}
              activeSlug={activeSlug}
              activePath={activePath}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
