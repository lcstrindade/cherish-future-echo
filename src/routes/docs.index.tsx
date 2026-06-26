import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Search, Sparkles } from "lucide-react";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Documentação" },
      { name: "description", content: "Pesquise nossa documentação completa." },
    ],
  }),
  component: DocsHome,
});

function DocsHome() {
  return (
    <main className="max-w-3xl mx-auto px-8 py-16">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-3">
        <BookOpen className="h-3.5 w-3.5" /> Documentação
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-4">
        Bem-vindo à documentação
      </h1>
      <p className="text-lg text-muted-foreground mb-10">
        Use a navegação à esquerda para explorar os artigos, ou a busca no topo
        — entendemos contexto e linguagem natural.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          to="/docs"
          className="border rounded-lg p-5 hover:bg-accent/50 transition-colors"
        >
          <Search className="h-5 w-5 text-primary mb-2" />
          <div className="font-semibold mb-1">Busca semântica</div>
          <p className="text-sm text-muted-foreground">
            Pergunte em linguagem natural — encontramos o artigo certo.
          </p>
        </Link>
        <div className="border rounded-lg p-5">
          <Sparkles className="h-5 w-5 text-primary mb-2" />
          <div className="font-semibold mb-1">Sempre atualizado</div>
          <p className="text-sm text-muted-foreground">
            Conteúdo mantido pela equipe, com novos artigos publicados
            continuamente.
          </p>
        </div>
      </div>
    </main>
  );
}
