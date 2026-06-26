import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileText, Menu, Search } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
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

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, ArticleListItem[]>>();
    for (const a of all) {
      const topic = a.category?.trim() || "Geral";
      const sub = a.subcategory?.trim() || "";
      if (!map.has(topic)) map.set(topic, new Map());
      const subs = map.get(topic)!;
      if (!subs.has(sub)) subs.set(sub, []);
      subs.get(sub)!.push(a);
    }
    return Array.from(map.entries()).map(
      ([topic, subs]) => [topic, Array.from(subs.entries())] as const,
    );
  }, [all]);

  const activeTopic = useMemo(() => {
    const active = all.find((a) => a.slug === activeSlug);
    return active?.category?.trim() || grouped[0]?.[0] || "";
  }, [all, activeSlug, grouped]);

  const sidebarNav = (
    <SidebarNav
      grouped={grouped}
      activeSlug={activeSlug}
      activeTopic={activeTopic}
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

        <ThemeToggle />
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

function SidebarNav({
  grouped,
  activeSlug,
  activeTopic,
  onNavigate,
}: {
  grouped: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, ArticleListItem[]]>]>;
  activeSlug: string | undefined;
  activeTopic: string;
  onNavigate: () => void;
}) {
  if (grouped.length === 0) {
    return (
      <div className="text-sm text-muted-foreground px-2 flex items-center gap-2">
        <FileText className="h-4 w-4" /> Nenhum artigo publicado.
      </div>
    );
  }
  return (
    <Accordion
      type="multiple"
      defaultValue={[activeTopic]}
      className="space-y-1"
    >
      {grouped.map(([topic, subs]) => (
        <AccordionItem key={topic} value={topic} className="border-none">
          <AccordionTrigger className="px-2 py-2 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:no-underline hover:text-foreground">
            {topic}
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <div className="space-y-3">
              {subs.map(([sub, items]) => (
                <div key={sub || "_"}>
                  {sub && (
                    <div className="text-[11px] font-medium text-muted-foreground/80 px-2 mb-1">
                      {sub}
                    </div>
                  )}
                  <ul className={"space-y-0.5 " + (sub ? "pl-3 border-l border-border/60 ml-2" : "")}>
                    {items.map((a) => (
                      <SidebarLink
                        key={a.id}
                        slug={a.slug}
                        title={a.title}
                        active={a.slug === activeSlug}
                        onClick={onNavigate}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function SidebarLink({
  slug,
  title,
  active,
  onClick,
}: {
  slug: string;
  title: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <li className="relative">
      {active && (
        <span
          aria-hidden
          className="absolute left-[-13px] top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary"
        />
      )}
      <Link
        to="/docs/$slug"
        params={{ slug }}
        onClick={onClick}
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
