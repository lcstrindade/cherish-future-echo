import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { BookOpen, Search, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Central de Documentação" },
      { name: "description", content: "Documentação do seu SaaS com busca inteligente por contexto." },
      { property: "og:title", content: "Central de Documentação" },
      { property: "og:description", content: "Documentação do seu SaaS com busca inteligente por contexto." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-muted/50 text-xs mb-6">
          <Sparkles className="h-3 w-3" /> Busca inteligente com IA
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Tudo o que você precisa saber sobre o produto
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Guias, tutoriais e referências sobre cada funcionalidade. Pesquise em linguagem natural — entendemos o contexto.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/docs"><BookOpen className="h-4 w-4 mr-2" /> Explorar documentação</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/docs"><Search className="h-4 w-4 mr-2" /> Pesquisar</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
