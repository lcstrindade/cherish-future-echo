import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { listAllArticlesAdmin, deleteArticle } from "@/lib/articles.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminList,
});

function AdminList() {
  const list = useServerFn(listAllArticlesAdmin);
  const del = useServerFn(deleteArticle);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-articles"],
    queryFn: () => list(),
  });

  async function onDelete(id: string) {
    if (!confirm("Excluir este artigo?")) return;
    try {
      await del({ data: { id } });
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Artigos</h1>
        <Button asChild>
          <Link to="/admin/$id" params={{ id: "new" }}>
            <Plus className="h-4 w-4 mr-2" /> Novo artigo
          </Link>
        </Button>
      </div>
      {isLoading && <div className="text-muted-foreground">Carregando...</div>}
      <div className="border rounded-lg divide-y">
        {(data ?? []).map(
          (a: { id: string; slug: string; title: string; status: string }) => (
            <div key={a.id} className="p-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium truncate">{a.title}</div>
                <div className="text-xs text-muted-foreground">
                  /{a.slug} ·{" "}
                  <span
                    className={
                      a.status === "published" ? "text-green-600" : "text-amber-600"
                    }
                  >
                    {a.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/$id" params={{ id: a.id }}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => onDelete(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ),
        )}
        {!isLoading && (data ?? []).length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum artigo ainda.
          </div>
        )}
      </div>
    </main>
  );
}
